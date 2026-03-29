# Energy Dashboard Panel

Eigenes Home-Assistant Sidebar-Panel fuer Solar, Batterie, Netz und Preislogik.

## Features

- Visual Layer mit Drag-and-Drop Chips
- Standard-Chip Farben frei konfigurierbar (Solar/Netz/Batterie/Hauslast)
- Sensor-Mapping fuer signed oder dual (Import/Export, Laden/Entladen)
- Tibber Preisdaten direkt per API Token
- Tibber Token direkt im Dashboard-Einstellungsdialog setzbar (Backend-Storage)
- Wetter-Badge via `weather_entity` oder kostenlos per `weather_location` (Open-Meteo)
- Light/Dark Mode Umschalter direkt im Dashboard
- Tagesverlauf, Sparverlauf, Monatsreport (Monat-Tab) und Lifetime-Sensoren
- Optionaler Batterie-WR-Sensor (signed, AC-Seite) inkl. Verlustanzeige (Laden/Entladen)
- Berichte (Monat/Jahr) als CSV/PDF direkt im Panel
- Hover-Tooltips in den Charts (Maus ueber Diagramm zeigt Einzelwerte)
- Tagesverlauf umschaltbar: Linien/Balken + kW/kWh pro Intervall
- Lokaler Einstellungsdialog im Panel (YAML bleibt Fallback)

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
  background_image: /energy_dashboard_panel_panel/dashboard.png?v=1

  # Wetter:
  # Option A: Open-Meteo (empfohlen)
  weather_location: "Berlin,DE"
  # Option B: bestehende HA-Wetter-Entity (hat Vorrang)
  # weather_entity: weather.home

  # Preisquelle:
  # Bevorzugt: tibber_api_token (Alias: tibber_api_key)
  tibber_api_token: !secret tibber_api_token
  # tibber_home_id: "optional"
  # price_fallback_entity: sensor.dein_strompreis

  # Akku-Restlaufzeit (Prognose)
  battery_capacity_kwh: 10.2
  battery_reserve_soc: 10
  battery_max_charge_soc: 90

  # Sensor-Modi: auto | signed | dual
  grid_sensor_mode: auto
  battery_sensor_mode: signed

  sensors:
    solar_power: sensor.pv_gesamtleistung
    # Optional: eigener Lastsensor.
    # Wenn nicht gesetzt, wird load_power automatisch berechnet:
    # load = grid_power + solar_power + max(battery_power, 0)
    # load_power: sensor.hausverbrauch_watt
    # Optional: kumulative Lastenergie fuer genauere Verlaeufe:
    # load_energy: sensor.hausverbrauch_gesamt_kwh
    # Lokaler Zwei-Wege-Zaehler (signed, in auto priorisiert)
    grid_power: sensor.zaehler_zweiwege_leistung
    # Optionaler Fallback:
    grid_import_power: sensor.netzbezug_w
    grid_export_power: sensor.netzeinspeisung_w
    # Optional fuer exakte Verbrauchs-/Mix-Bilanzen (kumulative Zaehler in kWh):
    grid_import_energy: sensor.gesamtbezug_kwh
    grid_export_energy: sensor.gesamteinspeisung_kwh
    battery_power: sensor.batterie_leistung
    # Optional (empfohlen): signed WR-Wirkleistung (AC-Seite) fuer genaueren Fluss
    battery_inverter_power: sensor.wechselrichter_wirkleistung
    # Optional: kumulative Batterieenergie fuer exaktere Aufteilung:
    # battery_charge_energy: sensor.akkuladung_gesamt_kwh
    # battery_discharge_energy: sensor.akkuentladung_gesamt_kwh
    # Optional: kumulative PV-Energie:
    # solar_energy: sensor.pv_erzeugung_gesamt_kwh
    battery_soc: sensor.batterie_soc

  # Farben fuer die 4 Standard-Chips
  # Erlaubte Werte: aqua | blue | orange | gray | purple
  standard_chip_colors:
    solar_power: aqua
    grid_power: gray
    battery_power: blue
    load_power: orange

  extra_chips:
    - key: wallbox
      label: Wallbox
      entity: sensor.wallbox_leistung
      accent: purple
