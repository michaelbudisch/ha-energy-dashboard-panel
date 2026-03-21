"""Custom panel integration for a solar+battery energy dashboard."""

from __future__ import annotations

import copy
import logging
from pathlib import Path
import re
from typing import Any

import voluptuous as vol

from homeassistant.components import panel_custom
from homeassistant.components.http import HomeAssistantView, StaticPathConfig
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType
try:
    from homeassistant.helpers.discovery import async_load_platform as _async_load_platform
except ImportError:
    _async_load_platform = None

from .const import (
    CONF_BACKGROUND_IMAGE,
    CONF_EXTRA_CHIPS,
    CONF_BATTERY_POWER,
    CONF_BATTERY_CHARGE_POWER,
    CONF_BATTERY_DISCHARGE_POWER,
    CONF_BATTERY_SOC,
    CONF_GRID_EXPORT_POWER,
    CONF_GRID_IMPORT_POWER,
    CONF_GRID_POWER,
    CONF_GRID_SENSOR_MODE,
    CONF_INVERT_BATTERY_POWER_SIGN,
    CONF_INVERT_LOAD_POWER_SIGN,
    CONF_BATTERY_CAPACITY_KWH,
    CONF_BATTERY_MAX_CHARGE_SOC,
    CONF_BATTERY_RESERVE_SOC,
    CONF_LOAD_POWER,
    CONF_BATTERY_SENSOR_MODE,
    CONF_PRICE_CURRENT,
    CONF_PRICE_ENTITY,
    CONF_PRICE_FALLBACK_ENTITY,
    CONF_PRICE_LEVEL,
    CONF_PRICE_MAX_TODAY,
    CONF_PRICE_MIN_TODAY,
    CONF_PRICE_NEXT_1H,
    CONF_PRICE_NEXT_2H,
    CONF_PRICE_NEXT_3H,
    CONF_PRICE_NEXT_4H,
    CONF_PRICE_NEXT_5H,
    CONF_PRICE_SENSORS,
    CONF_REQUIRE_ADMIN,
    CONF_SENSORS,
    CONF_SIDEBAR_ICON,
    CONF_SIDEBAR_TITLE,
    CONF_SOLAR_POWER,
    CONF_TIBBER_API_KEY,
    CONF_TIBBER_API_TOKEN,
    CONF_TIBBER_HOME_ID,
    CONF_URL_PATH,
    CONF_USE_SIGNED_BATTERY_POWER,
    CONF_WEATHER_ENTITY,
    CONF_WEATHER_LOCATION,
    DATA_CONFIG,
    DATA_BASE_CONFIG,
    DATA_PANEL_CONFIG,
    DATA_LIFETIME_ACCUMULATOR,
    DATA_LIFETIME_PLATFORM_LOADED,
    DATA_RUNTIME_SETTINGS_STORE,
    DATA_UI_SETTINGS,
    DATA_UI_SETTINGS_STORE,
    DEFAULT_BATTERY_SENSOR_MODE,
    DEFAULT_BATTERY_RESERVE_SOC,
    DEFAULT_BATTERY_MAX_CHARGE_SOC,
    DEFAULT_GRID_SENSOR_MODE,
    DEFAULT_INVERT_BATTERY_POWER_SIGN,
    DEFAULT_INVERT_LOAD_POWER_SIGN,
    DEFAULT_PRICE_SENSORS,
    DEFAULT_SENSORS,
    DEFAULT_USE_SIGNED_BATTERY_POWER,
    DOMAIN,
    ENTITY_OPEN_METEO_WEATHER,
    ENTITY_TIBBER_API_GRID_POWER,
    ENTITY_TIBBER_API_PRICE,
    PANEL_ELEMENT_NAME,
    PANEL_MODULE_FILE,
    PANEL_STATIC_PATH,
    PANEL_URL_PATH_DEFAULT,
    SERVICE_RESET_LIFETIME_SAVINGS,
    SERVICE_SET_TIBBER_CREDENTIALS,
    SERVICE_SET_UI_CONFIG,
    SIDEBAR_ICON_DEFAULT,
    SIDEBAR_TITLE_DEFAULT,
    STORAGE_KEY_RUNTIME_SETTINGS,
    STORAGE_KEY_UI_SETTINGS,
)


_LOGGER = logging.getLogger(__name__)


