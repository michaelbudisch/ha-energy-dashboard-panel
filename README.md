# Energy Dashboard Panel (Home Assistant)

Custom Panel fuer Home Assistant mit Fokus auf:

- Solar, Netz, Batterie, Hauslast (inkl. signed/dual Sensor-Logik)
- Tibber Preislogik direkt per API Token
- Tibber Token direkt im Dashboard-Einstellungsdialog setzbar (Backend-Storage)
- Open-Meteo Wetter (kostenlos, nur Ort noetig)
- Drag-and-Drop Visual Layer mit frei platzierbaren Chips
- Standard-Chip Farben frei konfigurierbar (Solar/Netz/Batterie/Hauslast)
- Light/Dark Mode Umschalter direkt im Dashboard
- Tagesverlauf + Sparstatistiken + Monatsreport (Monat-Tab) + Lifetime-Sensoren
- Berichte (Monat/Jahr) als CSV/PDF direkt im Panel
- Hover-Tooltips in den Charts (Maus ueber Diagramm = Live-Werte je Punkt)
- Umschaltbarer Tagesverlauf: Linien/Balken + kW/kWh pro Intervall
- Lokaler Einstellungsdialog im Panel (YAML bleibt Fallback)

## Screenshots

<p align="center">
  <img src="docs/images/dashboard-1.jpeg" alt="Dashboard Screenshot 1" width="31%" />
  <img src="docs/images/dashboard-2.jpeg" alt="Dashboard Screenshot 2" width="31%" />
  <img src="docs/images/dashboard-3.jpeg" alt="Dashboard Screenshot 3" width="31%" />
</p>

## Projektstruktur

```text
custom_components/
  energy_dashboard_panel/
    __init__.py
    const.py
    sensor.py
    manifest.json
    frontend/
      energy-dashboard-panel.js
```

## Installation (Home Assistant)

1. Ordner `custom_components/energy_dashboard_panel` nach `/config/custom_components/` kopieren.
2. In `configuration.yaml` konfigurieren.
3. Home Assistant neu starten.

Minimalbeispiel:

```yaml
energy_dashboard_panel:
  sidebar_title: "Energie"
  sidebar_icon: "mdi:solar-power-variant"
  url_path: "energie-dashboard"
  require_admin: false
  background_image: /energy_dashboard_panel_panel/dashboard.png?v=1

  # Kostenloses Wetter (Open-Meteo)
  weather_location: "Berlin,DE"

  # Akku-Restlaufzeit (Prognose im Dashboard)
  battery_capacity_kwh: 10.2
  battery_reserve_soc: 10
  battery_max_charge_soc: 90

  # Tibber API (ohne Tibber Integration)
  # Bevorzugt: tibber_api_token (Alias: tibber_api_key)
  tibber_api_token: !secret tibber_api_token
  # tibber_home_id: "optional_home_id"

  sensors:
    solar_power: sensor.pv_gesamtleistung
    # Optional: eigener Lastsensor.
    # Wenn nicht gesetzt, wird load_power automatisch berechnet:
    # load = grid_power + solar_power + max(battery_power, 0)
    # load_power: sensor.hausverbrauch_watt
    # Lokaler Zwei-Wege-Zaehler (bevorzugt in grid_sensor_mode: auto)
    grid_power: sensor.zaehler_zweiwege_leistung
    # Optional als Fallback:
    grid_import_power: sensor.netzbezug_w
    grid_export_power: sensor.netzeinspeisung_w
    battery_power: sensor.batterie_leistung
    battery_soc: sensor.batterie_soc

  # Farben fuer die 4 Standard-Chips
  # Erlaubte Werte: aqua | blue | orange | gray | purple
  standard_chip_colors:
    solar_power: aqua
    grid_power: gray
    battery_power: blue
    load_power: orange
```

Hinweis zum Hintergrundbild:

- Datei im Projekt: `custom_components/energy_dashboard_panel/frontend/dashboard.png`
- Oeffentliche URL in der YAML: `/energy_dashboard_panel_panel/dashboard.png?v=1`
- Bei Bildaenderung einfach die Versionszahl (`?v=2`, `?v=3`) erhoehen.

Hinweis Netzsensoren:

- In `grid_sensor_mode: auto` wird `sensors.grid_power` (Zwei-Wege, signed) bevorzugt.
- Wenn `grid_power` fehlt oder keine Zahl liefert, nutzt das Panel automatisch
  `sensor.energy_dashboard_panel_tibber_grid_power` als Live-Fallback
  (wenn `tibber_api_token`/`tibber_api_key` gesetzt ist und Tibber-Livewerte verfügbar sind).
- `grid_import_power`/`grid_export_power` bleiben zusätzlich als Fallback nutzbar.

Hinweis Tibber Token:

- Token kann weiterhin in `configuration.yaml` gesetzt werden.
- Alternativ im Dashboard über `Einstellungen` eintragen (wird im HA Backend gespeichert).

Hinweis load_power:

- Ein manueller Helper ist nicht mehr zwingend noetig.
- Wenn `sensors.load_power` fehlt, berechnet das Panel automatisch:
  `load_power = grid_power + solar_power + max(battery_power, 0)`
- Zusaetzlich wird ein Diagnosesensor erzeugt:
  `sensor.energy_dashboard_panel_resolved_load_power`

Hinweis Akku-Prognose:

- Restlaufzeit (Entladen) wird berechnet aus `SOC`, `battery_capacity_kwh`, `battery_reserve_soc` und aktueller Entladeleistung.
- Ladezeit bis Ziel wird aus `SOC`, `battery_capacity_kwh`, `battery_max_charge_soc` und aktueller Ladeleistung berechnet.
- Falls `battery_capacity_kwh` fehlt, versucht das Panel die Kapazität aus Attributen von `battery_soc` zu lesen.

Berichte:

- Über den Button `Bericht` (neben `Einstellungen`/`Layout bearbeiten`) öffnet sich ein Monats-/Jahresreport.
- Export:
  - CSV: Zusammenfassung + Zeitreihe je Intervall
  - PDF: kompakte Zusammenfassung für Ablage/Weitergabe

## GitHub: Repo erstellen und pushen

```bash
git init
git add .
git commit -m "Initial commit: energy dashboard panel"
git branch -M main
git remote add origin https://github.com/<USER>/<REPO>.git
git push -u origin main
```

## Sicherheit

- Niemals API Tokens direkt committen.
- Immer `!secret tibber_api_token` (oder `tibber_api_key`) verwenden und `secrets.yaml` lokal halten.
