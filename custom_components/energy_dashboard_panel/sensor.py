"""Persistent lifetime savings sensors for the energy dashboard panel."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging
import re
from typing import Any

try:
    from homeassistant.components.sensor import (
        SensorDeviceClass,
        SensorEntity,
        SensorStateClass,
    )
except ImportError:
    from homeassistant.components.sensor import SensorEntity

    SensorDeviceClass = None
    SensorStateClass = None
from homeassistant.const import EVENT_HOMEASSISTANT_STOP, UnitOfEnergy
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.entity import DeviceInfo
try:
    from homeassistant.helpers.entity import EntityCategory
except ImportError:
    EntityCategory = None
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType
from homeassistant.util import dt as dt_util

from .const import (
    ENTITY_BALANCE_ERROR_W,
    ENTITY_BALANCE_QUALITY_PCT,
    ENTITY_PRICE_BACKFILL_PENDING,
    CONF_BATTERY_CHARGE_POWER,
    CONF_BATTERY_DISCHARGE_POWER,
    CONF_BATTERY_SENSOR_MODE,
    CONF_BATTERY_POWER,
    CONF_GRID_EXPORT_POWER,
    CONF_GRID_IMPORT_POWER,
    CONF_GRID_POWER,
    CONF_GRID_SENSOR_MODE,
    CONF_INVERT_BATTERY_POWER_SIGN,
    CONF_INVERT_LOAD_POWER_SIGN,
    CONF_LOAD_POWER,
    CONF_PRICE_CURRENT,
    CONF_PRICE_ENTITY,
    CONF_PRICE_FALLBACK_ENTITY,
    CONF_PRICE_SENSORS,
    CONF_SENSORS,
    CONF_SOLAR_POWER,
    CONF_TIBBER_API_KEY,
    CONF_TIBBER_HOME_ID,
    CONF_TIBBER_API_TOKEN,
    CONF_USE_SIGNED_BATTERY_POWER,
    CONF_WEATHER_LOCATION,
    DEFAULT_BATTERY_SENSOR_MODE,
    DEFAULT_GRID_SENSOR_MODE,
    DATA_CONFIG,
    DATA_LIFETIME_ACCUMULATOR,
    DEFAULT_INVERT_BATTERY_POWER_SIGN,
    DEFAULT_INVERT_LOAD_POWER_SIGN,
    DEFAULT_PRICE_SENSORS,
    DEFAULT_SENSORS,
    DEFAULT_USE_SIGNED_BATTERY_POWER,
    DOMAIN,
    ENTITY_OPEN_METEO_WEATHER,
    ENTITY_RESOLVED_LOAD_POWER,
    ENTITY_TIBBER_API_GRID_POWER,
    ENTITY_TIBBER_API_PRICE,
    ENTITY_LIFETIME_BATTERY_ARBITRAGE_EUR,
    ENTITY_LIFETIME_BATTERY_SHIFT_KWH,
    ENTITY_LIFETIME_NON_GRID_EUR,
    ENTITY_LIFETIME_SMART_SAVINGS_EUR,
    ENTITY_LIFETIME_SOLAR_DIRECT_EUR,
    STORAGE_KEY_LIFETIME,
    STORAGE_VERSION,
)

_UPDATE_INTERVAL = timedelta(seconds=30)
_SAVE_INTERVAL = timedelta(minutes=10)
_TIBBER_API_URL = "https://api.tibber.com/v1-beta/gql"
_TIBBER_LIVE_UPDATE_INTERVAL = timedelta(seconds=20)
_OPEN_METEO_GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
_OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
_MAX_PRICE_CACHE_HOURS = 240
_MAX_PENDING_BUCKETS = 120
_BALANCE_OK_THRESHOLD_W = 50.0
_BALANCE_WARN_THRESHOLD_W = 150.0
SCAN_INTERVAL = timedelta(minutes=5)

_LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class _MetricDef:
    """Description for one exported lifetime metric sensor."""

    key: str
    entity_id: str
    name: str
    icon: str
    unit: str
    precision: int
    device_class: SensorDeviceClass | None = None


_METRICS: tuple[_MetricDef, ...] = (
    _MetricDef(
        key="smart_savings_eur",
        entity_id=ENTITY_LIFETIME_SMART_SAVINGS_EUR,
        name="Gesamtersparnis Smart",
        icon="mdi:cash-multiple",
        unit="EUR",
        precision=2,
        device_class=getattr(SensorDeviceClass, "MONETARY", None),
    ),
    _MetricDef(
        key="solar_direct_savings_eur",
        entity_id=ENTITY_LIFETIME_SOLAR_DIRECT_EUR,
        name="Ersparnis Solar Direkt",
        icon="mdi:white-balance-sunny",
        unit="EUR",
        precision=2,
        device_class=getattr(SensorDeviceClass, "MONETARY", None),
    ),
    _MetricDef(
        key="non_grid_value_eur",
        entity_id=ENTITY_LIFETIME_NON_GRID_EUR,
        name="Wert Nichtbezug",
        icon="mdi:transmission-tower-off",
        unit="EUR",
        precision=2,
        device_class=getattr(SensorDeviceClass, "MONETARY", None),
    ),
    _MetricDef(
        key="battery_arbitrage_eur",
        entity_id=ENTITY_LIFETIME_BATTERY_ARBITRAGE_EUR,
        name="Akku Preisvorteil",
        icon="mdi:battery-sync",
        unit="EUR",
        precision=2,
        device_class=getattr(SensorDeviceClass, "MONETARY", None),
    ),
    _MetricDef(
        key="battery_shift_kwh",
        entity_id=ENTITY_LIFETIME_BATTERY_SHIFT_KWH,
        name="Akku Shift Energie",
        icon="mdi:battery-clock",
        unit=UnitOfEnergy.KILO_WATT_HOUR,
        precision=3,
    ),
)


@dataclass(frozen=True)
class _DiagMetricDef:
    """Description for one exported diagnostic sensor."""

    key: str
    entity_id: str
    name: str
    icon: str
    unit: str | None
    precision: int
    state_class: SensorStateClass | None = None
    device_class: SensorDeviceClass | None = None


_DIAG_METRICS: tuple[_DiagMetricDef, ...] = (
    _DiagMetricDef(
        key="resolved_load_w",
        entity_id=ENTITY_RESOLVED_LOAD_POWER,
        name="Gesamtlast Aufgelöst",
        icon="mdi:home-lightning-bolt",
        unit="W",
        precision=1,
        state_class=getattr(SensorStateClass, "MEASUREMENT", None),
    ),
    _DiagMetricDef(
        key="balance_error_w",
        entity_id=ENTITY_BALANCE_ERROR_W,
        name="Energiebilanz Fehler",
        icon="mdi:scale-unbalanced",
        unit="W",
        precision=1,
        state_class=getattr(SensorStateClass, "MEASUREMENT", None),
    ),
    _DiagMetricDef(
        key="balance_quality_pct",
        entity_id=ENTITY_BALANCE_QUALITY_PCT,
        name="Energiebilanz Qualität",
        icon="mdi:check-decagram",
        unit="%",
        precision=1,
        state_class=getattr(SensorStateClass, "MEASUREMENT", None),
    ),
    _DiagMetricDef(
        key="price_backfill_pending",
        entity_id=ENTITY_PRICE_BACKFILL_PENDING,
        name="Preis Backfill Pending",
        icon="mdi:database-clock",
        unit=None,
        precision=0,
        state_class=None,
    ),
)


def _parse_number(raw: Any) -> float | None:
    """Parse Home Assistant state text to float."""
    if raw is None:
        return None
    txt = str(raw).strip()
    if not txt:
        return None
    if txt.lower() in {"unknown", "unavailable", "none"}:
        return None
    cleaned = re.sub(r"[^\d+\-.,]", "", txt).replace(",", ".")
    if not cleaned:
        return None
    try:
        value = float(cleaned)
    except ValueError:
        return None
    return value if value == value else None


def _normalize_price_unit(unit: str | None) -> str:
    """Normalize price unit labels."""
    raw = (unit or "").strip()
    if not raw:
        return "€/kWh"
    normalized = raw.lower().replace(" ", "")
    if "ct/kwh" in normalized or "¢/kwh" in normalized or "cent/kwh" in normalized:
        return "ct/kWh"
    if "€/kwh" in normalized or "eur/kwh" in normalized or "euro/kwh" in normalized:
        return "€/kWh"
    return raw


def _price_to_eur(value: float | None, unit: str | None) -> float | None:
    """Convert price to EUR/kWh."""
    if value is None:
        return None
    u = _normalize_price_unit(unit).lower()
    if u == "ct/kwh":
        return value / 100
    return value


def _normalize_sensor_mode(raw: Any, default: str) -> str:
    """Normalize grid/battery sensor mode value."""
    txt = str(raw or "").strip().lower()
    if txt in {"auto", "signed", "dual"}:
        return txt
    return default


def _parse_iso_utc(raw: Any) -> datetime | None:
    """Parse ISO timestamp to aware UTC datetime."""
    if raw is None:
        return None
    text = str(raw).strip()
    if not text:
        return None
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _hour_bucket_key(ts: datetime) -> int:
    """Convert a timestamp to an integer UTC hour bucket."""
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    ts_utc = ts.astimezone(timezone.utc)
    return int(ts_utc.timestamp() // 3600)


def _select_tibber_home(homes: Any, home_id: str | None) -> dict[str, Any] | None:
    """Select Tibber home by configured id, else first home."""
    if not isinstance(homes, list) or not homes:
        return None
    if home_id:
        for home in homes:
            if isinstance(home, dict) and str(home.get("id")) == home_id:
                return home
    for home in homes:
        if isinstance(home, dict):
            return home
    return None


def _tibber_credentials(conf: dict[str, Any]) -> tuple[str | None, str | None]:
    """Read Tibber token/home from runtime config."""
    token_raw = conf.get(CONF_TIBBER_API_TOKEN) or conf.get(CONF_TIBBER_API_KEY)
    token = token_raw.strip() if isinstance(token_raw, str) and token_raw.strip() else None
    home_raw = conf.get(CONF_TIBBER_HOME_ID)
    home_id = home_raw.strip() if isinstance(home_raw, str) and home_raw.strip() else None
    return token, home_id


def _open_meteo_condition(
    weather_code_raw: Any,
    is_day_raw: Any,
) -> tuple[str, str, str]:
    """Map Open-Meteo weather code to panel-compatible condition + icon."""
    code = int(_parse_number(weather_code_raw) or -1)
    is_day = int(_parse_number(is_day_raw) or 1) == 1

    if code == 0:
        if is_day:
            return "sunny", "Sonnig", "mdi:weather-sunny"
        return "clear_night", "Klar", "mdi:weather-night"
    if code in {1, 2}:
        return "partlycloudy", "Leicht bewölkt", "mdi:weather-partly-cloudy"
    if code == 3:
        return "cloudy", "Bewölkt", "mdi:weather-cloudy"
    if code in {45, 48}:
        return "fog", "Nebel", "mdi:weather-fog"
    if code in {51, 53, 55, 56, 57}:
        return "rainy", "Nieselregen", "mdi:weather-rainy"
    if code in {61, 63, 66, 67, 80, 81}:
        return "rainy", "Regen", "mdi:weather-rainy"
    if code in {65, 82}:
        return "pouring", "Starker Regen", "mdi:weather-pouring"
    if code in {71, 73, 75, 77, 85, 86}:
        return "snowy", "Schnee", "mdi:weather-snowy"
    if code in {95, 96, 99}:
        if code in {96, 99}:
            return "lightning_rainy", "Gewitter mit Regen", "mdi:weather-lightning-rainy"
        return "lightning", "Gewitter", "mdi:weather-lightning"
    return "partlycloudy", "Unbekannt", "mdi:weather-partly-cloudy"


class _OpenMeteoWeatherSensor(SensorEntity):
    """Simple weather sensor via Open-Meteo (free, no API key)."""

    _attr_has_entity_name = True
    _attr_should_poll = True
    _attr_name = "Wetter (Open-Meteo)"
    _attr_icon = "mdi:weather-partly-cloudy"

    def __init__(self, hass: HomeAssistant, location_query: str) -> None:
        self._hass = hass
        self._location_query = location_query.strip()
        self._location_name = self._location_query
        self._country_code = None
        self._lat: float | None = None
        self._lon: float | None = None
        self._attrs: dict[str, Any] = {}
        self._attr_native_value = "unknown"
        self._attr_available = False

        if "," in self._location_query:
            parts = [part.strip() for part in self._location_query.split(",") if part.strip()]
            if len(parts) >= 2 and len(parts[-1]) == 2 and parts[-1].isalpha():
                self._country_code = parts[-1].upper()
                self._location_query = ", ".join(parts[:-1])

        self.entity_id = ENTITY_OPEN_METEO_WEATHER
        self._attr_unique_id = ENTITY_OPEN_METEO_WEATHER.replace("sensor.", "")
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "open_meteo_weather")},
            name="Energie Dashboard Wetter",
            manufacturer="Open-Meteo",
            model="Forecast API",
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """State attributes with temperature and source metadata."""
        return self._attrs

    async def _async_ensure_coordinates(self, session: Any) -> bool:
        """Resolve city name to coordinates once."""
        if self._lat is not None and self._lon is not None:
            return True

        params: dict[str, Any] = {
            "name": self._location_query,
            "count": 1,
            "language": "de",
            "format": "json",
        }
        if self._country_code:
            params["countryCode"] = self._country_code

        try:
            response = await session.get(_OPEN_METEO_GEOCODE_URL, params=params)
            data = await response.json(content_type=None)
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("Open-Meteo geocoding failed: %s", err)
            return False

        results = data.get("results") if isinstance(data, dict) else None
        if not isinstance(results, list) or not results:
            return False

        first = results[0] if isinstance(results[0], dict) else None
        if not first:
            return False

        lat = _parse_number(first.get("latitude"))
        lon = _parse_number(first.get("longitude"))
        if lat is None or lon is None:
            return False

        self._lat = lat
        self._lon = lon
        name = str(first.get("name") or "").strip()
        admin = str(first.get("admin1") or "").strip()
        country = str(first.get("country_code") or "").strip()
        parts = [value for value in (name, admin, country) if value]
        if parts:
            self._location_name = ", ".join(parts)
        return True

    async def async_update(self) -> None:
        """Fetch current weather from Open-Meteo."""
        if not self._location_query:
            self._attr_available = False
            return

        session = async_get_clientsession(self._hass)
        if not await self._async_ensure_coordinates(session):
            self._attr_available = False
            return

        params = {
            "latitude": self._lat,
            "longitude": self._lon,
            "current": "temperature_2m,weather_code,is_day",
            "timezone": "auto",
        }

        try:
            response = await session.get(_OPEN_METEO_FORECAST_URL, params=params)
            data = await response.json(content_type=None)
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("Open-Meteo forecast failed: %s", err)
            self._attr_available = False
            return

        current = data.get("current") if isinstance(data, dict) else None
        if not isinstance(current, dict):
            self._attr_available = False
            return

        temp = _parse_number(current.get("temperature_2m"))
        if temp is None:
            self._attr_available = False
            return

        condition_key, condition_label, icon = _open_meteo_condition(
            current.get("weather_code"),
            current.get("is_day"),
        )

        self._attr_available = True
        self._attr_native_value = condition_key
        self._attr_icon = icon
        self._attrs = {
            "temperature": round(temp, 1),
            "current_temperature": round(temp, 1),
            "condition_label": condition_label,
            "source": "open_meteo",
            "provider": "Open-Meteo",
            "attribution": "Weather data by Open-Meteo.com",
            "location_query": self._location_query,
            "location_resolved": self._location_name,
            "latitude": self._lat,
            "longitude": self._lon,
            "last_sync": dt_util.utcnow().isoformat(),
        }


class _TibberApiPriceSensor(SensorEntity):
    """Optional Tibber API price sensor (without Tibber integration)."""

    _attr_has_entity_name = True
    _attr_should_poll = True
    _attr_name = "Tibber Preis"
    _attr_icon = "mdi:cash-clock"
    _attr_native_unit_of_measurement = "EUR/kWh"
    _attr_suggested_display_precision = 4
    _attr_device_class = getattr(SensorDeviceClass, "MONETARY", None)
    _attr_state_class = getattr(SensorStateClass, "MEASUREMENT", None)

    def __init__(self, hass: HomeAssistant, conf: dict[str, Any]) -> None:
        self._hass = hass
        self._conf = conf
        self._attrs: dict[str, Any] = {}
        self._attr_native_value = None
        self._attr_available = False

        self.entity_id = ENTITY_TIBBER_API_PRICE
        self._attr_unique_id = ENTITY_TIBBER_API_PRICE.replace("sensor.", "")
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "tibber_api_price")},
            name="Energie Dashboard Tibber API",
            manufacturer="Tibber",
            model="GraphQL Price Feed",
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """State attributes with forecast arrays."""
        return self._attrs

    async def async_update(self) -> None:
        """Fetch latest Tibber price data via GraphQL."""
        token, home_id = _tibber_credentials(self._conf)
        if token is None:
            self._attr_available = False
            self._attrs = {
                "source": "tibber_api",
                "status": "missing_token",
                "last_sync": dt_util.utcnow().isoformat(),
            }
            return

        query = """