def _clean_non_empty(raw: object) -> str | None:
    """Normalize text config values to non-empty strings."""
    if not isinstance(raw, str):
        return None
    txt = raw.strip()
    return txt or None


def _clean_entity_id(raw: object) -> str | None:
    """Normalize and validate Home Assistant entity ids."""
    txt = _clean_non_empty(raw)
    if txt is None:
        return None
    try:
        return cv.entity_id(txt)
    except vol.Invalid:
        return None


def _coerce_float(raw: object, minimum: float, maximum: float) -> float | None:
    """Parse and clamp float values."""
    if raw is None:
        return None
    value: float | None = None
    if isinstance(raw, str):
        txt = raw.strip()
        if not txt:
            return None
        cleaned = re.sub(r"[^\d+\-.,]", "", txt).replace(",", ".")
        if cleaned in {"", "+", "-", ".", "+.", "-."}:
            return None
        try:
            value = float(cleaned)
        except ValueError:
            return None
    else:
        try:
            value = float(raw)
        except (TypeError, ValueError):
            return None
    if value is None:
        return None
    return max(minimum, min(maximum, value))


def _normalize_sensor_mode(raw: object, default: str) -> str:
    """Normalize grid/battery sensor mode."""
    txt = str(raw or "").strip().lower()
    if txt in {"auto", "signed", "dual"}:
        return txt
    return default


def _normalize_ui_config(raw: object) -> dict[str, Any]:
    """Normalize runtime UI overrides saved by the panel settings dialog."""
    if not isinstance(raw, dict):
        return {}

    out: dict[str, Any] = {}

    title = _clean_non_empty(raw.get("title"))
    if title is not None:
        out["title"] = title

    text_keys = (
        CONF_BACKGROUND_IMAGE,
        CONF_WEATHER_LOCATION,
    )
    for key in text_keys:
        if key in raw:
            out[key] = _clean_non_empty(raw.get(key))

    entity_keys = (
        CONF_WEATHER_ENTITY,
        CONF_PRICE_ENTITY,
        CONF_PRICE_FALLBACK_ENTITY,
        CONF_TIBBER_HOME_ID,
    )
    for key in entity_keys:
        if key in raw:
            if key == CONF_TIBBER_HOME_ID:
                out[key] = _clean_non_empty(raw.get(key))
            else:
                out[key] = _clean_entity_id(raw.get(key))

    mode_keys = (
        CONF_GRID_SENSOR_MODE,
        CONF_BATTERY_SENSOR_MODE,
    )
    for key in mode_keys:
        if key in raw:
            default = DEFAULT_GRID_SENSOR_MODE if key == CONF_GRID_SENSOR_MODE else DEFAULT_BATTERY_SENSOR_MODE
            out[key] = _normalize_sensor_mode(raw.get(key), default)

    bool_keys = (
        CONF_USE_SIGNED_BATTERY_POWER,
        CONF_INVERT_BATTERY_POWER_SIGN,
        CONF_INVERT_LOAD_POWER_SIGN,
    )
    for key in bool_keys:
        if key in raw:
            out[key] = bool(raw.get(key))

    if CONF_BATTERY_CAPACITY_KWH in raw:
        out[CONF_BATTERY_CAPACITY_KWH] = _coerce_float(raw.get(CONF_BATTERY_CAPACITY_KWH), 0.1, 1000.0)
    if CONF_BATTERY_RESERVE_SOC in raw:
        out[CONF_BATTERY_RESERVE_SOC] = _coerce_float(raw.get(CONF_BATTERY_RESERVE_SOC), 0.0, 99.0)
    if CONF_BATTERY_MAX_CHARGE_SOC in raw:
        out[CONF_BATTERY_MAX_CHARGE_SOC] = _coerce_float(raw.get(CONF_BATTERY_MAX_CHARGE_SOC), 1.0, 100.0)

    raw_sensors = raw.get(CONF_SENSORS)
    if isinstance(raw_sensors, dict):
        sensors: dict[str, str | None] = {}
        for key in DEFAULT_SENSORS:
            if key in raw_sensors:
                sensors[key] = _clean_entity_id(raw_sensors.get(key))
        out[CONF_SENSORS] = sensors

    raw_price_sensors = raw.get(CONF_PRICE_SENSORS)
    if isinstance(raw_price_sensors, dict):
        price_sensors: dict[str, str | None] = {}
        for key in DEFAULT_PRICE_SENSORS:
            if key in raw_price_sensors:
                price_sensors[key] = _clean_entity_id(raw_price_sensors.get(key))
        out[CONF_PRICE_SENSORS] = price_sensors

    if CONF_EXTRA_CHIPS in raw and isinstance(raw.get(CONF_EXTRA_CHIPS), list):
        chips: list[dict[str, str]] = []
        for item in raw.get(CONF_EXTRA_CHIPS) or []:
            if not isinstance(item, dict):
                continue
            try:
                key = cv.slug(item.get("key"))
            except vol.Invalid:
                continue
            label = _clean_non_empty(item.get("label"))
            entity = _clean_entity_id(item.get("entity"))
            accent = _clean_non_empty(item.get("accent"))
            if not label or not entity:
                continue
            chip: dict[str, str] = {"key": key, "label": label, "entity": entity}
            if accent:
                chip["accent"] = accent
            chips.append(chip)
        out[CONF_EXTRA_CHIPS] = chips

    return out


