"""Custom panel integration for a solar+battery energy dashboard."""

from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
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
    DATA_LIFETIME_ACCUMULATOR,
    DATA_LIFETIME_PLATFORM_LOADED,
    DATA_RUNTIME_SETTINGS_STORE,
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
    SIDEBAR_ICON_DEFAULT,
    SIDEBAR_TITLE_DEFAULT,
    STORAGE_KEY_RUNTIME_SETTINGS,
)


_LOGGER = logging.getLogger(__name__)


def _clean_non_empty(raw: object) -> str | None:
    """Normalize text config values to non-empty strings."""
    if not isinstance(raw, str):
        return None
    txt = raw.strip()
    return txt or None


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
        module_version = str(int(module_file.stat().st_mtime))
    except OSError:
        module_version = "0"
    module_url = f"{PANEL_STATIC_PATH}/{PANEL_MODULE_FILE}?v={module_version}"

    runtime_store: Store[dict[str, str]] = Store(hass, 1, STORAGE_KEY_RUNTIME_SETTINGS)
    runtime_settings = await runtime_store.async_load() or {}
    runtime_token = _clean_non_empty(
        runtime_settings.get(CONF_TIBBER_API_TOKEN) or runtime_settings.get(CONF_TIBBER_API_KEY)
    )
    runtime_home_id = _clean_non_empty(runtime_settings.get(CONF_TIBBER_HOME_ID))

    conf_effective = dict(conf)
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
    effective_home_id = yaml_home_id or runtime_home_id
    if effective_home_id:
        conf_effective[CONF_TIBBER_HOME_ID] = effective_home_id
    else:
        conf_effective.pop(CONF_TIBBER_HOME_ID, None)

    price_entity = None
    if conf_effective.get(CONF_TIBBER_API_TOKEN):
        price_entity = ENTITY_TIBBER_API_PRICE
    else:
        price_entity = conf_effective.get(CONF_PRICE_FALLBACK_ENTITY) or conf_effective.get(CONF_PRICE_ENTITY)

    weather_entity = conf_effective.get(CONF_WEATHER_ENTITY)
    weather_location = conf_effective.get(CONF_WEATHER_LOCATION)
    if not weather_entity and isinstance(weather_location, str) and weather_location.strip():
        weather_entity = ENTITY_OPEN_METEO_WEATHER

    panel_config = {
        "title": conf_effective[CONF_SIDEBAR_TITLE],
        "sensors": conf_effective[CONF_SENSORS],
        "weather_entity": weather_entity,
        "weather_location": weather_location,
        "background_image": conf_effective.get(CONF_BACKGROUND_IMAGE),
        "price_entity": price_entity,
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
    runtime[DATA_RUNTIME_SETTINGS_STORE] = runtime_store

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

    return True