query EnergyDashboardPrices {
  viewer {
    homes {
      id
      appNickname
      currentSubscription {
        priceInfo {
          current {
            total
            energy
            tax
            startsAt
            level
          }
          today {
            total
            energy
            tax
            startsAt
            level
          }
          tomorrow {
            total
            energy
            tax
            startsAt
            level
          }
        }
      }
    }
  }
}
""".strip()

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {"query": query}
        session = async_get_clientsession(self._hass)

        try:
            resp = await session.post(_TIBBER_API_URL, headers=headers, json=payload)
            data = await resp.json(content_type=None)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Tibber API request failed: %s", err)
            self._attr_available = False
            return

        if not isinstance(data, dict):
            self._attr_available = False
            return

        errors = data.get("errors")
        if isinstance(errors, list) and errors:
            _LOGGER.warning("Tibber API returned errors: %s", errors)
            self._attr_available = False
            return

        homes = (((data.get("data") or {}).get("viewer") or {}).get("homes")) or []
        selected_home = _select_tibber_home(homes, home_id)
        if not isinstance(selected_home, dict):
            self._attr_available = False
            return

        price_info = (((selected_home.get("currentSubscription") or {}).get("priceInfo")) or {})
        current = price_info.get("current") or {}
        today = price_info.get("today") or []
        tomorrow = price_info.get("tomorrow") or []

        current_total = _parse_number(current.get("total"))
        if current_total is None:
            self._attr_available = False
            return

        now_utc = dt_util.utcnow().astimezone(timezone.utc)
        next_rows = []
        for row in list(today) + list(tomorrow):
            if not isinstance(row, dict):
                continue
            starts_at = _parse_iso_utc(row.get("startsAt"))
            total = _parse_number(row.get("total"))
            if starts_at is None or total is None:
                continue
            if starts_at >= now_utc:
                next_rows.append((starts_at, total))
        next_rows.sort(key=lambda item: item[0])

        min_today = None
        max_today = None
        if isinstance(today, list):
            values = [_parse_number(row.get("total")) for row in today if isinstance(row, dict)]
            values = [v for v in values if v is not None]
            if values:
                min_today = min(values)
                max_today = max(values)

        self._attr_available = True
        self._attr_native_value = round(current_total, 5)
        self._attrs = {
            "source": "tibber_api",
            "home_id": selected_home.get("id"),
            "home_name": selected_home.get("appNickname"),
            "price_level": current.get("level"),
            "raw_today": today,
            "raw_tomorrow": tomorrow,
            "today": today,
            "tomorrow": tomorrow,
            "next_price": round(next_rows[0][1], 5) if next_rows else None,
            "next_price_starts_at": next_rows[0][0].isoformat() if next_rows else None,
            "min_today": round(min_today, 5) if min_today is not None else None,
            "max_today": round(max_today, 5) if max_today is not None else None,
            "last_sync": dt_util.utcnow().isoformat(),
        }


class _TibberApiLiveGridSensor(SensorEntity):
    """Optional Tibber API live grid power sensor (signed import/export)."""

    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_name = "Tibber Netzleistung"
    _attr_icon = "mdi:transmission-tower"
    _attr_native_unit_of_measurement = "W"
    _attr_suggested_display_precision = 0
    _attr_state_class = getattr(SensorStateClass, "MEASUREMENT", None)
    _attr_device_class = getattr(SensorDeviceClass, "POWER", None)

    def __init__(self, hass: HomeAssistant, conf: dict[str, Any]) -> None:
        self._hass = hass
        self._conf = conf
        self._attrs: dict[str, Any] = {}
        self._attr_native_value = None
        self._attr_available = False
        self._unsub_interval: Callable[[], None] | None = None

        self.entity_id = ENTITY_TIBBER_API_GRID_POWER
        self._attr_unique_id = ENTITY_TIBBER_API_GRID_POWER.replace("sensor.", "")
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, "tibber_api_live_grid")},
            name="Energie Dashboard Tibber API",
            manufacturer="Tibber",
            model="GraphQL Live Grid Feed",
        )

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """State attributes with split import/export values."""
        return self._attrs

    async def async_added_to_hass(self) -> None:
        """Start high-frequency background updates for live grid power."""

        @callback
        def _schedule_update(_: datetime) -> None:
            self._hass.async_create_task(self._async_refresh_and_write())

        self._unsub_interval = async_track_time_interval(
            self._hass,
            _schedule_update,
            _TIBBER_LIVE_UPDATE_INTERVAL,
        )
        await self._async_refresh_and_write()

    async def async_will_remove_from_hass(self) -> None:
        """Stop background update listener."""
        if self._unsub_interval:
            self._unsub_interval()
            self._unsub_interval = None

    async def async_update(self) -> None:
        """Allow manual refresh via entity update service."""
        await self._async_fetch()

    async def _async_refresh_and_write(self) -> None:
        """Refresh from API and publish state immediately."""
        await self._async_fetch()
        self.async_write_ha_state()

    async def _async_fetch(self) -> None:
        """Fetch latest Tibber live measurement and derive signed grid power."""
        token, home_id = _tibber_credentials(self._conf)
        if token is None:
            self._attr_available = False
            self._attrs = {
                "source": "tibber_api_live",
                "status": "missing_token",
                "last_sync": dt_util.utcnow().isoformat(),
            }
            return

        query = """