def _merge_conf_with_ui(base_conf: dict[str, Any], ui_cfg: dict[str, Any]) -> dict[str, Any]:
    """Merge backend-synced UI overrides on top of base YAML/runtime config."""
    merged = copy.deepcopy(base_conf)
    if not isinstance(ui_cfg, dict) or not ui_cfg:
        return merged

    direct_keys = (
        CONF_BACKGROUND_IMAGE,
        CONF_WEATHER_ENTITY,
        CONF_WEATHER_LOCATION,
        CONF_PRICE_ENTITY,
        CONF_PRICE_FALLBACK_ENTITY,
        CONF_TIBBER_HOME_ID,
        CONF_USE_SIGNED_BATTERY_POWER,
        CONF_INVERT_BATTERY_POWER_SIGN,
        CONF_INVERT_LOAD_POWER_SIGN,
        CONF_BATTERY_CAPACITY_KWH,
        CONF_BATTERY_RESERVE_SOC,
        CONF_BATTERY_MAX_CHARGE_SOC,
        CONF_GRID_SENSOR_MODE,
        CONF_BATTERY_SENSOR_MODE,
    )
    for key in direct_keys:
        if key in ui_cfg:
            merged[key] = ui_cfg.get(key)

    if "title" in ui_cfg:
        merged["title"] = ui_cfg.get("title")

    if isinstance(ui_cfg.get(CONF_SENSORS), dict):
        merged_sensors = {
            **DEFAULT_SENSORS,
            **(merged.get(CONF_SENSORS) or {}),
        }
        merged_sensors.update(ui_cfg[CONF_SENSORS])
        merged[CONF_SENSORS] = merged_sensors

    if isinstance(ui_cfg.get(CONF_PRICE_SENSORS), dict):
        merged_price_sensors = {
            **DEFAULT_PRICE_SENSORS,
            **(merged.get(CONF_PRICE_SENSORS) or {}),
        }
        merged_price_sensors.update(ui_cfg[CONF_PRICE_SENSORS])
        merged[CONF_PRICE_SENSORS] = merged_price_sensors

    if isinstance(ui_cfg.get(CONF_EXTRA_CHIPS), list):
        merged[CONF_EXTRA_CHIPS] = ui_cfg[CONF_EXTRA_CHIPS]

    return merged


