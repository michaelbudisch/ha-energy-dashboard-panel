"""Constants for the Energy Dashboard Panel integration."""

from __future__ import annotations

DOMAIN = "energy_dashboard_panel"
PANEL_ELEMENT_NAME = "ha-energy-dashboard-panel"
PANEL_MODULE_FILE = "energy-dashboard-panel.js"
PANEL_STATIC_PATH = f"/{DOMAIN}_panel"
PANEL_URL_PATH_DEFAULT = "energy-dashboard"
SIDEBAR_TITLE_DEFAULT = "Energie"
SIDEBAR_ICON_DEFAULT = "mdi:solar-power-variant"
STORAGE_VERSION = 1
STORAGE_KEY_LIFETIME = f"{DOMAIN}_lifetime"
STORAGE_KEY_RUNTIME_SETTINGS = f"{DOMAIN}_runtime_settings"
STORAGE_KEY_UI_SETTINGS = f"{DOMAIN}_ui_settings"

DATA_CONFIG = "config"
DATA_BASE_CONFIG = "base_config"
DATA_PANEL_CONFIG = "panel_config"
DATA_LIFETIME_ACCUMULATOR = "lifetime_accumulator"
DATA_LIFETIME_PLATFORM_LOADED = "lifetime_platform_loaded"
DATA_RUNTIME_SETTINGS_STORE = "runtime_settings_store"
DATA_UI_SETTINGS = "ui_settings"
DATA_UI_SETTINGS_STORE = "ui_settings_store"

SERVICE_RESET_LIFETIME_SAVINGS = "reset_lifetime_savings"
SERVICE_SET_TIBBER_CREDENTIALS = "set_tibber_credentials"
SERVICE_SET_UI_CONFIG = "set_ui_config"

ENTITY_LIFETIME_SMART_SAVINGS_EUR = f"sensor.{DOMAIN}_lifetime_smart_savings_eur"
ENTITY_LIFETIME_SOLAR_DIRECT_EUR = f"sensor.{DOMAIN}_lifetime_solar_direct_savings_eur"
ENTITY_LIFETIME_NON_GRID_EUR = f"sensor.{DOMAIN}_lifetime_non_grid_value_eur"
ENTITY_LIFETIME_BATTERY_ARBITRAGE_EUR = f"sensor.{DOMAIN}_lifetime_battery_arbitrage_eur"
ENTITY_LIFETIME_BATTERY_SHIFT_KWH = f"sensor.{DOMAIN}_lifetime_battery_shift_kwh"
ENTITY_TIBBER_API_PRICE = f"sensor.{DOMAIN}_tibber_price"
ENTITY_TIBBER_API_GRID_POWER = f"sensor.{DOMAIN}_tibber_grid_power"
ENTITY_OPEN_METEO_WEATHER = f"sensor.{DOMAIN}_open_meteo_weather"
ENTITY_RESOLVED_LOAD_POWER = f"sensor.{DOMAIN}_resolved_load_power"
ENTITY_BALANCE_ERROR_W = f"sensor.{DOMAIN}_balance_error_w"
ENTITY_BALANCE_QUALITY_PCT = f"sensor.{DOMAIN}_balance_quality_pct"
ENTITY_PRICE_BACKFILL_PENDING = f"sensor.{DOMAIN}_price_backfill_pending"

CONF_SENSORS = "sensors"
CONF_SOLAR_POWER = "solar_power"
CONF_LOAD_POWER = "load_power"
CONF_GRID_POWER = "grid_power"
CONF_GRID_IMPORT_POWER = "grid_import_power"
CONF_GRID_EXPORT_POWER = "grid_export_power"
CONF_BATTERY_POWER = "battery_power"
CONF_BATTERY_CHARGE_POWER = "battery_charge_power"
CONF_BATTERY_DISCHARGE_POWER = "battery_discharge_power"
CONF_BATTERY_SOC = "battery_soc"

