# Energy Dashboard Panel

Eigenes Home-Assistant Sidebar-Panel fuer Solar, Batterie, Netz und Preislogik.

## Features

- Visual Layer mit Drag-and-Drop Chips
- Sensor-Mapping fuer signed oder dual (Import/Export, Laden/Entladen)
- Tibber Preisdaten direkt per API Token
- Wetter-Badge via `weather_entity` oder kostenlos per `weather_location` (Open-Meteo)
- Tagesverlauf, Sparverlauf und Lifetime-Sensoren

## Installation

1. `custom_components/energy_dashboard_panel` nach `/config/custom_components/` kopieren.
2. `configuration.yaml` erweitern.
3. Home Assistant neu starten.

## Beispiel-Konfiguration

```yaml
energy_dashboard_panel:
  sidebar_title: "Energie"
  sidebar_icon: "mdi:solar-power-variant"
  url_path: "energie-dashboard"
  require_admin: false

  # Wetter:
  # Option A: Open-Meteo (empfohlen)
  weather_location: "Berlin,DE"
  # Option B: bestehende HA-Wetter-Entity (hat Vorrang)
  # weather_entity: weather.home

  # Preisquelle:
  tibber_api_token: !secret tibber_api_token
  # tibber_home_id: "optional"
  # price_fallback_entity: sensor.dein_strompreis

  # Sensor-Modi: auto | signed | dual
  grid_sensor_mode: auto
  battery_sensor_mode: signed

  sensors:
    solar_power: sensor.pv_gesamtleistung
    load_power: sensor.hausverbrauch_watt
    grid_import_power: sensor.netzbezug_w
    grid_export_power: sensor.netzeinspeisung_w
    battery_power: sensor.batterie_leistung
    battery_soc: sensor.batterie_soc

  extra_chips:
    - key: wallbox
      label: Wallbox
      entity: sensor.wallbox_leistung
      accent: purple
```

## Erzeugte Sensoren (Auszug)

- `sensor.energy_dashboard_panel_tibber_price` (wenn `tibber_api_token` gesetzt)
- `sensor.energy_dashboard_panel_open_meteo_weather` (wenn `weather_location` gesetzt)
- `sensor.energy_dashboard_panel_lifetime_smart_savings_eur`
- `sensor.energy_dashboard_panel_lifetime_solar_direct_savings_eur`
- `sensor.energy_dashboard_panel_lifetime_non_grid_value_eur`
- `sensor.energy_dashboard_panel_lifetime_battery_arbitrage_eur`
- `sensor.energy_dashboard_panel_lifetime_battery_shift_kwh`

## Sicherheit

Nutze fuer Tokens immer `!secret` und committe keine echten API Keys.