def _build_effective_config(
    base_conf: dict[str, Any],
    runtime_token: str | None,
    runtime_home_id: str | None,
    ui_cfg: dict[str, Any],
) -> dict[str, Any]:
    """Build effective runtime config = YAML + secure runtime + UI overrides."""
    conf_effective = copy.deepcopy(base_conf)

    yaml_token = _clean_non_empty(
        conf_effective.get(CONF_TIBBER_API_TOKEN) or conf_effective.get(CONF_TIBBER_API_KEY)
    )
    effective_token = yaml_token or runtime_token
    if effective_token:
        conf_effective[CONF_TIBBER_API_TOKEN] = effective_token
    else:
        conf_effective.pop(CONF_TIBBER_API_TOKEN, None)
    conf_effective.pop(CONF_TIBBER_API_KEY, None)

    yaml_home_id = _clean_non_empty(conf_effective.get(CONF_TIBBER_HOME_ID))
    effective_home_id = runtime_home_id or yaml_home_id
    if effective_home_id:
        conf_effective[CONF_TIBBER_HOME_ID] = effective_home_id
    else:
        conf_effective.pop(CONF_TIBBER_HOME_ID, None)

    conf_effective = _merge_conf_with_ui(conf_effective, ui_cfg)

    if CONF_SENSORS not in conf_effective or not isinstance(conf_effective.get(CONF_SENSORS), dict):
        conf_effective[CONF_SENSORS] = copy.deepcopy(DEFAULT_SENSORS)
    if CONF_PRICE_SENSORS not in conf_effective or not isinstance(conf_effective.get(CONF_PRICE_SENSORS), dict):
        conf_effective[CONF_PRICE_SENSORS] = copy.deepcopy(DEFAULT_PRICE_SENSORS)
    if CONF_EXTRA_CHIPS not in conf_effective or not isinstance(conf_effective.get(CONF_EXTRA_CHIPS), list):
        conf_effective[CONF_EXTRA_CHIPS] = []

    conf_effective[CONF_GRID_SENSOR_MODE] = _normalize_sensor_mode(
        conf_effective.get(CONF_GRID_SENSOR_MODE),
        DEFAULT_GRID_SENSOR_MODE,
    )
    conf_effective[CONF_BATTERY_SENSOR_MODE] = _normalize_sensor_mode(
        conf_effective.get(CONF_BATTERY_SENSOR_MODE),
        DEFAULT_BATTERY_SENSOR_MODE,
    )
    conf_effective[CONF_USE_SIGNED_BATTERY_POWER] = bool(
        conf_effective.get(CONF_USE_SIGNED_BATTERY_POWER, DEFAULT_USE_SIGNED_BATTERY_POWER)
    )
    conf_effective[CONF_INVERT_BATTERY_POWER_SIGN] = bool(
        conf_effective.get(CONF_INVERT_BATTERY_POWER_SIGN, DEFAULT_INVERT_BATTERY_POWER_SIGN)
    )
    conf_effective[CONF_INVERT_LOAD_POWER_SIGN] = bool(
        conf_effective.get(CONF_INVERT_LOAD_POWER_SIGN, DEFAULT_INVERT_LOAD_POWER_SIGN)
    )

    reserve = _coerce_float(conf_effective.get(CONF_BATTERY_RESERVE_SOC), 0.0, 99.0)
    conf_effective[CONF_BATTERY_RESERVE_SOC] = (
        DEFAULT_BATTERY_RESERVE_SOC if reserve is None else reserve
    )
    target = _coerce_float(conf_effective.get(CONF_BATTERY_MAX_CHARGE_SOC), 1.0, 100.0)
    conf_effective[CONF_BATTERY_MAX_CHARGE_SOC] = (
        DEFAULT_BATTERY_MAX_CHARGE_SOC if target is None else target
    )
    capacity = _coerce_float(conf_effective.get(CONF_BATTERY_CAPACITY_KWH), 0.1, 1000.0)
    conf_effective[CONF_BATTERY_CAPACITY_KWH] = capacity

    title = _clean_non_empty(conf_effective.get("title"))
    if title:
        conf_effective["title"] = title
    else:
        conf_effective.pop("title", None)

    return conf_effective


def _resolve_price_entity(conf_effective: dict[str, Any]) -> str | None:
    """Resolve active price entity from config."""
    if conf_effective.get(CONF_TIBBER_API_TOKEN):
        return ENTITY_TIBBER_API_PRICE
    return conf_effective.get(CONF_PRICE_FALLBACK_ENTITY) or conf_effective.get(CONF_PRICE_ENTITY)


def _resolve_weather_entity(conf_effective: dict[str, Any]) -> str | None:
    """Resolve active weather entity from config."""
    weather_entity = conf_effective.get(CONF_WEATHER_ENTITY)
    weather_location = conf_effective.get(CONF_WEATHER_LOCATION)
    if not weather_entity and isinstance(weather_location, str) and weather_location.strip():
        return ENTITY_OPEN_METEO_WEATHER
    return weather_entity