CONF_SIDEBAR_TITLE = "sidebar_title"
CONF_SIDEBAR_ICON = "sidebar_icon"
CONF_URL_PATH = "url_path"
CONF_REQUIRE_ADMIN = "require_admin"
CONF_WEATHER_ENTITY = "weather_entity"
CONF_WEATHER_LOCATION = "weather_location"
CONF_BACKGROUND_IMAGE = "background_image"
CONF_PRICE_ENTITY = "price_entity"
CONF_PRICE_FALLBACK_ENTITY = "price_fallback_entity"
CONF_TIBBER_API_TOKEN = "tibber_api_token"
CONF_TIBBER_API_KEY = "tibber_api_key"
CONF_TIBBER_HOME_ID = "tibber_home_id"
CONF_EXTRA_CHIPS = "extra_chips"
CONF_USE_SIGNED_BATTERY_POWER = "use_signed_battery_power"
CONF_INVERT_BATTERY_POWER_SIGN = "invert_battery_power_sign"
CONF_INVERT_LOAD_POWER_SIGN = "invert_load_power_sign"
CONF_BATTERY_CAPACITY_KWH = "battery_capacity_kwh"
CONF_BATTERY_RESERVE_SOC = "battery_reserve_soc"
CONF_BATTERY_MAX_CHARGE_SOC = "battery_max_charge_soc"
CONF_GRID_SENSOR_MODE = "grid_sensor_mode"
CONF_BATTERY_SENSOR_MODE = "battery_sensor_mode"
CONF_PRICE_SENSORS = "price_sensors"
CONF_PRICE_CURRENT = "current"
CONF_PRICE_NEXT_1H = "next_1h"
CONF_PRICE_NEXT_2H = "next_2h"
CONF_PRICE_NEXT_3H = "next_3h"
CONF_PRICE_NEXT_4H = "next_4h"
CONF_PRICE_NEXT_5H = "next_5h"
CONF_PRICE_MIN_TODAY = "min_today"
CONF_PRICE_MAX_TODAY = "max_today"
CONF_PRICE_LEVEL = "level"

DEFAULT_USE_SIGNED_BATTERY_POWER = False
DEFAULT_INVERT_BATTERY_POWER_SIGN = False
DEFAULT_INVERT_LOAD_POWER_SIGN = False
DEFAULT_BATTERY_RESERVE_SOC = 10.0
DEFAULT_BATTERY_MAX_CHARGE_SOC = 100.0
SENSOR_MODE_AUTO = "auto"
SENSOR_MODE_SIGNED = "signed"
SENSOR_MODE_DUAL = "dual"
DEFAULT_GRID_SENSOR_MODE = SENSOR_MODE_AUTO
DEFAULT_BATTERY_SENSOR_MODE = SENSOR_MODE_AUTO

DEFAULT_SENSORS = {
    CONF_SOLAR_POWER: "sensor.ems_solar_power",
    CONF_LOAD_POWER: None,
    CONF_GRID_POWER: "sensor.ems_grid_power",
    CONF_BATTERY_POWER: "sensor.ems_battery_power",
    CONF_BATTERY_SOC: "sensor.ems_battery_soc",
    CONF_GRID_IMPORT_POWER: None,
    CONF_GRID_EXPORT_POWER: None,
    CONF_BATTERY_CHARGE_POWER: None,
    CONF_BATTERY_DISCHARGE_POWER: None,
}

DEFAULT_PRICE_SENSORS = {
    CONF_PRICE_CURRENT: None,
    CONF_PRICE_NEXT_1H: None,
    CONF_PRICE_NEXT_2H: None,
    CONF_PRICE_NEXT_3H: None,
    CONF_PRICE_NEXT_4H: None,
    CONF_PRICE_NEXT_5H: None,
    CONF_PRICE_MIN_TODAY: None,
    CONF_PRICE_MAX_TODAY: None,
    CONF_PRICE_LEVEL: None,
}