query EnergyDashboardLiveGrid {
  viewer {
    homes {
      id
      appNickname
      currentSubscription {
        status
      }
      features {
        realTimeConsumptionEnabled
      }
      liveMeasurement {
        timestamp
        power
        powerProduction
      }
    }
  }
}
""".strip()

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        payload = {"query": query}
        session = async_get_clientsession(self._hass)

        try:
            resp = await session.post(_TIBBER_API_URL, headers=headers, json=payload)
            data = await resp.json(content_type=None)
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("Tibber live grid request failed: %s", err)
            self._attr_available = False
            return

        if not isinstance(data, dict):
            self._attr_available = False
            return

        errors = data.get("errors")
        if isinstance(errors, list) and errors:
            _LOGGER.debug("Tibber live grid returned errors: %s", errors)
            self._attr_available = False
            return

        homes = (((data.get("data") or {}).get("viewer") or {}).get("homes")) or []
        selected_home = _select_tibber_home(homes, home_id)
        if not isinstance(selected_home, dict):
            self._attr_available = False
            return

        live = selected_home.get("liveMeasurement") or {}
        if not isinstance(live, dict) or not live:
            self._attr_available = False
            return

        raw_import = _parse_number(live.get("power"))
        raw_export = _parse_number(live.get("powerProduction"))

        import_power: float | None = None
        export_power: float | None = None
        signed_power: float | None = None

        if raw_import is not None and raw_export is not None:
            import_power = max(0.0, raw_import)
            export_power = max(0.0, raw_export)
            signed_power = import_power - export_power
        elif raw_import is not None:
            if raw_import >= 0:
                import_power = raw_import
                export_power = 0.0
                signed_power = raw_import
            else:
                import_power = 0.0
                export_power = abs(raw_import)
                signed_power = raw_import
        elif raw_export is not None:
            import_power = 0.0
            export_power = max(0.0, raw_export)
            signed_power = -export_power

        if signed_power is None:
            self._attr_available = False
            return

        self._attr_available = True
        self._attr_native_value = round(signed_power, 1)
        self._attrs = {
            "source": "tibber_api_live",
            "home_id": selected_home.get("id"),
            "home_name": selected_home.get("appNickname"),
            "import_power_w": round(import_power or 0.0, 1),
            "export_power_w": round(export_power or 0.0, 1),
            "signed_power_w": round(signed_power, 1),
            "measurement_timestamp": live.get("timestamp"),
            "subscription_status": ((selected_home.get("currentSubscription") or {}).get("status")),
            "real_time_enabled": ((selected_home.get("features") or {}).get("realTimeConsumptionEnabled")),
            "last_sync": dt_util.utcnow().isoformat(),
        }


class _LifetimeAccumulator:
    """Collects and persists lifetime savings values."""

    def __init__(self, hass: HomeAssistant, conf: dict[str, Any]) -> None:
        self._hass = hass
        self._conf = conf
        self._store: Store[dict[str, Any]] = Store(hass, STORAGE_VERSION, STORAGE_KEY_LIFETIME)
        self._listeners: set[Callable[[], None]] = set()

        self._last_ts: datetime | None = None
        self._last_saved_ts: datetime | None = None
        self._last_price_entity: str | None = None
        self._last_price_source: str | None = None
        self._last_price_eur: float | None = None
        self._last_price_bucket: int | None = None

        self._saved_non_grid_eur = 0.0
        self._saved_solar_direct_eur = 0.0
        self._battery_arbitrage_eur = 0.0
        self._battery_shift_kwh = 0.0
        self._battery_shift_buy_eur = 0.0
        self._battery_shift_sell_eur = 0.0
        self._battery_pool_kwh = 0.0
        self._battery_pool_cost_eur = 0.0
        self._price_cache_eur: dict[int, float] = {}
        self._pending_samples: list[dict[str, float]] = []

        self._balance_error_w: float | None = None
        self._balance_quality_pct: float | None = None
        self._balance_status = "unknown"
        self._resolved_load_w: float | None = None
        self._resolved_load_source = "unknown"

        self._unsub_interval: Callable[[], None] | None = None
        self._unsub_stop: Callable[[], None] | None = None

        raw_sensors = conf.get(CONF_SENSORS) or {}
        self._sensors = {**DEFAULT_SENSORS, **raw_sensors}
        raw_price_sensors = conf.get(CONF_PRICE_SENSORS) or {}
        self._price_sensors = {**DEFAULT_PRICE_SENSORS, **raw_price_sensors}
        self._price_entity = None
        if conf.get(CONF_TIBBER_API_TOKEN):
            self._price_entity = ENTITY_TIBBER_API_PRICE
        else:
            self._price_entity = (
                conf.get(CONF_PRICE_FALLBACK_ENTITY)
                or conf.get(CONF_PRICE_ENTITY)
                or self._price_sensors.get(CONF_PRICE_CURRENT)
            )
        self._grid_sensor_mode = _normalize_sensor_mode(
            conf.get(CONF_GRID_SENSOR_MODE),
            DEFAULT_GRID_SENSOR_MODE,
        )
        self._battery_sensor_mode = _normalize_sensor_mode(
            conf.get(CONF_BATTERY_SENSOR_MODE),
            DEFAULT_BATTERY_SENSOR_MODE,
        )
        self._use_signed_battery_power = bool(
            conf.get(CONF_USE_SIGNED_BATTERY_POWER, DEFAULT_USE_SIGNED_BATTERY_POWER)
        )
        self._invert_battery_power_sign = bool(
            conf.get(CONF_INVERT_BATTERY_POWER_SIGN, DEFAULT_INVERT_BATTERY_POWER_SIGN)
        )
        self._invert_load_power_sign = bool(
            conf.get(CONF_INVERT_LOAD_POWER_SIGN, DEFAULT_INVERT_LOAD_POWER_SIGN)
        )

        self._device_info = DeviceInfo(
            identifiers={(DOMAIN, "lifetime_savings")},
            name="Energie Dashboard Lifetime",
            manufacturer="Custom",
            model="Energy Dashboard Panel",
        )

    @property
    def device_info(self) -> DeviceInfo:
        """Device info shared by all lifetime sensors."""
        return self._device_info

    @property
    def smart_savings_eur(self) -> float:
        """Solar direct + battery arbitrage."""
        return self._saved_solar_direct_eur + self._battery_arbitrage_eur

    @callback
    def async_register_listener(self, listener: Callable[[], None]) -> Callable[[], None]:
        """Register listener callback for metric updates."""
        self._listeners.add(listener)

        @callback
        def _unsub() -> None:
            self._listeners.discard(listener)

        return _unsub

    async def async_initialize(self) -> None:
        """Load persisted values and start periodic integration."""
        await self._async_load()
        now = dt_util.utcnow()
        self._last_ts = now
        self._last_saved_ts = now
        self._unsub_interval = async_track_time_interval(
            self._hass,
            self._async_handle_interval,
            _UPDATE_INTERVAL,
        )
        self._unsub_stop = self._hass.bus.async_listen_once(
            EVENT_HOMEASSISTANT_STOP,
            self._async_handle_stop,
        )

    async def async_reset(self) -> None:
        """Reset all persisted lifetime counters."""
        self._saved_non_grid_eur = 0.0
        self._saved_solar_direct_eur = 0.0
        self._battery_arbitrage_eur = 0.0
        self._battery_shift_kwh = 0.0
        self._battery_shift_buy_eur = 0.0
        self._battery_shift_sell_eur = 0.0
        self._battery_pool_kwh = 0.0
        self._battery_pool_cost_eur = 0.0
        self._pending_samples = []
        self._balance_error_w = None
        self._balance_quality_pct = None
        self._balance_status = "unknown"
        self._resolved_load_w = None
        self._resolved_load_source = "unknown"
        self._last_ts = dt_util.utcnow()
        await self._async_save()
        self._dispatch_update()

    def get_metric(self, key: str) -> float:
        """Return metric value by key."""
        if key == "smart_savings_eur":
            return self.smart_savings_eur
        if key == "solar_direct_savings_eur":
            return self._saved_solar_direct_eur
        if key == "non_grid_value_eur":
            return self._saved_non_grid_eur
        if key == "battery_arbitrage_eur":
            return self._battery_arbitrage_eur
        if key == "battery_shift_kwh":
            return self._battery_shift_kwh
        return 0.0

    def get_diag_metric(self, key: str) -> float | int | None:
        """Return diagnostic value by key."""
        if key == "resolved_load_w":
            return self._resolved_load_w
        if key == "balance_error_w":
            return self._balance_error_w
        if key == "balance_quality_pct":
            return self._balance_quality_pct
        if key == "price_backfill_pending":
            return len(self._pending_samples)
        return None

    @property
    def extra_attributes(self) -> dict[str, Any]:
        """Diagnostic attributes for entities."""
        return {
            "price_entity": self._last_price_entity or self._price_entity,
            "price_source": self._last_price_source,
            "price_eur_kwh": round(self._last_price_eur, 6) if self._last_price_eur is not None else None,
            "price_bucket": self._last_price_bucket,
            "price_cache_hours": len(self._price_cache_eur),
            "price_backfill_pending": len(self._pending_samples),
            "grid_sensor_mode": self._grid_sensor_mode,
            "battery_sensor_mode": self._battery_sensor_mode,
            "balance_error_w": round(self._balance_error_w, 3) if self._balance_error_w is not None else None,
            "balance_quality_pct": round(self._balance_quality_pct, 3)
            if self._balance_quality_pct is not None
            else None,
            "balance_status": self._balance_status,
            "resolved_load_source": self._resolved_load_source,
            "battery_shift_buy_eur": round(self._battery_shift_buy_eur, 6),
            "battery_shift_sell_eur": round(self._battery_shift_sell_eur, 6),
            "battery_pool_kwh": round(self._battery_pool_kwh, 6),
            "battery_pool_cost_eur": round(self._battery_pool_cost_eur, 6),
            "updated_at": dt_util.utcnow().isoformat(),
        }

    async def _async_load(self) -> None:
        """Load persisted counters from Home Assistant storage."""
        data = await self._store.async_load()
        if not isinstance(data, dict):
            return
        self._saved_non_grid_eur = float(data.get("saved_non_grid_eur", 0.0))
        self._saved_solar_direct_eur = float(data.get("saved_solar_direct_eur", 0.0))
        self._battery_arbitrage_eur = float(data.get("battery_arbitrage_eur", 0.0))
        self._battery_shift_kwh = float(data.get("battery_shift_kwh", 0.0))
        self._battery_shift_buy_eur = float(data.get("battery_shift_buy_eur", 0.0))
        self._battery_shift_sell_eur = float(data.get("battery_shift_sell_eur", 0.0))
        self._battery_pool_kwh = float(data.get("battery_pool_kwh", 0.0))
        self._battery_pool_cost_eur = float(data.get("battery_pool_cost_eur", 0.0))
        cache_raw = data.get("price_cache_eur")
        if isinstance(cache_raw, dict):
            parsed: dict[int, float] = {}
            for raw_key, raw_value in cache_raw.items():
                try:
                    key = int(raw_key)
                    value = float(raw_value)
                except (TypeError, ValueError):
                    continue
                if value == value:
                    parsed[key] = value
            if parsed:
                self._price_cache_eur = parsed
                if len(self._price_cache_eur) > _MAX_PRICE_CACHE_HOURS:
                    for key in sorted(self._price_cache_eur)[:-_MAX_PRICE_CACHE_HOURS]:
                        self._price_cache_eur.pop(key, None)

        pending_raw = data.get("pending_samples")
        if isinstance(pending_raw, list):
            parsed_pending: list[dict[str, float]] = []
            for item in pending_raw:
                if not isinstance(item, dict):
                    continue
                try:
                    hour = int(item.get("hour"))
                except (TypeError, ValueError):
                    continue
                sample = {
                    "hour": float(hour),
                    "non_grid_kwh": float(item.get("non_grid_kwh", 0.0)),
                    "solar_direct_kwh": float(item.get("solar_direct_kwh", 0.0)),
                    "grid_to_battery_kwh": float(item.get("grid_to_battery_kwh", 0.0)),
                    "battery_to_house_kwh": float(item.get("battery_to_house_kwh", 0.0)),
                }
                parsed_pending.append(sample)
            if parsed_pending:
                parsed_pending.sort(key=lambda row: row.get("hour", 0.0))
                self._pending_samples = parsed_pending[-_MAX_PENDING_BUCKETS:]

    async def _async_save(self) -> None:
        """Persist counters to Home Assistant storage."""
        payload = {
            "saved_non_grid_eur": self._saved_non_grid_eur,
            "saved_solar_direct_eur": self._saved_solar_direct_eur,
            "battery_arbitrage_eur": self._battery_arbitrage_eur,
            "battery_shift_kwh": self._battery_shift_kwh,
            "battery_shift_buy_eur": self._battery_shift_buy_eur,
            "battery_shift_sell_eur": self._battery_shift_sell_eur,
            "battery_pool_kwh": self._battery_pool_kwh,
            "battery_pool_cost_eur": self._battery_pool_cost_eur,
            "price_cache_eur": {str(k): v for k, v in self._price_cache_eur.items()},
            "pending_samples": self._pending_samples[-_MAX_PENDING_BUCKETS:],
            "saved_at": dt_util.utcnow().isoformat(),
        }
        await self._store.async_save(payload)
        self._last_saved_ts = dt_util.utcnow()

    async def _async_handle_stop(self, _: Any) -> None:
        """Persist when Home Assistant stops."""
        await self._async_save()

    async def _async_handle_interval(self, now: datetime) -> None:
        """Periodically integrate values from live states."""
        if self._integrate(now):
            self._dispatch_update()
        if self._last_saved_ts is None or now - self._last_saved_ts >= _SAVE_INTERVAL:
            await self._async_save()

    def _dispatch_update(self) -> None:
        """Push updates to all entity listeners."""
        for listener in list(self._listeners):
            listener()

    def _entity_num(self, entity_id: str | None) -> float | None:
        """Read numeric state from Home Assistant."""
        if not entity_id:
            return None
        state = self._hass.states.get(entity_id)
        if state is None:
            return None
        return _parse_number(state.state)

    def _resolve_grid(self) -> tuple[float | None, float | None, float | None]:
        """Resolve grid flow from dual or signed sensors."""
        signed = self._entity_num(self._sensors.get(CONF_GRID_POWER))
        if signed is None:
            signed = self._entity_num(ENTITY_TIBBER_API_GRID_POWER)
        import_raw = self._entity_num(self._sensors.get(CONF_GRID_IMPORT_POWER))
        export_raw = self._entity_num(self._sensors.get(CONF_GRID_EXPORT_POWER))
        has_dual = import_raw is not None or export_raw is not None

        if self._grid_sensor_mode == "dual":
            if not has_dual:
                return None, None, None
            import_power = max(0.0, import_raw or 0.0)
            export_power = max(0.0, export_raw or 0.0)
            return import_power, export_power, import_power - export_power

        if self._grid_sensor_mode == "signed":
            if signed is None:
                return None, None, None
            return max(0.0, signed), max(0.0, -signed), signed

        # Auto mode prefers the signed two-way meter sensor when available.
        if signed is not None:
            return max(0.0, signed), max(0.0, -signed), signed

        if has_dual:
            import_power = max(0.0, import_raw or 0.0)
            export_power = max(0.0, export_raw or 0.0)
            return import_power, export_power, import_power - export_power

        return None, None, None

    def _resolve_battery(self) -> tuple[float | None, float | None, float | None]:
        """Resolve battery flow from dual or signed sensors."""
        signed = self._entity_num(self._sensors.get(CONF_BATTERY_POWER))
        if signed is not None and self._invert_battery_power_sign:
            signed = -signed
        charge_raw = self._entity_num(self._sensors.get(CONF_BATTERY_CHARGE_POWER))
        discharge_raw = self._entity_num(self._sensors.get(CONF_BATTERY_DISCHARGE_POWER))
        has_dual = charge_raw is not None or discharge_raw is not None

        if self._battery_sensor_mode == "signed":
            if signed is None:
                return None, None, None
            return max(0.0, -signed), max(0.0, signed), signed

        if self._battery_sensor_mode == "dual":
            if not has_dual:
                return None, None, None
            charge_power = max(0.0, charge_raw or 0.0)
            discharge_power = max(0.0, discharge_raw or 0.0)
            return charge_power, discharge_power, discharge_power - charge_power

        if self._use_signed_battery_power:
            if signed is None:
                return None, None, None
            return max(0.0, -signed), max(0.0, signed), signed

        if has_dual:
            charge_power = max(0.0, charge_raw or 0.0)
            discharge_power = max(0.0, discharge_raw or 0.0)
            return charge_power, discharge_power, discharge_power - charge_power

        if signed is None:
            return None, None, None

        return max(0.0, -signed), max(0.0, signed), signed

    def _resolved_load(
        self,
        *,
        solar: float | None = None,
        grid_signed: float | None = None,
        battery_discharge: float | None = None,
    ) -> float | None:
        """Resolve load from sensor or derive from solar+grid+battery."""
        load = self._entity_num(self._sensors.get(CONF_LOAD_POWER))
        if load is None:
            if solar is None:
                solar_raw = self._entity_num(self._sensors.get(CONF_SOLAR_POWER))
                solar = max(0.0, solar_raw) if solar_raw is not None else None
            if grid_signed is None:
                _grid_import, _grid_export, grid_signed = self._resolve_grid()
            if battery_discharge is None:
                _battery_charge, battery_discharge, _battery_signed = self._resolve_battery()

            if solar is None or grid_signed is None or battery_discharge is None:
                self._resolved_load_w = None
                self._resolved_load_source = "unavailable"
                return None

            derived = max(0.0, solar + grid_signed + max(0.0, battery_discharge))
            self._resolved_load_w = derived
            self._resolved_load_source = "derived"
            return derived

        if self._invert_load_power_sign:
            load = -load
        resolved = max(0.0, load)
        self._resolved_load_w = resolved
        self._resolved_load_source = "sensor"
        return resolved

    def _cache_price(self, hour_key: int, price_eur: float) -> bool:
        """Cache hourly EUR/kWh values for resilient backfill."""
        if price_eur != price_eur:
            return False
        old = self._price_cache_eur.get(hour_key)
        if old is not None and abs(old - price_eur) <= 1e-9:
            return False
        self._price_cache_eur[hour_key] = price_eur
        if len(self._price_cache_eur) > _MAX_PRICE_CACHE_HOURS:
            for key in sorted(self._price_cache_eur)[:-_MAX_PRICE_CACHE_HOURS]:
                self._price_cache_eur.pop(key, None)
        return True

    def _price_from_state(self, state: Any) -> float | None:
        """Read and normalize a state object to EUR/kWh."""
        raw = _parse_number(state.state)
        if raw is None:
            raw = _parse_number(state.attributes.get("current_price"))
        if raw is None:
            raw = _parse_number(state.attributes.get("price"))
        unit = state.attributes.get("unit_of_measurement")
        return _price_to_eur(raw, unit)

    def _refresh_price_cache(self, now_utc: datetime) -> bool:
        """Refresh hourly cache from configured price entity."""
        entity_id = self._price_entity
        if not entity_id:
            return False
        state = self._hass.states.get(entity_id)
        if state is None:
            return False

        self._last_price_entity = entity_id
        unit = state.attributes.get("unit_of_measurement")
        changed = False

        current_eur = self._price_from_state(state)
        if current_eur is not None:
            changed = self._cache_price(_hour_bucket_key(now_utc), current_eur) or changed

        for attr_key in ("raw_today", "raw_tomorrow", "today", "tomorrow"):
            rows = state.attributes.get(attr_key)
            if not isinstance(rows, list):
                continue
            for row in rows:
                if not isinstance(row, dict):
                    continue
                starts_at = _parse_iso_utc(row.get("startsAt"))
                total = _parse_number(row.get("total"))
                if total is None:
                    total = _parse_number(row.get("price"))
                if starts_at is None or total is None:
                    continue
                eur = _price_to_eur(total, unit)
                if eur is None:
                    continue
                changed = self._cache_price(_hour_bucket_key(starts_at), eur) or changed

        return changed

    def _price_for_hour(self, hour_key: int) -> tuple[float | None, str]:
        """Resolve price by exact hour key, then short nearest fallback."""
        exact = self._price_cache_eur.get(hour_key)
        if exact is not None:
            return exact, "cache_hour"
        if not self._price_cache_eur:
            return None, "missing"
        nearest_key = min(self._price_cache_eur, key=lambda key: abs(key - hour_key))
        if abs(nearest_key - hour_key) <= 2:
            return self._price_cache_eur[nearest_key], "cache_nearest"
        return None, "missing"

    def _apply_priced_sample(self, sample: dict[str, float], price_eur: float) -> bool:
        """Apply one interval sample with known EUR/kWh price."""
        changed = False

        non_grid_kwh = max(0.0, float(sample.get("non_grid_kwh", 0.0)))
        if non_grid_kwh > 0:
            self._saved_non_grid_eur += non_grid_kwh * price_eur
            changed = True

        solar_direct_kwh = max(0.0, float(sample.get("solar_direct_kwh", 0.0)))
        if solar_direct_kwh > 0:
            self._saved_solar_direct_eur += solar_direct_kwh * price_eur
            changed = True

        grid_to_battery_kwh = max(0.0, float(sample.get("grid_to_battery_kwh", 0.0)))
        if grid_to_battery_kwh > 0:
            buy_cost = grid_to_battery_kwh * price_eur
            self._battery_pool_kwh += grid_to_battery_kwh
            self._battery_pool_cost_eur += buy_cost
            self._battery_shift_buy_eur += buy_cost
            changed = True

        battery_to_house_kwh = max(0.0, float(sample.get("battery_to_house_kwh", 0.0)))
        if battery_to_house_kwh > 0 and self._battery_pool_kwh > 0:
            used_grid_kwh = min(battery_to_house_kwh, self._battery_pool_kwh)
            avg_buy = self._battery_pool_cost_eur / self._battery_pool_kwh
            sell_value = used_grid_kwh * price_eur
            buy_value = used_grid_kwh * avg_buy
            self._battery_arbitrage_eur += sell_value - buy_value
            self._battery_shift_kwh += used_grid_kwh
            self._battery_shift_sell_eur += sell_value
            self._battery_pool_cost_eur = max(0.0, self._battery_pool_cost_eur - buy_value)
            self._battery_pool_kwh = max(0.0, self._battery_pool_kwh - used_grid_kwh)
            changed = True

        return changed

    def _queue_pending_sample(self, sample: dict[str, float]) -> bool:
        """Queue interval sample until an hourly price is available."""
        non_grid_kwh = max(0.0, float(sample.get("non_grid_kwh", 0.0)))
        solar_direct_kwh = max(0.0, float(sample.get("solar_direct_kwh", 0.0)))
        grid_to_battery_kwh = max(0.0, float(sample.get("grid_to_battery_kwh", 0.0)))
        battery_to_house_kwh = max(0.0, float(sample.get("battery_to_house_kwh", 0.0)))
        if (
            non_grid_kwh <= 0
            and solar_direct_kwh <= 0
            and grid_to_battery_kwh <= 0
            and battery_to_house_kwh <= 0
        ):
            return False

        hour = int(sample.get("hour", 0))
        if self._pending_samples and int(self._pending_samples[-1].get("hour", -1)) == hour:
            last = self._pending_samples[-1]
            last["non_grid_kwh"] = float(last.get("non_grid_kwh", 0.0)) + non_grid_kwh
            last["solar_direct_kwh"] = float(last.get("solar_direct_kwh", 0.0)) + solar_direct_kwh
            last["grid_to_battery_kwh"] = (
                float(last.get("grid_to_battery_kwh", 0.0)) + grid_to_battery_kwh
            )
            last["battery_to_house_kwh"] = (
                float(last.get("battery_to_house_kwh", 0.0)) + battery_to_house_kwh
            )
            return True

        self._pending_samples.append(
            {
                "hour": float(hour),
                "non_grid_kwh": non_grid_kwh,
                "solar_direct_kwh": solar_direct_kwh,
                "grid_to_battery_kwh": grid_to_battery_kwh,
                "battery_to_house_kwh": battery_to_house_kwh,
            }
        )
        if len(self._pending_samples) > _MAX_PENDING_BUCKETS:
            self._pending_samples = self._pending_samples[-_MAX_PENDING_BUCKETS:]
        return True

    def _flush_pending_samples(self) -> bool:
        """Process queued samples in order once prices become available."""
        if not self._pending_samples:
            return False

        changed = False
        remaining: list[dict[str, float]] = []
        blocked = False
        for sample in self._pending_samples:
            if blocked:
                remaining.append(sample)
                continue
            hour = int(sample.get("hour", 0))
            price_eur, source = self._price_for_hour(hour)
            if price_eur is None:
                blocked = True
                remaining.append(sample)
                continue
            changed = self._apply_priced_sample(sample, price_eur) or changed
            self._last_price_source = f"backfill:{source}"
            self._last_price_eur = price_eur
            self._last_price_bucket = hour

        if len(remaining) != len(self._pending_samples):
            changed = True
        self._pending_samples = remaining
        return changed

    def _update_balance_diagnostics(
        self,
        *,
        solar: float | None,
        grid_import: float | None,
        grid_export: float | None,
        battery_charge: float | None,
        battery_discharge: float | None,
        house_net: float,
    ) -> bool:
        """Update energy-balance diagnostics (W error + quality %)."""
        prev_error = self._balance_error_w
        prev_quality = self._balance_quality_pct
        prev_status = self._balance_status

        if (
            solar is None
            or grid_import is None
            or grid_export is None
            or battery_charge is None
            or battery_discharge is None
        ):
            self._balance_error_w = None
            self._balance_quality_pct = None
            self._balance_status = "unknown"
        else:
            inputs = max(0.0, solar) + max(0.0, grid_import) + max(0.0, battery_discharge)
            outputs = house_net + max(0.0, battery_charge) + max(0.0, grid_export)
            residual = inputs - outputs
            base = max(1.0, inputs, outputs)
            quality = max(0.0, 100.0 - (abs(residual) / base) * 100.0)

            self._balance_error_w = residual
            self._balance_quality_pct = quality
            abs_residual = abs(residual)
            if abs_residual <= _BALANCE_OK_THRESHOLD_W:
                self._balance_status = "ok"
            elif abs_residual <= _BALANCE_WARN_THRESHOLD_W:
                self._balance_status = "warn"
            else:
                self._balance_status = "kritisch"

        def _eq(a: float | None, b: float | None) -> bool:
            if a is None or b is None:
                return a is None and b is None
            return abs(a - b) <= 1e-6

        return (
            not _eq(prev_error, self._balance_error_w)
            or not _eq(prev_quality, self._balance_quality_pct)
            or prev_status != self._balance_status
        )

    def _integrate(self, now: datetime) -> bool:
        """Integrate one interval from current sensor values."""
        if self._last_ts is None:
            self._last_ts = now
            return False

        prev_ts = self._last_ts
        delta_h = (now - prev_ts).total_seconds() / 3600
        self._last_ts = now
        if delta_h <= 0:
            return False
        # Skip unrealistic long intervals to avoid artifacts.
        if delta_h > 0.5:
            return False

        solar_raw = self._entity_num(self._sensors.get(CONF_SOLAR_POWER))
        solar = max(0.0, solar_raw) if solar_raw is not None else None

        grid_import, grid_export, _grid_signed = self._resolve_grid()
        battery_charge_raw, battery_discharge_raw, _battery_signed = self._resolve_battery()
        load = self._resolved_load(
            solar=solar,
            grid_signed=_grid_signed,
            battery_discharge=battery_discharge_raw,
        )
        if load is None:
            return False
        battery_charge = max(0.0, battery_charge_raw or 0.0)
        battery_discharge = max(0.0, battery_discharge_raw or 0.0)
        house_net = max(0.0, load - battery_charge)

        changed = self._update_balance_diagnostics(
            solar=solar,
            grid_import=grid_import,
            grid_export=grid_export,
            battery_charge=battery_charge,
            battery_discharge=battery_discharge,
            house_net=house_net,
        )

        sample = {
            "hour": float(_hour_bucket_key(prev_ts)),
            "non_grid_kwh": 0.0,
            "solar_direct_kwh": 0.0,
            "grid_to_battery_kwh": 0.0,
            "battery_to_house_kwh": 0.0,
        }

        if grid_import is not None:
            grid_to_house = min(max(0.0, grid_import), house_net)
            non_grid_power = max(0.0, house_net - grid_to_house)
            sample["non_grid_kwh"] = (non_grid_power * delta_h) / 1000

        if solar is not None:
            solar_to_house = min(house_net, solar)
            sample["solar_direct_kwh"] = (solar_to_house * delta_h) / 1000

        grid_to_battery_power = 0.0
        if battery_charge > 0:
            if solar is not None:
                solar_surplus = max(0.0, solar - house_net)
                solar_to_battery = min(battery_charge, solar_surplus)
                grid_to_battery_power = max(0.0, battery_charge - solar_to_battery)
            elif grid_import is not None:
                grid_to_battery_power = min(battery_charge, max(0.0, grid_import))
        sample["grid_to_battery_kwh"] = (grid_to_battery_power * delta_h) / 1000

        battery_to_house_power = min(house_net, battery_discharge)
        sample["battery_to_house_kwh"] = (battery_to_house_power * delta_h) / 1000

        now_utc = now.astimezone(timezone.utc)
        price_cache_changed = self._refresh_price_cache(now_utc)
        changed = price_cache_changed or changed

        hour = int(sample["hour"])
        price_eur, source = self._price_for_hour(hour)
        if price_eur is not None:
            changed = self._apply_priced_sample(sample, price_eur) or changed
            self._last_price_source = source
            self._last_price_eur = price_eur
            self._last_price_bucket = hour
        else:
            changed = self._queue_pending_sample(sample) or changed
            self._last_price_source = "missing"
            self._last_price_eur = None
            self._last_price_bucket = hour

        changed = self._flush_pending_samples() or changed
        return changed


class _LifetimeMetricSensor(SensorEntity):
    """Sensor entity exposing one lifetime metric."""

    _attr_has_entity_name = True
    _attr_should_poll = False
    _attr_state_class = getattr(SensorStateClass, "TOTAL", None)

    def __init__(self, accumulator: _LifetimeAccumulator, metric: _MetricDef) -> None:
        self._accumulator = accumulator
        self._metric = metric

        self.entity_id = metric.entity_id
        self._attr_unique_id = metric.entity_id.replace("sensor.", "")
        self._attr_name = metric.name
        self._attr_icon = metric.icon
        self._attr_native_unit_of_measurement = metric.unit
        self._attr_device_class = metric.device_class
        self._attr_suggested_display_precision = metric.precision
        self._attr_device_info = accumulator.device_info

    @property
    def native_value(self) -> float:
        """Current metric value."""
        value = self._accumulator.get_metric(self._metric.key)
        return round(value, self._metric.precision)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Attach diagnostics to each lifetime metric sensor."""
        return self._accumulator.extra_attributes

    async def async_added_to_hass(self) -> None:
        """Subscribe to accumulator updates."""
        self.async_on_remove(
            self._accumulator.async_register_listener(self._handle_accumulator_update)
        )

    @callback
    def _handle_accumulator_update(self) -> None:
        """Write state when accumulator changes."""
        self.async_write_ha_state()