def _build_panel_config(conf_effective: dict[str, Any]) -> dict[str, Any]:
    """Build panel config sent to the frontend web component."""
    return {
        "title": conf_effective.get("title") or conf_effective[CONF_SIDEBAR_TITLE],
        "sensors": conf_effective.get(CONF_SENSORS, DEFAULT_SENSORS),
        "price_sensors": conf_effective.get(CONF_PRICE_SENSORS, DEFAULT_PRICE_SENSORS),
        "weather_entity": _resolve_weather_entity(conf_effective),
        "weather_location": conf_effective.get(CONF_WEATHER_LOCATION),
        "background_image": conf_effective.get(CONF_BACKGROUND_IMAGE),
        "price_entity": _resolve_price_entity(conf_effective),
        "price_fallback_entity": conf_effective.get(CONF_PRICE_FALLBACK_ENTITY),
        "extra_chips": conf_effective.get(CONF_EXTRA_CHIPS, []),
        "use_signed_battery_power": conf_effective.get(
            CONF_USE_SIGNED_BATTERY_POWER,
            DEFAULT_USE_SIGNED_BATTERY_POWER,
        ),
        "invert_battery_power_sign": conf_effective.get(
            CONF_INVERT_BATTERY_POWER_SIGN,
            DEFAULT_INVERT_BATTERY_POWER_SIGN,
        ),
        "invert_load_power_sign": conf_effective.get(
            CONF_INVERT_LOAD_POWER_SIGN,
            DEFAULT_INVERT_LOAD_POWER_SIGN,
        ),
        "battery_capacity_kwh": conf_effective.get(CONF_BATTERY_CAPACITY_KWH),
        "battery_reserve_soc": conf_effective.get(
            CONF_BATTERY_RESERVE_SOC,
            DEFAULT_BATTERY_RESERVE_SOC,
        ),
        "battery_max_charge_soc": conf_effective.get(
            CONF_BATTERY_MAX_CHARGE_SOC,
            DEFAULT_BATTERY_MAX_CHARGE_SOC,
        ),
        "grid_sensor_mode": conf_effective.get(CONF_GRID_SENSOR_MODE, DEFAULT_GRID_SENSOR_MODE),
        "battery_sensor_mode": conf_effective.get(CONF_BATTERY_SENSOR_MODE, DEFAULT_BATTERY_SENSOR_MODE),
        "tibber_home_id": conf_effective.get(CONF_TIBBER_HOME_ID),
        "tibber_token_configured": bool(conf_effective.get(CONF_TIBBER_API_TOKEN)),
    }


class _UiConfigView(HomeAssistantView):
    """Read-only API endpoint for backend-synced panel UI settings."""

    url = f"/api/{DOMAIN}/ui_config"
    name = f"api:{DOMAIN}:ui_config"
    requires_auth = True

    async def get(self, request):
        """Return normalized UI overrides from backend storage/runtime."""
        hass: HomeAssistant = request.app["hass"]
        runtime = hass.data.get(DOMAIN, {})
        ui_cfg = runtime.get(DATA_UI_SETTINGS)
        if not isinstance(ui_cfg, dict):
            ui_cfg = {}
        return self.json({"config": ui_cfg})


_OPTIONAL_ENTITY_SCHEMA = vol.Any(None, cv.entity_id)

_SENSOR_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_SOLAR_POWER, default=DEFAULT_SENSORS[CONF_SOLAR_POWER]): cv.entity_id,
        vol.Optional(CONF_LOAD_POWER, default=DEFAULT_SENSORS[CONF_LOAD_POWER]): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(CONF_GRID_POWER, default=DEFAULT_SENSORS[CONF_GRID_POWER]): cv.entity_id,
        vol.Optional(
            CONF_GRID_IMPORT_POWER, default=DEFAULT_SENSORS[CONF_GRID_IMPORT_POWER]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_GRID_EXPORT_POWER, default=DEFAULT_SENSORS[CONF_GRID_EXPORT_POWER]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(CONF_BATTERY_POWER, default=DEFAULT_SENSORS[CONF_BATTERY_POWER]): cv.entity_id,
        vol.Optional(
            CONF_BATTERY_CHARGE_POWER,
            default=DEFAULT_SENSORS[CONF_BATTERY_CHARGE_POWER],
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_BATTERY_DISCHARGE_POWER,
            default=DEFAULT_SENSORS[CONF_BATTERY_DISCHARGE_POWER],
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(CONF_BATTERY_SOC, default=DEFAULT_SENSORS[CONF_BATTERY_SOC]): cv.entity_id,
    }
)

