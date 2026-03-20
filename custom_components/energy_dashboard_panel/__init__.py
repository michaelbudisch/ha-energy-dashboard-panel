"""Custom panel integration for a solar+battery energy dashboard."""

from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.components import panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
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
    CONF_TIBBER_API_TOKEN,
    CONF_TIBBER_HOME_ID,
    CONF_URL_PATH,
    CONF_USE_SIGNED_BATTERY_POWER,
    CONF_WEATHER_ENTITY,
    CONF_WEATHER_LOCATION,
    DATA_CONFIG,
    DATA_LIFETIME_ACCUMULATOR,
    DATA_LIFETIME_PLATFORM_LOADED,
    DEFAULT_BATTERY_SENSOR_MODE,
    DEFAULT_GRID_SENSOR_MODE,
    DEFAULT_INVERT_BATTERY_POWER_SIGN,
    DEFAULT_INVERT_LOAD_POWER_SIGN,
    DEFAULT_PRICE_SENSORS,
    DEFAULT_SENSORS,
    DEFAULT_USE_SIGNED_BATTERY_POWER,
    DOMAIN,
    ENTITY_OPEN_METEO_WEATHER,
    ENTITY_TIBBER_API_PRICE,
    PANEL_ELEMENT_NAME,
    PANEL_MODULE_FILE,
    PANEL_STATIC_PATH,
    PANEL_URL_PATH_DEFAULT,
    SERVICE_RESET_LIFETIME_SAVINGS,
    SIDEBAR_ICON_DEFAULT,
    SIDEBAR_TITLE_DEFAULT,
)


_LOGGER = logging.getLogger(__name__)


_OPTIONAL_ENTITY_SCHEMA = vol.Any(None, cv.entity_id)

_SENSOR_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_SOLAR_POWER, default=DEFAULT_SENSORS[CONF_SOLAR_POWER]): cv.entity_id,
        vol.Optional(CONF_LOAD_POWER, default=DEFAULT_SENSORS[CONF_LOAD_POWER]): cv.entity_id,
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

    module_url = f"{PANEL_STATIC_PATH}/{PANEL_MODULE_FILE}"
    price_entity = None
    if conf.get(CONF_TIBBER_API_TOKEN):
        price_entity = ENTITY_TIBBER_API_PRICE
    else:
        price_entity = conf.get(CONF_PRICE_FALLBACK_ENTITY) or conf.get(CONF_PRICE_ENTITY)

    weather_entity = conf.get(CONF_WEATHER_ENTITY)
    weather_location = conf.get(CONF_WEATHER_LOCATION)
    if not weather_entity and isinstance(weather_location, str) and weather_location.strip():
        weather_entity = ENTITY_OPEN_METEO_WEATHER

    panel_config = {
        "title": conf[CONF_SIDEBAR_TITLE],
        "sensors": conf[CONF_SENSORS],
        "weather_entity": weather_entity,
        "weather_location": weather_location,
        "background_image": conf.get(CONF_BACKGROUND_IMAGE),
        "price_entity": price_entity,
        "price_fallback_entity": conf.get(CONF_PRICE_FALLBACK_ENTITY),
        "extra_chips": conf.get(CONF_EXTRA_CHIPS, []),
        "use_signed_battery_power": conf.get(
            CONF_USE_SIGNED_BATTERY_POWER,
            DEFAULT_USE_SIGNED_BATTERY_POWER,
        ),
        "invert_battery_power_sign": conf.get(
            CONF_INVERT_BATTERY_POWER_SIGN,
            DEFAULT_INVERT_BATTERY_POWER_SIGN,
        ),
        "invert_load_power_sign": conf.get(
            CONF_INVERT_LOAD_POWER_SIGN,
            DEFAULT_INVERT_LOAD_POWER_SIGN,
        ),
        "grid_sensor_mode": conf.get(CONF_GRID_SENSOR_MODE, DEFAULT_GRID_SENSOR_MODE),
        "battery_sensor_mode": conf.get(CONF_BATTERY_SENSOR_MODE, DEFAULT_BATTERY_SENSOR_MODE),
    }

    await panel_custom.async_register_panel(
        hass=hass,
        frontend_url_path=conf[CONF_URL_PATH],
        webcomponent_name=PANEL_ELEMENT_NAME,
        sidebar_title=conf[CONF_SIDEBAR_TITLE],
        sidebar_icon=conf[CONF_SIDEBAR_ICON],
        module_url=module_url,
        require_admin=conf[CONF_REQUIRE_ADMIN],
        config=panel_config,
    )

    runtime = hass.data.setdefault(DOMAIN, {})
    runtime[DATA_CONFIG] = conf

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

    return True