class _AccumulatorDiagnosticSensor(SensorEntity):
    """Diagnostic sensor entity exposing accumulator internals."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, accumulator: _LifetimeAccumulator, metric: _DiagMetricDef) -> None:
        self._accumulator = accumulator
        self._metric = metric

        self.entity_id = metric.entity_id
        self._attr_unique_id = metric.entity_id.replace("sensor.", "")
        self._attr_name = metric.name
        self._attr_icon = metric.icon
        self._attr_native_unit_of_measurement = metric.unit
        self._attr_state_class = metric.state_class
        self._attr_device_class = metric.device_class
        self._attr_suggested_display_precision = metric.precision
        self._attr_device_info = accumulator.device_info
        self._attr_entity_category = getattr(EntityCategory, "DIAGNOSTIC", None)

    @property
    def native_value(self) -> float | int | None:
        """Current diagnostic value."""
        value = self._accumulator.get_diag_metric(self._metric.key)
        if value is None:
            return None
        number = float(value)
        if self._metric.precision <= 0:
            return int(round(number))
        return round(number, self._metric.precision)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Attach diagnostics to each exported sensor."""
        return self._accumulator.extra_attributes

    async def async_added_to_hass(self) -> None:
        """Subscribe to accumulator updates."""
        self.async_on_remove(
            self._accumulator.async_register_listener(self._handle_accumulator_update)
        )

    @callback
    def _handle_accumulator_update(self) -> None:
        """Write state when accumulator changes."""
        self.async_write_ha_state()