_PRICE_SENSOR_SCHEMA = vol.Schema(
    {
        vol.Optional(
            CONF_PRICE_CURRENT, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_CURRENT]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_PRICE_NEXT_1H, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_NEXT_1H]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_PRICE_NEXT_2H, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_NEXT_2H]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_PRICE_NEXT_3H, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_NEXT_3H]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_PRICE_NEXT_4H, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_NEXT_4H]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_PRICE_NEXT_5H, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_NEXT_5H]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_PRICE_MIN_TODAY, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_MIN_TODAY]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(
            CONF_PRICE_MAX_TODAY, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_MAX_TODAY]
        ): _OPTIONAL_ENTITY_SCHEMA,
        vol.Optional(CONF_PRICE_LEVEL, default=DEFAULT_PRICE_SENSORS[CONF_PRICE_LEVEL]): _OPTIONAL_ENTITY_SCHEMA,
    }
)

_EXTRA_CHIP_SCHEMA = vol.Schema(
    {
        vol.Required("key"): cv.slug,
        vol.Required("label"): cv.string,
        vol.Required("entity"): cv.entity_id,
        vol.Optional("accent"): cv.string,
    }
)

_SENSOR_MODE_SCHEMA = vol.In(["auto", "signed", "dual"])

CONFIG_SCHEMA = vol.Schema(
    {
        DOMAIN: vol.Schema(
            {
                vol.Optional(CONF_SIDEBAR_TITLE, default=SIDEBAR_TITLE_DEFAULT): cv.string,
                vol.Optional(CONF_SIDEBAR_ICON, default=SIDEBAR_ICON_DEFAULT): cv.icon,
                vol.Optional(CONF_URL_PATH, default=PANEL_URL_PATH_DEFAULT): cv.string,
                vol.Optional(CONF_REQUIRE_ADMIN, default=False): cv.boolean,
                vol.Optional(CONF_WEATHER_ENTITY): cv.entity_id,
                vol.Optional(CONF_WEATHER_LOCATION): cv.string,
                vol.Optional(CONF_BACKGROUND_IMAGE): cv.string,
                vol.Optional(CONF_PRICE_ENTITY): cv.entity_id,
                vol.Optional(CONF_PRICE_FALLBACK_ENTITY): cv.entity_id,
                vol.Optional(CONF_TIBBER_API_TOKEN): cv.string,
                vol.Optional(CONF_TIBBER_API_KEY): cv.string,
                vol.Optional(CONF_TIBBER_HOME_ID): cv.string,
                vol.Optional(
                    CONF_USE_SIGNED_BATTERY_POWER,
                    default=DEFAULT_USE_SIGNED_BATTERY_POWER,
                ): cv.boolean,
                vol.Optional(
                    CONF_INVERT_BATTERY_POWER_SIGN,
                    default=DEFAULT_INVERT_BATTERY_POWER_SIGN,
                ): cv.boolean,
                vol.Optional(
                    CONF_INVERT_LOAD_POWER_SIGN,
                    default=DEFAULT_INVERT_LOAD_POWER_SIGN,
                ): cv.boolean,
                vol.Optional(CONF_BATTERY_CAPACITY_KWH): vol.All(
                    vol.Coerce(float), vol.Range(min=0.1, max=1000.0)
                ),
                vol.Optional(
                    CONF_BATTERY_RESERVE_SOC,
                    default=DEFAULT_BATTERY_RESERVE_SOC,
                ): vol.All(vol.Coerce(float), vol.Range(min=0.0, max=99.0)),
                vol.Optional(
                    CONF_BATTERY_MAX_CHARGE_SOC,
                    default=DEFAULT_BATTERY_MAX_CHARGE_SOC,
                ): vol.All(vol.Coerce(float), vol.Range(min=1.0, max=100.0)),
                vol.Optional(
                    CONF_GRID_SENSOR_MODE,
                    default=DEFAULT_GRID_SENSOR_MODE,
                ): _SENSOR_MODE_SCHEMA,
                vol.Optional(
                    CONF_BATTERY_SENSOR_MODE,
                    default=DEFAULT_BATTERY_SENSOR_MODE,
                ): _SENSOR_MODE_SCHEMA,
                vol.Optional(
                    CONF_PRICE_SENSORS, default=DEFAULT_PRICE_SENSORS
                ): _PRICE_SENSOR_SCHEMA,
                vol.Optional(CONF_EXTRA_CHIPS, default=[]): vol.All(
                    cv.ensure_list, [_EXTRA_CHIP_SCHEMA]
                ),
                vol.Optional(CONF_SENSORS, default=DEFAULT_SENSORS): _SENSOR_SCHEMA,
            }
        )
    },
    extra=vol.ALLOW_EXTRA,
)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up the panel from YAML."""
    conf = config.get(DOMAIN)
    if conf is None:
        return True

    static_dir = Path(__file__).parent / "frontend"
    if hasattr(hass.http, "async_register_static_paths"):
        await hass.http.async_register_static_paths(
            [StaticPathConfig(PANEL_STATIC_PATH, str(static_dir), cache_headers=False)]
        )
    else:
        hass.http.register_static_path(
            PANEL_STATIC_PATH, str(static_dir), cache_headers=False
        )

    module_file = static_dir / PANEL_MODULE_FILE
    module_version = "0"
    try:
        stat = module_file.stat()
        # Use nanoseconds + file size to force robust cache busting,
        # especially for mobile app webviews that cache aggressively.
        module_version = f"{int(stat.st_mtime_ns)}-{int(stat.st_size)}"
    except OSError:
        module_version = "0"
    module_url = f"{PANEL_STATIC_PATH}/{PANEL_MODULE_FILE}?v={module_version}"

    runtime_store: Store[dict[str, str]] = Store(hass, 1, STORAGE_KEY_RUNTIME_SETTINGS)
    runtime_settings = await runtime_store.async_load() or {}
    runtime_token = _clean_non_empty(
        runtime_settings.get(CONF_TIBBER_API_TOKEN) or runtime_settings.get(CONF_TIBBER_API_KEY)
    )
    runtime_home_id = _clean_non_empty(runtime_settings.get(CONF_TIBBER_HOME_ID))

    ui_store: Store[dict[str, Any]] = Store(hass, 1, STORAGE_KEY_UI_SETTINGS)
    runtime_ui_raw = await ui_store.async_load() or {}
    runtime_ui = _normalize_ui_config(runtime_ui_raw)
    if runtime_ui != runtime_ui_raw:
        await ui_store.async_save(runtime_ui)

    base_conf = copy.deepcopy(conf)
    conf_effective = _build_effective_config(base_conf, runtime_token, runtime_home_id, runtime_ui)
    panel_config = _build_panel_config(conf_effective)

    await panel_custom.async_register_panel(
        hass=hass,
        frontend_url_path=conf_effective[CONF_URL_PATH],
        webcomponent_name=PANEL_ELEMENT_NAME,
        sidebar_title=conf_effective[CONF_SIDEBAR_TITLE],
        sidebar_icon=conf_effective[CONF_SIDEBAR_ICON],
        module_url=module_url,
        require_admin=conf_effective[CONF_REQUIRE_ADMIN],
        config=panel_config,
    )

    runtime = hass.data.setdefault(DOMAIN, {})
    runtime[DATA_CONFIG] = conf_effective
    runtime[DATA_BASE_CONFIG] = base_conf
    runtime[DATA_PANEL_CONFIG] = panel_config
    runtime[DATA_RUNTIME_SETTINGS_STORE] = runtime_store
    runtime[DATA_UI_SETTINGS_STORE] = ui_store
    runtime[DATA_UI_SETTINGS] = runtime_ui

    hass.http.register_view(_UiConfigView())

    if not runtime.get(DATA_LIFETIME_PLATFORM_LOADED):
        loaded = False
        if _async_load_platform is not None:
            try:
                await _async_load_platform(hass, "sensor", DOMAIN, {}, config)
                loaded = True
            except Exception:
                _LOGGER.exception("Sensor platform loader failed for %s", DOMAIN)
                loaded = False
        else:
            _LOGGER.error("homeassistant.helpers.discovery.async_load_platform not available")

        runtime[DATA_LIFETIME_PLATFORM_LOADED] = loaded
        _LOGGER.info("Lifetime sensor platform loaded: %s", loaded)

    if not hass.services.has_service(DOMAIN, SERVICE_RESET_LIFETIME_SAVINGS):
        async def _handle_reset_lifetime(_: object) -> None:
            accumulator = hass.data.get(DOMAIN, {}).get(DATA_LIFETIME_ACCUMULATOR)
            if accumulator and hasattr(accumulator, "async_reset"):
                await accumulator.async_reset()

        hass.services.async_register(
            DOMAIN,
            SERVICE_RESET_LIFETIME_SAVINGS,
            _handle_reset_lifetime,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_TIBBER_CREDENTIALS):

        async def _handle_set_tibber_credentials(call: ServiceCall) -> None:
            runtime_local = hass.data.get(DOMAIN, {})
            conf_local = runtime_local.get(DATA_CONFIG)
            if not isinstance(conf_local, dict):
                return

            token = _clean_non_empty(call.data.get("token"))
            home_id = _clean_non_empty(call.data.get("home_id"))
            clear_token = bool(call.data.get("clear_token"))

            if clear_token:
                conf_local.pop(CONF_TIBBER_API_TOKEN, None)
            elif token:
                conf_local[CONF_TIBBER_API_TOKEN] = token

            if "home_id" in call.data:
                if home_id:
                    conf_local[CONF_TIBBER_HOME_ID] = home_id
                else:
                    conf_local.pop(CONF_TIBBER_HOME_ID, None)

            store_local = runtime_local.get(DATA_RUNTIME_SETTINGS_STORE)
            if isinstance(store_local, Store):
                payload: dict[str, str] = {}
                effective_token_local = _clean_non_empty(conf_local.get(CONF_TIBBER_API_TOKEN))
                effective_home_local = _clean_non_empty(conf_local.get(CONF_TIBBER_HOME_ID))
                if effective_token_local:
                    payload[CONF_TIBBER_API_TOKEN] = effective_token_local
                if effective_home_local:
                    payload[CONF_TIBBER_HOME_ID] = effective_home_local
                await store_local.async_save(payload)

            panel_local = runtime_local.get(DATA_PANEL_CONFIG)
            if isinstance(panel_local, dict):
                panel_local.clear()
                panel_local.update(_build_panel_config(conf_local))

            hass.async_create_task(
                hass.services.async_call(
                    "homeassistant",
                    "update_entity",
                    {
                        "entity_id": [
                            ENTITY_TIBBER_API_PRICE,
                            ENTITY_TIBBER_API_GRID_POWER,
                        ]
                    },
                    blocking=False,
                )
            )

        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_TIBBER_CREDENTIALS,
            _handle_set_tibber_credentials,
            schema=vol.Schema(
                {
                    vol.Optional("token"): vol.Any(None, cv.string),
                    vol.Optional("home_id"): vol.Any(None, cv.string),
                    vol.Optional("clear_token", default=False): cv.boolean,
                }
            ),
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SET_UI_CONFIG):

        async def _handle_set_ui_config(call: ServiceCall) -> None:
            runtime_local = hass.data.get(DOMAIN, {})
            conf_local = runtime_local.get(DATA_CONFIG)
            base_conf_local = runtime_local.get(DATA_BASE_CONFIG)
            if not isinstance(conf_local, dict) or not isinstance(base_conf_local, dict):
                return

            reset = bool(call.data.get("reset"))
            raw_cfg = call.data.get("config")
            ui_cfg = {} if reset else _normalize_ui_config(raw_cfg)

            store_local = runtime_local.get(DATA_UI_SETTINGS_STORE)
            if isinstance(store_local, Store):
                await store_local.async_save(ui_cfg)
            runtime_local[DATA_UI_SETTINGS] = ui_cfg

            runtime_token_local = _clean_non_empty(
                conf_local.get(CONF_TIBBER_API_TOKEN) or conf_local.get(CONF_TIBBER_API_KEY)
            )
            runtime_home_local = _clean_non_empty(conf_local.get(CONF_TIBBER_HOME_ID))
            effective = _build_effective_config(
                base_conf_local,
                runtime_token_local,
                runtime_home_local,
                ui_cfg,
            )

            conf_local.clear()
            conf_local.update(effective)

            panel_local = runtime_local.get(DATA_PANEL_CONFIG)
            if isinstance(panel_local, dict):
                panel_local.clear()
                panel_local.update(_build_panel_config(conf_local))

        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_UI_CONFIG,
            _handle_set_ui_config,
            schema=vol.Schema(
                {
                    vol.Optional("config"): vol.Any(None, dict),
                    vol.Optional("reset", default=False): cv.boolean,
                }
            ),
        )

    return True