```

Hinweis Hintergrundbild:

- Lege die Datei unter `custom_components/energy_dashboard_panel/frontend/` ab.
- Nutze in der YAML den URL-Pfad `/energy_dashboard_panel_panel/<datei>?v=1`.

Hinweis Netzsensoren:

- In `grid_sensor_mode: auto` wird `grid_power` (Zwei-Wege-Sensor) bevorzugt.
- Wenn `grid_power` fehlt oder keine Zahl liefert, nutzt das Panel automatisch
  `sensor.energy_dashboard_panel_tibber_grid_power` als Live-Fallback
  (wenn `tibber_api_token`/`tibber_api_key` gesetzt ist und Tibber-Livewerte verfügbar sind).
- `grid_import_power` und `grid_export_power` dienen zusätzlich als Fallback.
- Wenn `grid_import_energy` (und optional `grid_export_energy`) gesetzt sind, nutzt das
  Panel diese Zählerstände im Verlauf vorrangig für genauere kWh-Mixwerte
  und fällt automatisch auf die bisherige Leistungsintegration zurück.
- Dasselbe gilt optional für `solar_energy`, `load_energy`,
  `battery_charge_energy` und `battery_discharge_energy`:
  Wenn gesetzt, werden sie vorrangig genutzt, sonst bleibt die bisherige
  Leistungs-Fallback-Logik aktiv.

Hinweis Tibber Token:

- Token kann in `configuration.yaml` gesetzt werden.
- Oder direkt im Panel unter `Einstellungen` gespeichert werden (HA Backend).

Hinweis load_power:

- Ein manueller Helper ist optional.
- Wenn `load_power` fehlt, berechnet die Integration automatisch:
  `load_power = grid_power + solar_power + max(battery_power, 0)`
- Der aufgeloeste Wert steht als Diagnosesensor bereit:
  `sensor.energy_dashboard_panel_resolved_load_power`

Hinweis Akku-Prognose:

- Restlaufzeit (Entladen) nutzt `SOC`, `battery_capacity_kwh`, `battery_reserve_soc` und aktuelle Entladeleistung.
- Ladezeit bis Ziel nutzt `SOC`, `battery_capacity_kwh`, `battery_max_charge_soc` und aktuelle Ladeleistung.
- Ohne `battery_capacity_kwh` wird versucht, die Kapazität aus `battery_soc`-Attributen zu lesen.

Hinweis Akku-Zyklen:

- `Vollzyklen (Zeitraum, ...)` in der Batterie-Detailansicht beziehen sich immer auf den gewählten Zeitraum (Heute, 24h, 7 Tage, Monat, Gesamt).
- `Vollzyklen gesamt (Zähler)` zeigt Gesamtzyklen seit Aufzeichnung und braucht
  `battery_charge_energy` und `battery_discharge_energy` als fortlaufende Zähler
  (`state_class: total_increasing`, Einheit kWh).

Hinweis Batterie-WR Sensor und Verluste:

- Optional kann `sensors.battery_inverter_power` gesetzt werden (signed, AC-Seite am Wechselrichter).
- Wenn gesetzt, nutzt das Panel diesen Sensor vorrangig fuer Energiefluss/Bilanz (Haus/Netz/Akku).
- `sensors.battery_power` bleibt zusaetzlich sinnvoll als DC-Seite (Batterie intern), damit
  Lade-/Entlade-Verluste angezeigt werden koennen.
- In der Batterie-Detailansicht erscheinen dann z. B.:
  - `Wandlungsverlust`
  - `Davon Laden`
  - `Davon Entladen`
  - `Wirkungsgrad Laden/Entladen`

Berichte:

- Im Dashboard über den Button `Bericht` (Toolbar oben am Visual Layer).
- Zeitraum: Monat oder Jahr.
- Export:
  - CSV (inkl. Zeitreihe)
  - PDF (Zusammenfassung)

## Erzeugte Sensoren (Auszug)

- `sensor.energy_dashboard_panel_tibber_price` (wenn `tibber_api_token`/`tibber_api_key` gesetzt)
- `sensor.energy_dashboard_panel_tibber_grid_power` (Live-Netzleistung, signed, wenn `tibber_api_token`/`tibber_api_key` gesetzt)
- `sensor.energy_dashboard_panel_open_meteo_weather` (wenn `weather_location` gesetzt)
- `sensor.energy_dashboard_panel_resolved_load_power` (Diagnose, automatisch aufgeloeste Last)
- `sensor.energy_dashboard_panel_lifetime_smart_savings_eur`
- `sensor.energy_dashboard_panel_lifetime_solar_direct_savings_eur`
- `sensor.energy_dashboard_panel_lifetime_non_grid_value_eur`
- `sensor.energy_dashboard_panel_lifetime_battery_arbitrage_eur`
- `sensor.energy_dashboard_panel_lifetime_battery_shift_kwh`

## Sicherheit

Nutze fuer Tokens immer `!secret` und committe keine echten API Keys.

## Troubleshooting

- Falls im Panel unerwartet `load_power: sensor.ems_home_total_power` erscheint:
  - Home Assistant neu starten.
  - Browser hart neu laden (`Strg+F5`).
  - Sicherstellen, dass die aktuelle Version installiert ist.
  - Ab `0.4.18` wird das Frontend per Versions-Query automatisch cache-gebustet und dieser Legacy-Default abgefangen.