async def async_setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    async_add_entities: AddEntitiesCallback,
    discovery_info: DiscoveryInfoType | None = None,
) -> None:
    """Set up lifetime savings sensors for YAML setup."""
    runtime = hass.data.setdefault(DOMAIN, {})
    conf = runtime.get(DATA_CONFIG)
    if not isinstance(conf, dict):
        return

    accumulator = runtime.get(DATA_LIFETIME_ACCUMULATOR)
    if not isinstance(accumulator, _LifetimeAccumulator):
        accumulator = _LifetimeAccumulator(hass, conf)
        runtime[DATA_LIFETIME_ACCUMULATOR] = accumulator
        await accumulator.async_initialize()

    entities = [_LifetimeMetricSensor(accumulator, metric) for metric in _METRICS]
    entities.extend(_AccumulatorDiagnosticSensor(accumulator, metric) for metric in _DIAG_METRICS)
    entities.append(
        _TibberApiPriceSensor(
            hass=hass,
            conf=conf,
        )
    )
    entities.append(
        _TibberApiLiveGridSensor(
            hass=hass,
            conf=conf,
        )
    )
    weather_location = conf.get(CONF_WEATHER_LOCATION)
    if isinstance(weather_location, str) and weather_location.strip():
        entities.append(
            _OpenMeteoWeatherSensor(
                hass=hass,
                location_query=weather_location.strip(),
            )
        )

    async_add_entities(entities, True)


def setup_platform(
    hass: HomeAssistant,
    config: ConfigType,
    add_entities: AddEntitiesCallback,
    discovery_info: DiscoveryInfoType | None = None,
) -> None:
    """Legacy synchronous setup wrapper for older Home Assistant versions."""
    hass.async_create_task(
        async_setup_platform(
            hass=hass,
            config=config,
            async_add_entities=add_entities,
            discovery_info=discovery_info,
        )
    )
