const FALLBACK_SENSORS = {
  solar_power: "sensor.ems_solar_power",
  solar_energy: null,
  load_power: null,
  load_energy: null,
  grid_power: "sensor.ems_grid_power",
  grid_import_power: null,
  grid_export_power: null,
  grid_import_energy: null,
  grid_export_energy: null,
  battery_power: "sensor.ems_battery_power",
  battery_inverter_power: null,
  battery_charge_power: null,
  battery_discharge_power: null,
  battery_charge_energy: null,
  battery_discharge_energy: null,
  battery_soc: "sensor.ems_battery_soc",
};

const FALLBACK_PRICE_SENSORS = {
  current: null,
  next_1h: null,
  next_2h: null,
  next_3h: null,
  next_4h: null,
  next_5h: null,
  min_today: null,
  max_today: null,
  level: null,
};

const LEGACY_LOAD_SENSOR_IDS = new Set(["sensor.ems_home_total_power"]);

const FLOW_OPTION_DEFAULTS = {
  use_signed_battery_power: false,
  invert_battery_power_sign: false,
  invert_load_power_sign: false,
  grid_sensor_mode: "auto",
  battery_sensor_mode: "auto",
};

const LIFETIME_SENSORS = {
  smart: "sensor.energy_dashboard_panel_lifetime_smart_savings_eur",
  solar: "sensor.energy_dashboard_panel_lifetime_solar_direct_savings_eur",
  non_grid: "sensor.energy_dashboard_panel_lifetime_non_grid_value_eur",
  arbitrage: "sensor.energy_dashboard_panel_lifetime_battery_arbitrage_eur",
  shift_kwh: "sensor.energy_dashboard_panel_lifetime_battery_shift_kwh",
};

const DIAG_SENSORS = {
  balance_error: "sensor.energy_dashboard_panel_balance_error_w",
  balance_quality: "sensor.energy_dashboard_panel_balance_quality_pct",
  backfill_pending: "sensor.energy_dashboard_panel_price_backfill_pending",
};
const EDP_DOMAIN = "energy_dashboard_panel";
const EDP_SERVICE_SET_TIBBER = "set_tibber_credentials";
const EDP_SERVICE_SET_UI_CONFIG = "set_ui_config";
const EDP_API_UI_CONFIG = `${EDP_DOMAIN}/ui_config`;
const TIBBER_PRICE_SENSOR = "sensor.energy_dashboard_panel_tibber_price";
const TIBBER_LIVE_GRID_SENSOR = "sensor.energy_dashboard_panel_tibber_grid_power";

const WEATHER_ICON = {
  sunny: "mdi:weather-sunny",
  clear: "mdi:weather-night",
  clear_night: "mdi:weather-night",
  partlycloudy: "mdi:weather-partly-cloudy",
  cloudy: "mdi:weather-cloudy",
  rainy: "mdi:weather-rainy",
  pouring: "mdi:weather-pouring",
  snowy: "mdi:weather-snowy",
  snowy_rainy: "mdi:weather-snowy-rainy",
  lightning: "mdi:weather-lightning",
  lightning_rainy: "mdi:weather-lightning-rainy",
  fog: "mdi:weather-fog",
  windy: "mdi:weather-windy",
  windy_variant: "mdi:weather-windy-variant",
};

const WEATHER_CONDITION_LABEL = {
  sunny: "Sonnig",
  clear: "Klar",
  clear_night: "Klar",
  partlycloudy: "Leicht bewölkt",
  cloudy: "Bewölkt",
  rainy: "Regen",
  pouring: "Starker Regen",
  snowy: "Schnee",
  snowy_rainy: "Schneeregen",
  lightning: "Gewitter",
  lightning_rainy: "Gewitterregen",
  fog: "Nebel",
  windy: "Windig",
  windy_variant: "Windig",
};

const DEFAULT_POSITIONS = {
  solar_power: { x: 14, y: 14 },
  grid_power: { x: 86, y: 20 },
  battery_power: { x: 24, y: 78 },
  load_power: { x: 78, y: 78 },
  battery_soc: { x: 52, y: 58 },
};

const CHIP_ACCENT_SET = new Set(["aqua", "blue", "orange", "gray", "purple"]);
const CHIP_CABLE_COLORS = {
  aqua: "#2cc6a5",
  blue: "#4f8dff",
  orange: "#f29b38",
  gray: "#92a0b5",
  purple: "#9b7de3",
};
const STANDARD_CHIP_COLOR_DEFAULTS = {
  solar_power: "aqua",
  grid_power: "gray",
  battery_power: "blue",
  load_power: "orange",
};

const TREND_RANGES = {
  today: { key: "today", label: "Heute" },
  day24: { key: "day24", label: "24h" },
  week7: { key: "week7", label: "7 Tage" },
  month: { key: "month", label: "Monat" },
  total: { key: "total", label: "Gesamt" },
};
const TREND_CHART_MODES = {
  line: "line",
  bars: "bars",
};
const TREND_VALUE_MODES = {
  kw: "kw",
  kwh: "kwh",
};
const TREND_STEP_MIN_MS = 15 * 60 * 1000;
const TREND_DATA_REV = "2026-03-23-battery-inverter-loss-1";

const GRID_STATUS_ENTER_W = 80;
const GRID_STATUS_EXIT_W = 50;
const CABLE_ENTER_ACTIVE_W = 20;
const CABLE_EXIT_ACTIVE_W = 8;
const CABLE_MAX_ACTIVE_W = 4000;
const CABLE_WIDTH_MIN = 0.28;
const CABLE_WIDTH_MAX = 0.92;
const FLOW_LABEL_MIN_POWER_W = 40;
const RENDER_MIN_INTERVAL_MS = 220;

class HaEnergyDashboardPanel extends HTMLElement {
  constructor() {
    super();
    this._hass = null;
    this._panel = null;
    this._narrow = false;
    this._editMode = false;
    this._positions = null;
    this._drag = null;
    this._trendData = null;
    this._trendLoading = false;
    this._trendKey = null;
    this._trendLastFetch = 0;
    this._trendCache = new Map();
    this._trendRange = TREND_RANGES.today.key;
    this._trendChartMode = TREND_CHART_MODES.line;
    this._trendChartModeLoaded = false;
    this._trendValueMode = TREND_VALUE_MODES.kw;
    this._trendValueModeLoaded = false;
    this._trendHoverIndex = null;
    this._savingsHoverIndex = null;
    this._priceHoverIndex = null;
    this._detailOpen = false;
    this._detailKey = null;
    this._detailHoverIndex = null;
    this._priceChartRows = [];
    this._priceChartRangeStart = null;
    this._priceChartRangeEnd = null;
    this._uiConfig = {};
    this._uiConfigLoaded = false;
    this._uiConfigBackendSyncStarted = false;
    this._uiConfigBackendSyncPromise = null;
    this._settingsOpen = false;
    this._settingsDraft = null;
    this._settingsError = "";
    this._reportOpen = false;
    this._reportLoading = false;
    this._reportError = "";
    this._reportPeriod = "month";
    this._reportData = null;
    this._gridStatusState = "idle";
    this._renderFrame = 0;
    this._renderTimeout = 0;
    this._lastRenderAt = 0;
    this._lastHassSignature = "";
    this._cableIntensityState = {};
    this._flowFrame = 0;
    this._flowCanvas = null;
    this._flowCtx = null;
    this._flowModel = [];
    this._flowLastTs = 0;
    this._flowPhase = 0;
    this._flowReducedMotion = false;
    this._flowMediaQuery = null;
    this._flowMediaQueryHandler = null;
    this._flowResizeObserver = null;
    this._chartResizeObserver = null;
    this._chartRedrawFrame = 0;
    this._windowResizeFrame = 0;
    this._cachedAutoPriceEntity = null;
    this._cachedAutoWeatherEntity = null;
    this._themeLoaded = false;
    this._themeDark = false;
    this._hasRenderedTemplate = false;
    this._pendingFullRender = true;
    this.attachShadow({ mode: "open" });

    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onWindowResize = this._handleWindowResize.bind(this);
  }

  connectedCallback() {
    window.addEventListener("pointermove", this._onPointerMove, { passive: false });
    window.addEventListener("pointerup", this._onPointerUp);
    window.addEventListener("pointercancel", this._onPointerUp);
    window.addEventListener("resize", this._onWindowResize, { passive: true });
    this._flowMediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
    this._flowReducedMotion = Boolean(this._flowMediaQuery?.matches);
    if (this._flowMediaQuery) {
      this._flowMediaQueryHandler = (event) => {
        this._flowReducedMotion = Boolean(event?.matches);
        this._startFlowLoop(true);
      };
      if (this._flowMediaQuery.addEventListener) {
        this._flowMediaQuery.addEventListener("change", this._flowMediaQueryHandler);
      } else if (this._flowMediaQuery.addListener) {
        this._flowMediaQuery.addListener(this._flowMediaQueryHandler);
      }
    }
  }

  disconnectedCallback() {
    window.removeEventListener("pointermove", this._onPointerMove);
    window.removeEventListener("pointerup", this._onPointerUp);
    window.removeEventListener("pointercancel", this._onPointerUp);
    window.removeEventListener("resize", this._onWindowResize);
    if (this._renderTimeout) {
      window.clearTimeout(this._renderTimeout);
      this._renderTimeout = 0;
    }
    if (this._renderFrame) {
      window.cancelAnimationFrame(this._renderFrame);
      this._renderFrame = 0;
    }
    if (this._flowFrame) {
      window.cancelAnimationFrame(this._flowFrame);
      this._flowFrame = 0;
    }
    if (this._chartRedrawFrame) {
      window.cancelAnimationFrame(this._chartRedrawFrame);
      this._chartRedrawFrame = 0;
    }
    if (this._windowResizeFrame) {
      window.cancelAnimationFrame(this._windowResizeFrame);
      this._windowResizeFrame = 0;
    }
    if (this._flowResizeObserver) {
      this._flowResizeObserver.disconnect();
      this._flowResizeObserver = null;
    }
    if (this._chartResizeObserver) {
      this._chartResizeObserver.disconnect();
      this._chartResizeObserver = null;
    }
    if (this._flowMediaQuery && this._flowMediaQueryHandler) {
      if (this._flowMediaQuery.removeEventListener) {
        this._flowMediaQuery.removeEventListener("change", this._flowMediaQueryHandler);
      } else if (this._flowMediaQuery.removeListener) {
        this._flowMediaQuery.removeListener(this._flowMediaQueryHandler);
      }
    }
    this._flowMediaQuery = null;
    this._flowMediaQueryHandler = null;
    this._flowCanvas = null;
    this._flowCtx = null;
    this._flowModel = [];
  }

  set hass(hass) {
    this._hass = hass;
    const signature = this._hassSignature(hass);
    if (signature === this._lastHassSignature) {
      return;
    }
    this._lastHassSignature = signature;
    this._requestRender();
  }

  set panel(panel) {
    this._panel = panel;
    this._positions = null;
    this._trendData = null;
    this._trendKey = null;
    this._trendCache.clear();
    this._trendHoverIndex = null;
    this._savingsHoverIndex = null;
    this._priceHoverIndex = null;
    this._detailOpen = false;
    this._detailKey = null;
    this._detailHoverIndex = null;
    this._priceChartRows = [];
    this._lastHassSignature = "";
    this._cachedAutoPriceEntity = null;
    this._cachedAutoWeatherEntity = null;
    this._themeLoaded = false;
    this._trendChartModeLoaded = false;
    this._trendValueModeLoaded = false;
    this._uiConfigLoaded = false;
    this._uiConfigBackendSyncStarted = false;
    this._uiConfigBackendSyncPromise = null;
    this._uiConfig = {};
    this._settingsOpen = false;
    this._settingsDraft = null;
    this._settingsError = "";
    this._reportOpen = false;
    this._reportLoading = false;
    this._reportError = "";
    this._reportPeriod = "month";
    this._reportData = null;
    this._hasRenderedTemplate = false;
    this._requestRender({ immediate: true, full: true });
  }

  set narrow(narrow) {
    this._narrow = Boolean(narrow);
    this._requestRender({ immediate: true, full: true });
  }

  _queueRenderFrame() {
    if (this._renderFrame) {
      return;
    }
    this._renderFrame = window.requestAnimationFrame(() => {
      this._renderFrame = 0;
      this._lastRenderAt = Date.now();
      const fullRender = this._pendingFullRender;
      this._pendingFullRender = false;
      try {
        this._render(fullRender);
      } catch (error) {
        this._renderFatalError(error);
      }
    });
  }

  _renderFatalError(error) {
    if (!this.shadowRoot) {
      return;
    }
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message || "")
        : String(error || "");
    const stack =
      error && typeof error === "object" && "stack" in error
        ? String(error.stack || "")
        : "";
    const detail = stack || message || "Unbekannter Fehler";
    this._hasRenderedTemplate = false;
    this.shadowRoot.innerHTML = `
      <style>
        .fatal {
          margin: 14px;
          border-radius: 12px;
          border: 1px solid rgba(203, 81, 81, 0.42);
          background: rgba(232, 87, 87, 0.12);
          color: #9b1b1b;
          padding: 12px;
          font: 600 13px/1.4 "Sora", "Segoe UI", sans-serif;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .fatal .t {
          font-size: 14px;
          margin-bottom: 8px;
        }
        .fatal .h {
          color: #6b0f0f;
          margin-bottom: 6px;
          font-weight: 700;
        }
      </style>
      <div class="fatal">
        <div class="t">Frontend-Fehler im Energy Dashboard Panel</div>
        <div class="h">Bitte Screenshot dieser Meldung senden:</div>
        ${this._escapeHtml(detail)}
      </div>
    `;
    try {
      // Keep a useful console trace for desktop/mobile web inspector.
      // eslint-disable-next-line no-console
      console.error("[energy_dashboard_panel] fatal render error", error);
    } catch (_ignore) {
      // no-op
    }
  }

  _requestRender({ immediate = false, full = false } = {}) {
    if (full) {
      this._pendingFullRender = true;
    }
    if (immediate) {
      if (this._renderTimeout) {
        window.clearTimeout(this._renderTimeout);
        this._renderTimeout = 0;
      }
      this._queueRenderFrame();
      return;
    }

    const sinceLast = Date.now() - this._lastRenderAt;
    if (sinceLast >= RENDER_MIN_INTERVAL_MS) {
      this._queueRenderFrame();
      return;
    }

    if (this._renderTimeout || this._renderFrame) {
      return;
    }

    const wait = Math.max(0, RENDER_MIN_INTERVAL_MS - sinceLast);
    this._renderTimeout = window.setTimeout(() => {
      this._renderTimeout = 0;
      this._queueRenderFrame();
    }, wait);
  }

  _scheduleChartRedraw() {
    if (this._chartRedrawFrame) {
      return;
    }
    this._chartRedrawFrame = window.requestAnimationFrame(() => {
      this._chartRedrawFrame = 0;
      this._drawTrendChart();
      this._drawTrendMixChart();
      this._drawSavingsChart();
      this._drawPriceChart();
      this._drawDetailChart();
    });
  }

  _handleWindowResize() {
    if (this._windowResizeFrame) {
      return;
    }
    this._windowResizeFrame = window.requestAnimationFrame(() => {
      this._windowResizeFrame = 0;
      this._scheduleChartRedraw();
      this._startFlowLoop(true);
    });
  }

  _bindChartResizeObserver() {
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const trend = this.shadowRoot?.querySelector("#trend-canvas");
    const trendMix = this.shadowRoot?.querySelector("#trend-mix-canvas");
    const savings = this.shadowRoot?.querySelector("#savings-canvas");
    const price = this.shadowRoot?.querySelector("#price-canvas");
    const detail = this.shadowRoot?.querySelector("#detail-canvas");
    const observed = [trend, trendMix, savings, price, detail].filter(Boolean);
    if (observed.length === 0) {
      return;
    }
    if (this._chartResizeObserver) {
      this._chartResizeObserver.disconnect();
      this._chartResizeObserver = null;
    }
    this._chartResizeObserver = new ResizeObserver(() => this._scheduleChartRedraw());
    observed.forEach((canvas) => this._chartResizeObserver.observe(canvas));
  }

  _hoverIndexFromPointer(event, canvas, pad, pointCount) {
    if (!event || !canvas || !Number.isFinite(pointCount) || pointCount < 2) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const cssWidth = canvas.clientWidth || rect.width || 0;
    const innerWidth = cssWidth - pad.left - pad.right;
    if (!Number.isFinite(innerWidth) || innerWidth <= 0) {
      return null;
    }
    const x = event.clientX - rect.left;
    if (!Number.isFinite(x) || x < pad.left || x > pad.left + innerWidth) {
      return null;
    }
    const ratio = this._clamp((x - pad.left) / innerWidth, 0, 1);
    return this._clamp(Math.round(ratio * (pointCount - 1)), 0, pointCount - 1);
  }

  _bindChartHoverHandlers() {
    const bindOne = (canvas, type, pad) => {
      if (!canvas || canvas.dataset.hoverBound === "1") {
        return;
      }
      canvas.dataset.hoverBound = "1";
      canvas.style.cursor = "crosshair";

      canvas.addEventListener("pointermove", (event) => {
        if (type === "price") {
          const rows = Array.isArray(this._priceChartRows) ? this._priceChartRows : [];
          let idx = null;
          if (rows.length > 0 && event) {
            const rect = canvas.getBoundingClientRect();
            const cssWidth = canvas.clientWidth || rect.width || 0;
            const innerWidth = cssWidth - pad.left - pad.right;
            const x = event.clientX - rect.left;
            if (
              Number.isFinite(innerWidth) &&
              innerWidth > 0 &&
              Number.isFinite(x) &&
              x >= pad.left &&
              x <= pad.left + innerWidth
            ) {
              const startTs = Number.isFinite(this._priceChartRangeStart)
                ? this._priceChartRangeStart
                : rows[0]?.t;
              const fallbackEnd = rows[rows.length - 1]?.t;
              const endCandidate = Number.isFinite(this._priceChartRangeEnd)
                ? this._priceChartRangeEnd
                : fallbackEnd;
              const endTs = Number.isFinite(endCandidate) && endCandidate > startTs
                ? endCandidate
                : fallbackEnd;
              if (Number.isFinite(startTs) && Number.isFinite(endTs) && endTs > startTs) {
                const ratio = this._clamp((x - pad.left) / innerWidth, 0, 1);
                const targetTs = startTs + ratio * (endTs - startTs);
                let bestIdx = 0;
                let bestDist = Number.POSITIVE_INFINITY;
                for (let i = 0; i < rows.length; i += 1) {
                  const dist = Math.abs(rows[i].t - targetTs);
                  if (dist < bestDist) {
                    bestDist = dist;
                    bestIdx = i;
                  }
                }
                idx = bestIdx;
              }
            }
          }
          if (this._priceHoverIndex !== idx) {
            this._priceHoverIndex = idx;
            this._scheduleChartRedraw();
          }
          return;
        }

        const livePoints =
          type === "price"
            ? this._priceChartRows
            : this._trendData?.points;
        const liveCount = Array.isArray(livePoints) ? livePoints.length : 0;
        const idx = this._hoverIndexFromPointer(event, canvas, pad, liveCount);
        if (type === "trend") {
          if (this._trendHoverIndex !== idx) {
            this._trendHoverIndex = idx;
            this._scheduleChartRedraw();
          }
        } else if (type === "savings") {
          if (this._savingsHoverIndex !== idx) {
            this._savingsHoverIndex = idx;
            this._scheduleChartRedraw();
          }
        } else if (type === "detail") {
          if (this._detailHoverIndex !== idx) {
            this._detailHoverIndex = idx;
            this._scheduleChartRedraw();
          }
        } else if (this._priceHoverIndex !== idx) {
          this._priceHoverIndex = idx;
          this._scheduleChartRedraw();
        }
      });

      canvas.addEventListener("pointerleave", () => {
        if (type === "trend") {
          if (this._trendHoverIndex !== null) {
            this._trendHoverIndex = null;
            this._scheduleChartRedraw();
          }
        } else if (type === "savings") {
          if (this._savingsHoverIndex !== null) {
            this._savingsHoverIndex = null;
            this._scheduleChartRedraw();
          }
        } else if (type === "detail") {
          if (this._detailHoverIndex !== null) {
            this._detailHoverIndex = null;
            this._scheduleChartRedraw();
          }
        } else if (this._priceHoverIndex !== null) {
          this._priceHoverIndex = null;
          this._scheduleChartRedraw();
        }
      });
    };

    bindOne(this.shadowRoot?.querySelector("#trend-canvas"), "trend", {
      left: 44,
      right: 38,
    });
    bindOne(this.shadowRoot?.querySelector("#savings-canvas"), "savings", {
      left: 56,
      right: 56,
    });
    bindOne(this.shadowRoot?.querySelector("#price-canvas"), "price", {
      left: 34,
      right: 10,
    });
    bindOne(this.shadowRoot?.querySelector("#detail-canvas"), "detail", {
      left: 56,
      right: 24,
    });
  }

  _drawCanvasTooltip(ctx, lines, x, y, cssWidth, cssHeight) {
    if (!ctx || !Array.isArray(lines) || lines.length === 0) {
      return;
    }
    ctx.save();
    ctx.font = "11px Sora, Segoe UI, sans-serif";
    const lineHeight = 15;
    const padX = 8;
    const padY = 6;
    let maxWidth = 0;
    lines.forEach((line) => {
      const width = ctx.measureText(String(line || "")).width;
      if (width > maxWidth) {
        maxWidth = width;
      }
    });
    const boxW = Math.ceil(maxWidth + padX * 2);
    const boxH = Math.ceil(lines.length * lineHeight + padY * 2);
    const margin = 10;
    let boxX = x + 12;
    let boxY = y - boxH - 10;
    if (boxX + boxW > cssWidth - margin) {
      boxX = x - boxW - 12;
    }
    if (boxX < margin) {
      boxX = margin;
    }
    if (boxY < margin) {
      boxY = y + 12;
    }
    if (boxY + boxH > cssHeight - margin) {
      boxY = cssHeight - boxH - margin;
    }

    const dark = Boolean(this._themeDark);
    ctx.fillStyle = dark ? "rgba(16, 25, 39, 0.94)" : "rgba(255, 255, 255, 0.95)";
    ctx.strokeStyle = dark ? "rgba(162, 185, 208, 0.32)" : "rgba(42, 63, 82, 0.24)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = dark ? "#edf5ff" : "#183041";
    ctx.textAlign = "left";
    lines.forEach((line, idx) => {
      ctx.fillText(String(line || ""), boxX + padX, boxY + padY + 12 + idx * lineHeight);
    });
    ctx.restore();
  }

  _detailChipConfigs(extraChips = this._extraChips()) {
    const configs = {
      solar_power: {
        key: "solar_power",
        title: "PV / Solar",
        subtitle: "Leistung und Ertrag",
        icon: "mdi:white-balance-sunny",
        color: "#25b788",
        mode: "solar_positive",
      },
      grid_power: {
        key: "grid_power",
        title: "Netz",
        subtitle: "Bezug und Einspeisung",
        icon: "mdi:transmission-tower",
        color: "#8da3ba",
        mode: "grid_signed",
      },
      battery_power: {
        key: "battery_power",
        title: "Batterie",
        subtitle: "Laden und Entladen",
        icon: "mdi:battery",
        color: "#4f8dff",
        mode: "battery_signed",
      },
      load_power: {
        key: "load_power",
        title: "Hauslast Netto",
        subtitle: "Verbrauch im Haus",
        icon: "mdi:home-lightning-bolt-outline",
        color: "#f29b38",
        mode: "load_positive",
      },
    };
    if (Array.isArray(extraChips)) {
      extraChips.forEach((chip) => {
        if (!chip?.key) {
          return;
        }
        configs[chip.key] = {
          key: chip.key,
          title: chip.label || chip.key,
          subtitle: "Zusätzlicher Verbraucher",
          icon: "mdi:flash",
          color: CHIP_CABLE_COLORS[chip.accent] || "#9b7de3",
          mode: "extra_positive",
        };
      });
    }
    return configs;
  }

  _detailConfigForKey(key, extraChips = this._extraChips()) {
    if (!key) {
      return null;
    }
    const configs = this._detailChipConfigs(extraChips);
    return configs[key] || null;
  }

  _openDetailView(key, extraChips = this._extraChips()) {
    const cfg = this._detailConfigForKey(key, extraChips);
    if (!cfg) {
      return;
    }
    this._detailOpen = true;
    this._detailKey = cfg.key;
    this._detailHoverIndex = null;
    this._requestRender({ immediate: true, full: true });
  }

  _closeDetailView() {
    if (!this._detailOpen && !this._detailKey) {
      return;
    }
    this._detailOpen = false;
    this._detailKey = null;
    this._detailHoverIndex = null;
    this._requestRender({ immediate: true, full: true });
  }

  _detailCurrentPower(detailKey, liveSnapshot = {}, extraChips = this._extraChips()) {
    if (!detailKey) {
      return null;
    }
    if (detailKey === "solar_power") {
      return liveSnapshot.solar ?? null;
    }
    if (detailKey === "grid_power") {
      return liveSnapshot.grid ?? null;
    }
    if (detailKey === "battery_power") {
      return liveSnapshot.battery ?? null;
    }
    if (detailKey === "load_power") {
      return liveSnapshot.houseLoad ?? null;
    }
    const chips = Array.isArray(extraChips) ? extraChips : [];
    const chip = chips.find((entry) => entry?.key === detailKey);
    return chip ? chip.power ?? null : null;
  }

  _detailSeriesForConfig(cfg, trendData = this._trendData) {
    const empty = {
      points: [],
      values: [],
      stepHours: TREND_STEP_MIN_MS / (60 * 60 * 1000),
      signed: false,
    };
    if (!cfg || !trendData || !Array.isArray(trendData.points) || trendData.points.length === 0) {
      return empty;
    }
    const stepMs = Math.max(TREND_STEP_MIN_MS, Number(trendData.stepMs) || TREND_STEP_MIN_MS);
    const stepHours = stepMs / (60 * 60 * 1000);
    const points = trendData.points;
    const signed = cfg.mode === "grid_signed" || cfg.mode === "battery_signed";

    const values = points.map((point) => {
      if (!point || typeof point !== "object") {
        return null;
      }
      if (cfg.mode === "solar_positive") {
        const val = point.solarPower ?? point.solarCover;
        return Number.isFinite(val) ? Math.max(0, Number(val) || 0) : null;
      }
      if (cfg.mode === "load_positive") {
        const val = point.houseNetPower ?? point.load;
        return Number.isFinite(val) ? Math.max(0, Number(val) || 0) : null;
      }
      if (cfg.mode === "grid_signed") {
        const direct = point.gridSignedPower;
        if (Number.isFinite(direct)) {
          return Number(direct);
        }
        const hasImport = point.gridImportPower !== null && point.gridImportPower !== undefined;
        const hasExport = point.gridExportPower !== null && point.gridExportPower !== undefined;
        if (!hasImport && !hasExport) {
          return null;
        }
        const importPower = Number.isFinite(point.gridImportPower) ? Number(point.gridImportPower) : 0;
        const exportPower = Number.isFinite(point.gridExportPower) ? Number(point.gridExportPower) : 0;
        return importPower - exportPower;
      }
      if (cfg.mode === "battery_signed") {
        const direct = point.batterySignedPower;
        if (Number.isFinite(direct)) {
          return Number(direct);
        }
        const hasDischarge =
          point.batteryDischargePower !== null && point.batteryDischargePower !== undefined;
        const hasCharge = point.batteryChargePower !== null && point.batteryChargePower !== undefined;
        if (!hasDischarge && !hasCharge) {
          return null;
        }
        const dischargePower = Number.isFinite(point.batteryDischargePower)
          ? Number(point.batteryDischargePower)
          : 0;
        const chargePower = Number.isFinite(point.batteryChargePower)
          ? Number(point.batteryChargePower)
          : 0;
        return dischargePower - chargePower;
      }
      const val = point.extraPowers?.[cfg.key];
      return Number.isFinite(val) ? Math.max(0, Number(val) || 0) : null;
    });

    return { points, values, stepHours, signed };
  }

  _detailStatsForConfig(cfg, detailSeries, currentPower = null) {
    const stats = [];
    if (!cfg || !detailSeries) {
      return stats;
    }
    const values = Array.isArray(detailSeries.values) ? detailSeries.values : [];
    const points = Array.isArray(detailSeries.points) ? detailSeries.points : [];
    const stepHours = Number(detailSeries.stepHours) || TREND_STEP_MIN_MS / (60 * 60 * 1000);
    const valid = values.filter((value) => value !== null && value !== undefined && Number.isFinite(value));
    const count = valid.length;
    const integrateFieldKwh = (primaryField, fallbackField = null) =>
      points.reduce((sum, point) => {
        const rawPrimary = point?.[primaryField];
        const rawFallback = fallbackField ? point?.[fallbackField] : null;
        const source =
          rawPrimary === null || rawPrimary === undefined ? rawFallback : rawPrimary;
        const watts = Number(source);
        if (!Number.isFinite(watts) || watts <= 0) {
          return sum;
        }
        return sum + (watts * stepHours) / 1000;
      }, 0);

    const add = (label, value) => {
      stats.push({ label, value });
    };

    add("Aktuell", this._formatPower(currentPower));
    if (count === 0) {
      add("Energie", "--");
      add("Peak", "--");
      add("Ø Leistung", "--");
      return stats;
    }

    const positive = valid.map((value) => Math.max(0, Number(value) || 0));
    const negative = valid.map((value) => Math.max(0, -(Number(value) || 0)));

    const posKwh = positive.reduce((sum, value) => sum + (value * stepHours) / 1000, 0);
    const negKwh = negative.reduce((sum, value) => sum + (value * stepHours) / 1000, 0);
    const netKwh = valid.reduce((sum, value) => sum + ((Number(value) || 0) * stepHours) / 1000, 0);
    const peakPos = positive.length > 0 ? Math.max(...positive) : 0;
    const peakNeg = negative.length > 0 ? Math.max(...negative) : 0;
    const avgAbsW =
      valid.length > 0
        ? valid.reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0) / valid.length
        : 0;

    if (cfg.mode === "grid_signed") {
      const gridToHouseKwh = integrateFieldKwh("gridToHousePower", "gridCover");
      const gridToBatteryKwh = integrateFieldKwh("gridToBatteryPower", null);
      const gridSplitTotalKwh = Math.max(0, gridToHouseKwh + gridToBatteryKwh);
      add("Bezug (aufgeteilt)", this._formatEnergyKwh(gridSplitTotalKwh));
      add("Davon im Haus verbraucht", this._formatEnergyKwh(gridToHouseKwh));
      add("Davon in den Akku geladen", this._formatEnergyKwh(gridToBatteryKwh));
      if (Math.abs(posKwh - gridSplitTotalKwh) > 0.15) {
        add("Bezug (Rohsensor)", this._formatEnergyKwh(posKwh));
      }
      add("Einspeisung", this._formatEnergyKwh(negKwh));
      add("Netto", `${netKwh >= 0 ? "+" : "-"}${this._formatEnergyKwh(Math.abs(netKwh))}`);
      add("Peak Bezug", this._formatPower(peakPos));
      add("Peak Einspeisung", this._formatPower(-peakNeg));
      add("Ø Fluss", this._formatPower(avgAbsW));
      return stats;
    }

    if (cfg.mode === "battery_signed") {
      const batteryToHouseKwh = integrateFieldKwh("batteryToHousePower", "batteryCover");
      const batteryChargeAcKwh = integrateFieldKwh("batteryChargePower", null);
      const batteryDischargeAcKwh = integrateFieldKwh("batteryDischargePower", null);
      const batteryChargeDcKwh = integrateFieldKwh("batteryDcChargePower", null);
      const batteryDischargeDcKwh = integrateFieldKwh("batteryDcDischargePower", null);
      const batteryChargeLossKwh = integrateFieldKwh("batteryChargeLossPower", null);
      const batteryDischargeLossKwh = integrateFieldKwh("batteryDischargeLossPower", null);
      const batteryLossTotalKwh = Math.max(0, batteryChargeLossKwh + batteryDischargeLossKwh);
      add("Entladen", this._formatEnergyKwh(posKwh));
      add("Davon im Haus verbraucht", this._formatEnergyKwh(batteryToHouseKwh));
      add("Laden", this._formatEnergyKwh(negKwh));
      if (batteryLossTotalKwh > 0.0005) {
        add("Wandlungsverlust", this._formatEnergyKwh(batteryLossTotalKwh));
        add("Davon Laden", this._formatEnergyKwh(batteryChargeLossKwh));
        add("Davon Entladen", this._formatEnergyKwh(batteryDischargeLossKwh));
      }
      if (batteryChargeAcKwh > 0.01 && batteryChargeDcKwh > 0) {
        const effChargePct = this._clamp((batteryChargeDcKwh / batteryChargeAcKwh) * 100, 0, 100);
        add("Wirkungsgrad Laden", this._formatPercent(effChargePct));
      }
      if (batteryDischargeDcKwh > 0.01 && batteryDischargeAcKwh > 0) {
        const effDischargePct = this._clamp((batteryDischargeAcKwh / batteryDischargeDcKwh) * 100, 0, 100);
        add("Wirkungsgrad Entladen", this._formatPercent(effDischargePct));
      }
      add("Netto", `${netKwh >= 0 ? "+" : "-"}${this._formatEnergyKwh(Math.abs(netKwh))}`);
      add("Peak Entladen", this._formatPower(peakPos));
      add("Peak Laden", this._formatPower(-peakNeg));
      add("Ø Fluss", this._formatPower(avgAbsW));
      return stats;
    }

    const totalKwh = posKwh;
    const peakW = positive.length > 0 ? Math.max(...positive) : 0;
    const avgW = positive.length > 0 ? positive.reduce((sum, value) => sum + value, 0) / positive.length : 0;
    const activeHours = positive.filter((value) => value > 1).length * stepHours;
    if (cfg.mode === "solar_positive") {
      const solarToHouseKwhRaw = integrateFieldKwh("solarToHousePower", "solarCover");
      const solarToBatteryKwhRaw = integrateFieldKwh("solarToBatteryPower", null);
      const solarToHouseKwh = this._clamp(solarToHouseKwhRaw, 0, totalKwh);
      const solarToBatteryKwh = this._clamp(
        solarToBatteryKwhRaw,
        0,
        Math.max(0, totalKwh - solarToHouseKwh)
      );
      const solarExportEtcKwh = Math.max(0, totalKwh - solarToHouseKwh - solarToBatteryKwh);
      add("Erzeugung", this._formatEnergyKwh(totalKwh));
      add("Davon im Haus verbraucht", this._formatEnergyKwh(solarToHouseKwh));
      add("Davon in den Akku geladen", this._formatEnergyKwh(solarToBatteryKwh));
      add("Überschuss", this._formatEnergyKwh(solarExportEtcKwh));
      add("Peak", this._formatPower(peakW));
      add("Ø Leistung", this._formatPower(avgW));
      return stats;
    }

    add("Energie", this._formatEnergyKwh(totalKwh));
    add("Peak", this._formatPower(peakW));
    add("Ø Leistung", this._formatPower(avgW));
    add("Aktive Zeit", `${activeHours.toFixed(activeHours >= 10 ? 1 : 2)} h`);
    return stats;
  }

  _detailModalHTML(liveSnapshot, extraChips = this._extraChips()) {
    if (!this._detailOpen || !this._detailKey) {
      return "";
    }
    const cfg = this._detailConfigForKey(this._detailKey, extraChips);
    if (!cfg) {
      return "";
    }
    const detailSeries = this._detailSeriesForConfig(cfg, this._trendData);
    const currentPower = this._detailCurrentPower(cfg.key, liveSnapshot, extraChips);
    const stats = this._detailStatsForConfig(cfg, detailSeries, currentPower);
    const rangeLabel = this._trendData?.rangeLabel || this._trendWindow().label;
    const signed =
      cfg.mode === "grid_signed" || cfg.mode === "battery_signed";
    const directionHint =
      cfg.mode === "grid_signed"
        ? "Positiv = Netzbezug gesamt · Negativ = Einspeisung"
        : cfg.mode === "battery_signed"
          ? "Positiv = Entladen (AC) · Negativ = Laden (AC)"
          : cfg.mode === "solar_positive"
            ? "Erzeugung gesamt (Hauslast-Anteil in Kennzahlen)"
          : "Positiv = Leistungsaufnahme/Erzeugung";

    return `
      <div class="detail-overlay" data-action="close-detail-overlay">
        <section class="detail-dialog" role="dialog" aria-modal="true" aria-label="Chip Details">
          <header class="settings-head">
            <div class="settings-title icon-label">
              <ha-icon icon="${cfg.icon}"></ha-icon>
              <span>${this._escapeHtml(cfg.title)}</span>
            </div>
            <button class="btn ghost" data-action="close-detail">Schließen</button>
          </header>
          <div class="detail-meta">
            <div>${this._escapeHtml(cfg.subtitle)} · Zeitraum: <b>${this._escapeHtml(rangeLabel)}</b></div>
            <div>${signed ? "Signed Ansicht" : "Leistungsansicht"} · ${this._escapeHtml(directionHint)}</div>
          </div>
          <div class="detail-chart-wrap">
            <canvas id="detail-canvas"></canvas>
          </div>
          <div class="detail-kpis">
            ${stats
              .map(
                (item) => `
                  <article class="card">
                    <div class="k">${this._escapeHtml(item.label)}</div>
                    <div class="v">${this._escapeHtml(item.value)}</div>
                  </article>
                `
              )
              .join("")}
          </div>
        </section>
      </div>
    `;
  }

  _drawDetailChart() {
    const canvas = this.shadowRoot?.querySelector("#detail-canvas");
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const cfg = this._detailConfigForKey(this._detailKey);
    const detailSeries = this._detailSeriesForConfig(cfg, this._trendData);
    const points = detailSeries.points;
    const values = detailSeries.values;
    if (!cfg || !Array.isArray(points) || points.length < 2 || !Array.isArray(values)) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = this._themeDark ? "#9eb4c8" : "#6f8090";
      ctx.font = "12px Sora, Segoe UI, sans-serif";
      ctx.fillText(this._trendLoading ? "Lade Detaildaten..." : "Keine Detaildaten", 12, 20);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 760;
    const cssHeight = canvas.clientHeight || 236;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const pad = { left: 56, right: 24, top: 16, bottom: 24 };
    const w = cssWidth - pad.left - pad.right;
    const h = cssHeight - pad.top - pad.bottom;
    const valid = values
      .map((value) => (value === null || value === undefined || !Number.isFinite(value) ? null : Number(value)))
      .filter((value) => value !== null);

    if (valid.length < 2 || w <= 10 || h <= 10) {
      ctx.fillStyle = this._themeDark ? "#9eb4c8" : "#6f8090";
      ctx.font = "12px Sora, Segoe UI, sans-serif";
      ctx.fillText("Zu wenige Detaildaten", 12, 20);
      return;
    }

    const signed = Boolean(detailSeries.signed);
    const maxPos = Math.max(0, ...valid.map((value) => Math.max(0, value)));
    const minNeg = Math.min(0, ...valid.map((value) => Math.min(0, value)));
    const hasNegative = signed && minNeg < -0.001;
    const peakAbs = hasNegative
      ? Math.max(1, maxPos, Math.abs(minNeg))
      : Math.max(1, maxPos);
    const xAt = (i, n) => pad.left + (i / Math.max(1, n - 1)) * w;
    const yAt = (value) => {
      const v = Number(value) || 0;
      if (hasNegative) {
        return pad.top + ((peakAbs - v) / (2 * peakAbs)) * h;
      }
      return pad.top + h - (Math.max(0, v) / peakAbs) * h;
    };
    const baselineY = hasNegative ? yAt(0) : pad.top + h;

    ctx.strokeStyle = this._themeDark ? "rgba(149, 171, 193, 0.18)" : "rgba(37, 60, 78, 0.14)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
    }
    if (hasNegative) {
      ctx.strokeStyle = this._themeDark ? "rgba(168, 186, 205, 0.45)" : "rgba(53, 75, 96, 0.34)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, baselineY);
      ctx.lineTo(pad.left + w, baselineY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const yTopLabel = hasNegative ? this._formatPower(peakAbs) : this._formatPower(peakAbs);
    const yBottomLabel = hasNegative ? this._formatPower(-peakAbs) : this._formatPower(0);
    ctx.fillStyle = this._themeDark ? "#9eb4c8" : "#6f8090";
    ctx.font = "11px Sora, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(yTopLabel, pad.left - 6, pad.top + 10);
    ctx.fillText(yBottomLabel, pad.left - 6, pad.top + h);
    if (hasNegative) {
      ctx.fillText(this._formatPower(0), pad.left - 6, baselineY + 4);
    }
    ctx.textAlign = "left";
    ctx.fillText(this._trendData?.startLabel || "", pad.left, pad.top + h + 16);
    ctx.textAlign = "right";
    ctx.fillText(this._trendData?.endLabel || "", pad.left + w, pad.top + h + 16);

    ctx.beginPath();
    let areaStarted = false;
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (value === null || value === undefined || !Number.isFinite(value)) {
        if (areaStarted) {
          const prevX = xAt(i - 1, values.length);
          ctx.lineTo(prevX, baselineY);
          ctx.closePath();
          areaStarted = false;
        }
        continue;
      }
      const x = xAt(i, values.length);
      const y = yAt(value);
      if (!areaStarted) {
        ctx.moveTo(x, baselineY);
        ctx.lineTo(x, y);
        areaStarted = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    if (areaStarted) {
      ctx.lineTo(xAt(values.length - 1, values.length), baselineY);
      ctx.closePath();
    }
    ctx.fillStyle = `${cfg.color}2A`;
    ctx.fill();

    ctx.beginPath();
    let moved = false;
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i];
      if (value === null || value === undefined || !Number.isFinite(value)) {
        moved = false;
        continue;
      }
      const x = xAt(i, values.length);
      const y = yAt(value);
      if (!moved) {
        ctx.moveTo(x, y);
        moved = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.strokeStyle = cfg.color;
    ctx.lineWidth = 2.2;
    ctx.setLineDash([]);
    ctx.stroke();

    const hoverIdx = this._detailHoverIndex;
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < values.length) {
      const value = values[hoverIdx];
      const point = points[hoverIdx];
      if (value !== null && value !== undefined && Number.isFinite(value) && point?.t) {
        const x = xAt(hoverIdx, values.length);
        const y = yAt(value);
        ctx.strokeStyle = this._themeDark ? "rgba(164, 188, 214, 0.48)" : "rgba(39, 58, 77, 0.42)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + h);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.fillStyle = cfg.color;
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = this._themeDark ? "rgba(22, 33, 48, 0.9)" : "rgba(255, 255, 255, 0.9)";
        ctx.stroke();

        const intervalKwh = (Math.abs(value) * detailSeries.stepHours) / 1000;
        const lines = [
          `Zeit: ${this._formatTime(point.t)}`,
          `Leistung: ${this._formatPower(value)}`,
          `Intervall: ${this._formatEnergyKwh(intervalKwh)}`,
        ];
        this._drawCanvasTooltip(ctx, lines, x, y, cssWidth, cssHeight);
      }
    }
  }

  _uiConfigStorageKey() {
    const path = this._panel?.url_path || this._panel?.path || "default";
    return `energy_dashboard_panel_ui_config::${path}`;
  }

  _isObject(raw) {
    return Boolean(raw) && typeof raw === "object" && !Array.isArray(raw);
  }

  _cleanEntityId(raw) {
    const txt = String(raw ?? "").trim();
    return txt || null;
  }

  _cleanText(raw) {
    const txt = String(raw ?? "").trim();
    return txt || null;
  }

  _normalizeChipAccent(raw, fallback = "purple") {
    const txt = String(raw ?? "").trim().toLowerCase();
    if (CHIP_ACCENT_SET.has(txt)) {
      return txt;
    }
    return CHIP_ACCENT_SET.has(fallback) ? fallback : "purple";
  }

  _normalizeStandardChipColors(raw) {
    const source = this._isObject(raw) ? raw : {};
    const normalized = { ...STANDARD_CHIP_COLOR_DEFAULTS };
    Object.keys(STANDARD_CHIP_COLOR_DEFAULTS).forEach((key) => {
      normalized[key] = this._normalizeChipAccent(
        source[key],
        STANDARD_CHIP_COLOR_DEFAULTS[key]
      );
    });
    return normalized;
  }

  _normalizeUiConfig(raw) {
    if (!this._isObject(raw)) {
      return {};
    }
    const cfg = {};

    const setText = (key) => {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        cfg[key] = this._cleanText(raw[key]);
      }
    };
    const setEntity = (key) => {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        cfg[key] = this._cleanEntityId(raw[key]);
      }
    };

    setText("title");
    setText("background_image");
    setText("weather_location");
    setText("tibber_home_id");
    setText("battery_capacity_kwh");
    setText("battery_reserve_soc");
    setText("battery_max_charge_soc");
    setEntity("weather_entity");
    setEntity("price_entity");
    setEntity("price_fallback_entity");

    if (this._isObject(raw.sensors)) {
      cfg.sensors = {};
      Object.keys(FALLBACK_SENSORS).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(raw.sensors, key)) {
          cfg.sensors[key] = this._cleanEntityId(raw.sensors[key]);
        }
      });
    }

    if (this._isObject(raw.price_sensors)) {
      cfg.price_sensors = {};
      Object.keys(FALLBACK_PRICE_SENSORS).forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(raw.price_sensors, key)) {
          cfg.price_sensors[key] = this._cleanEntityId(raw.price_sensors[key]);
        }
      });
    }

    if (typeof raw.use_signed_battery_power === "boolean") {
      cfg.use_signed_battery_power = raw.use_signed_battery_power;
    }
    if (typeof raw.invert_battery_power_sign === "boolean") {
      cfg.invert_battery_power_sign = raw.invert_battery_power_sign;
    }
    if (typeof raw.invert_load_power_sign === "boolean") {
      cfg.invert_load_power_sign = raw.invert_load_power_sign;
    }

    const gridMode = String(raw.grid_sensor_mode || "").trim().toLowerCase();
    if (gridMode === "auto" || gridMode === "signed" || gridMode === "dual") {
      cfg.grid_sensor_mode = gridMode;
    }
    const batteryMode = String(raw.battery_sensor_mode || "").trim().toLowerCase();
    if (batteryMode === "auto" || batteryMode === "signed" || batteryMode === "dual") {
      cfg.battery_sensor_mode = batteryMode;
    }

    if (Array.isArray(raw.extra_chips)) {
      cfg.extra_chips = raw.extra_chips
        .filter((item) => this._isObject(item))
        .map((item) => ({
          key: this._cleanText(item.key),
          label: this._cleanText(item.label),
          entity: this._cleanEntityId(item.entity),
          accent: this._cleanText(item.accent),
        }))
        .filter((item) => item.entity);
    }

    if (this._isObject(raw.standard_chip_colors)) {
      cfg.standard_chip_colors = this._normalizeStandardChipColors(
        raw.standard_chip_colors
      );
    }

    return cfg;
  }

  _ensureUiConfig() {
    if (!this._uiConfigLoaded) {
      let parsed = {};
      try {
        const raw = window.localStorage.getItem(this._uiConfigStorageKey());
        parsed = raw ? JSON.parse(raw) : {};
      } catch (error) {
        parsed = {};
      }
      this._uiConfig = this._normalizeUiConfig(parsed);
      this._uiConfigLoaded = true;
    }

    if (!this._uiConfigBackendSyncStarted) {
      this._uiConfigBackendSyncStarted = true;
      void this._syncUiConfigFromBackend();
    }
  }

  async _syncUiConfigFromBackend(force = false) {
    if (!this._hass?.callApi) {
      return;
    }
    if (!force && this._uiConfigBackendSyncPromise) {
      return this._uiConfigBackendSyncPromise;
    }

    const run = async () => {
      try {
        const raw = await this._hass.callApi("GET", EDP_API_UI_CONFIG);
        const backendRaw =
          this._isObject(raw) && this._isObject(raw.config) ? raw.config : raw;
        const backendCfg = this._normalizeUiConfig(backendRaw);
        const mergedBackendCfg = { ...backendCfg };
        const backendHasChipColors =
          this._isObject(backendRaw) &&
          Object.prototype.hasOwnProperty.call(
            backendRaw,
            "standard_chip_colors"
          );
        if (
          !backendHasChipColors &&
          this._isObject(this._uiConfig?.standard_chip_colors)
        ) {
          // Keep locally saved chip colors if backend response comes from an older
          // integration version that does not expose this key yet.
          mergedBackendCfg.standard_chip_colors =
            this._normalizeStandardChipColors(
              this._uiConfig.standard_chip_colors
            );
        }
        const prev = JSON.stringify(this._uiConfig || {});
        const next = JSON.stringify(mergedBackendCfg || {});
        if (prev !== next) {
          this._uiConfig = mergedBackendCfg;
          this._saveUiConfig();
          this._positions = null;
          this._trendHoverIndex = null;
          this._savingsHoverIndex = null;
          this._detailHoverIndex = null;
          this._trendKey = null;
          this._trendData = null;
          this._trendCache.clear();
          this._lastHassSignature = "";
          this._requestRender({ immediate: true, full: true });
        }
      } catch (error) {
        // Ignore backend sync errors and keep local fallback.
      } finally {
        this._uiConfigBackendSyncPromise = null;
      }
    };
    this._uiConfigBackendSyncPromise = run();
    return this._uiConfigBackendSyncPromise;
  }

  _saveUiConfig() {
    try {
      window.localStorage.setItem(this._uiConfigStorageKey(), JSON.stringify(this._uiConfig || {}));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  _clearUiConfig() {
    this._uiConfig = {};
    try {
      window.localStorage.removeItem(this._uiConfigStorageKey());
    } catch (error) {
      // Ignore storage failures.
    }
  }

  _mergePanelConfig(baseRaw, overrideRaw) {
    const base = this._isObject(baseRaw) ? baseRaw : {};
    const override = this._isObject(overrideRaw) ? overrideRaw : {};
    const merged = { ...base, ...override };
    merged.sensors = {
      ...(this._isObject(base.sensors) ? base.sensors : {}),
      ...(this._isObject(override.sensors) ? override.sensors : {}),
    };
    merged.price_sensors = {
      ...(this._isObject(base.price_sensors) ? base.price_sensors : {}),
      ...(this._isObject(override.price_sensors) ? override.price_sensors : {}),
    };
    merged.standard_chip_colors = this._normalizeStandardChipColors({
      ...(this._isObject(base.standard_chip_colors)
        ? base.standard_chip_colors
        : {}),
      ...(this._isObject(override.standard_chip_colors)
        ? override.standard_chip_colors
        : {}),
    });
    if (Array.isArray(override.extra_chips)) {
      merged.extra_chips = override.extra_chips;
    } else if (Array.isArray(base.extra_chips)) {
      merged.extra_chips = base.extra_chips;
    } else {
      merged.extra_chips = [];
    }
    return merged;
  }

  _panelConfig() {
    this._ensureUiConfig();
    return this._mergePanelConfig(this._panel?.config || {}, this._uiConfig);
  }

  _storageKey() {
    const path = this._panel?.url_path || this._panel?.path || "default";
    return `energy_dashboard_panel_layout::${path}`;
  }

  _themeStorageKey() {
    const path = this._panel?.url_path || this._panel?.path || "default";
    return `energy_dashboard_panel_theme::${path}`;
  }

  _trendModeStorageKey() {
    const path = this._panel?.url_path || this._panel?.path || "default";
    return `energy_dashboard_panel_trend_mode::${path}`;
  }

  _trendValueModeStorageKey() {
    const path = this._panel?.url_path || this._panel?.path || "default";
    return `energy_dashboard_panel_trend_value_mode::${path}`;
  }

  _ensureThemePreference() {
    if (this._themeLoaded) {
      return;
    }
    let theme = "light";
    try {
      const raw = window.localStorage.getItem(this._themeStorageKey());
      if (raw === "dark" || raw === "light") {
        theme = raw;
      }
    } catch (error) {
      // Ignore storage failures.
    }
    this._themeDark = theme === "dark";
    this._themeLoaded = true;
  }

  _saveThemePreference() {
    try {
      window.localStorage.setItem(this._themeStorageKey(), this._themeDark ? "dark" : "light");
    } catch (error) {
      // Ignore storage failures.
    }
  }

  _setThemeDark(enabled) {
    const next = Boolean(enabled);
    if (this._themeDark === next) {
      return;
    }
    this._themeDark = next;
    this._saveThemePreference();
    this._requestRender({ immediate: true, full: true });
  }

  _ensureTrendChartMode() {
    if (this._trendChartModeLoaded) {
      return;
    }
    let mode = TREND_CHART_MODES.line;
    try {
      const raw = window.localStorage.getItem(this._trendModeStorageKey());
      if (raw === TREND_CHART_MODES.line || raw === TREND_CHART_MODES.bars) {
        mode = raw;
      }
    } catch (error) {
      // Ignore storage failures.
    }
    this._trendChartMode = mode;
    this._trendChartModeLoaded = true;
  }

  _setTrendChartMode(modeRaw) {
    const mode = modeRaw === TREND_CHART_MODES.bars ? TREND_CHART_MODES.bars : TREND_CHART_MODES.line;
    if (this._trendChartMode === mode) {
      return;
    }
    this._trendChartMode = mode;
    try {
      window.localStorage.setItem(this._trendModeStorageKey(), mode);
    } catch (error) {
      // Ignore storage failures.
    }
    this._scheduleChartRedraw();
    this._requestRender({ immediate: true, full: true });
  }

  _ensureTrendValueMode() {
    if (this._trendValueModeLoaded) {
      return;
    }
    let mode = TREND_VALUE_MODES.kw;
    try {
      const raw = window.localStorage.getItem(this._trendValueModeStorageKey());
      if (raw === TREND_VALUE_MODES.kw || raw === TREND_VALUE_MODES.kwh) {
        mode = raw;
      }
    } catch (error) {
      // Ignore storage failures.
    }
    this._trendValueMode = mode;
    this._trendValueModeLoaded = true;
  }

  _setTrendValueMode(modeRaw) {
    const mode = modeRaw === TREND_VALUE_MODES.kwh ? TREND_VALUE_MODES.kwh : TREND_VALUE_MODES.kw;
    if (this._trendValueMode === mode) {
      return;
    }
    this._trendValueMode = mode;
    try {
      window.localStorage.setItem(this._trendValueModeStorageKey(), mode);
    } catch (error) {
      // Ignore storage failures.
    }
    this._scheduleChartRedraw();
    this._requestRender({ immediate: true, full: true });
  }

  _escapeHtml(raw) {
    return String(raw ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  _settingsDraftFromConfig(cfgRaw) {
    const cfg = this._isObject(cfgRaw) ? cfgRaw : {};
    const sensors = {
      ...FALLBACK_SENSORS,
      ...(this._isObject(cfg.sensors) ? cfg.sensors : {}),
    };
    const priceSensors = {
      ...FALLBACK_PRICE_SENSORS,
      ...(this._isObject(cfg.price_sensors) ? cfg.price_sensors : {}),
    };
    const standardChipColors = this._normalizeStandardChipColors(
      cfg.standard_chip_colors
    );
    return {
      title: String(cfg.title || ""),
      background_image: String(cfg.background_image || ""),
      weather_entity: String(cfg.weather_entity || ""),
      weather_location: String(cfg.weather_location || ""),
      tibber_home_id: String(cfg.tibber_home_id || ""),
      tibber_token_configured: Boolean(cfg.tibber_token_configured),
      battery_capacity_kwh:
        cfg.battery_capacity_kwh === null || cfg.battery_capacity_kwh === undefined
          ? ""
          : String(cfg.battery_capacity_kwh),
      battery_reserve_soc:
        cfg.battery_reserve_soc === null || cfg.battery_reserve_soc === undefined
          ? "10"
          : String(cfg.battery_reserve_soc),
      battery_max_charge_soc:
        cfg.battery_max_charge_soc === null || cfg.battery_max_charge_soc === undefined
          ? "100"
          : String(cfg.battery_max_charge_soc),
      price_entity: String(cfg.price_entity || ""),
      price_fallback_entity: String(cfg.price_fallback_entity || ""),
      grid_sensor_mode: this._normalizeSensorMode(cfg.grid_sensor_mode),
      battery_sensor_mode: this._normalizeSensorMode(cfg.battery_sensor_mode),
      use_signed_battery_power: Boolean(cfg.use_signed_battery_power),
      invert_battery_power_sign: Boolean(cfg.invert_battery_power_sign),
      invert_load_power_sign: Boolean(cfg.invert_load_power_sign),
      standard_chip_colors: standardChipColors,
      sensors,
      price_sensors: priceSensors,
      extra_chips_json: Array.isArray(cfg.extra_chips)
        ? JSON.stringify(cfg.extra_chips, null, 2)
        : "[]",
    };
  }

  _openSettingsEditor() {
    this._reportOpen = false;
    this._settingsDraft = this._settingsDraftFromConfig(this._panelConfig());
    this._settingsError = "";
    this._settingsOpen = true;
    this._requestRender({ immediate: true, full: true });
  }

  _closeSettingsEditor() {
    this._settingsOpen = false;
    this._settingsDraft = null;
    this._settingsError = "";
    this._requestRender({ immediate: true, full: true });
  }

  _settingsInputValue(form, name) {
    const value = form?.elements?.namedItem(name)?.value;
    return String(value ?? "").trim();
  }

  _settingsCheckboxValue(form, name) {
    const el = form?.elements?.namedItem(name);
    return Boolean(el?.checked);
  }

  _buildUiConfigFromSettingsForm(form) {
    const toEntity = (name) => {
      const txt = this._settingsInputValue(form, name);
      return txt || null;
    };
    const toText = (name) => {
      const txt = this._settingsInputValue(form, name);
      return txt || null;
    };
    const rawExtra = this._settingsInputValue(form, "extra_chips_json");
    let parsedExtras = [];
    if (rawExtra) {
      try {
        const parsed = JSON.parse(rawExtra);
        if (!Array.isArray(parsed)) {
          return { error: "Extra Chips muss ein JSON-Array sein." };
        }
        parsedExtras = parsed;
      } catch (error) {
        return { error: "Extra Chips JSON ist ungültig." };
      }
    }

    const tokenInput = this._settingsInputValue(form, "tibber_api_token");
    const clearToken = this._settingsCheckboxValue(form, "tibber_clear_token");
    if (clearToken && tokenInput) {
      return { error: "Bitte entweder neuen Tibber Token setzen oder Token löschen." };
    }
    const currentHomeId = String(this._panelConfig().tibber_home_id || "").trim();
    const homeIdInput = this._settingsInputValue(form, "tibber_home_id");
    const homeChanged = homeIdInput !== currentHomeId;
    const runtimePayload = {};
    if (clearToken) {
      runtimePayload.clear_token = true;
    }
    if (tokenInput) {
      runtimePayload.token = tokenInput;
    }
    if (homeChanged) {
      runtimePayload.home_id = homeIdInput || "";
    }
    const hasRuntimeChange = clearToken || Boolean(tokenInput) || homeChanged;
    const standardChipColors = this._normalizeStandardChipColors({
      solar_power: this._settingsInputValue(form, "chip_color_solar_power"),
      grid_power: this._settingsInputValue(form, "chip_color_grid_power"),
      battery_power: this._settingsInputValue(form, "chip_color_battery_power"),
      load_power: this._settingsInputValue(form, "chip_color_load_power"),
    });

    const ui = {
      title: toText("title"),
      background_image: toText("background_image"),
      weather_entity: toEntity("weather_entity"),
      weather_location: toText("weather_location"),
      tibber_home_id: toText("tibber_home_id"),
      battery_capacity_kwh: toText("battery_capacity_kwh"),
      battery_reserve_soc: toText("battery_reserve_soc"),
      battery_max_charge_soc: toText("battery_max_charge_soc"),
      price_entity: toEntity("price_entity"),
      price_fallback_entity: toEntity("price_fallback_entity"),
      grid_sensor_mode: this._settingsInputValue(form, "grid_sensor_mode") || "auto",
      battery_sensor_mode: this._settingsInputValue(form, "battery_sensor_mode") || "auto",
      use_signed_battery_power: this._settingsCheckboxValue(form, "use_signed_battery_power"),
      invert_battery_power_sign: this._settingsCheckboxValue(form, "invert_battery_power_sign"),
      invert_load_power_sign: this._settingsCheckboxValue(form, "invert_load_power_sign"),
      standard_chip_colors: standardChipColors,
      sensors: {},
      price_sensors: {},
      extra_chips: parsedExtras,
    };

    Object.keys(FALLBACK_SENSORS).forEach((key) => {
      ui.sensors[key] = toEntity(`sensor_${key}`);
    });
    Object.keys(FALLBACK_PRICE_SENSORS).forEach((key) => {
      ui.price_sensors[key] = toEntity(`price_${key}`);
    });

    return {
      value: this._normalizeUiConfig(ui),
      runtime: hasRuntimeChange ? runtimePayload : null,
    };
  }

  async _saveRuntimeSettings(payload) {
    if (!payload || !this._hass?.callService) {
      return;
    }
    await this._hass.callService(EDP_DOMAIN, EDP_SERVICE_SET_TIBBER, payload);
    if (this._panel?.config && typeof this._panel.config === "object") {
      if (Object.prototype.hasOwnProperty.call(payload, "home_id")) {
        this._panel.config.tibber_home_id = payload.home_id || null;
      }
      if (payload.clear_token) {
        this._panel.config.tibber_token_configured = false;
      }
      if (payload.token) {
        this._panel.config.tibber_token_configured = true;
      }
    }
  }

  async _saveUiConfigBackend(config, reset = false) {
    if (!this._hass?.callService) {
      return;
    }
    const payload = reset ? { reset: true } : { config: config || {} };
    await this._hass.callService(EDP_DOMAIN, EDP_SERVICE_SET_UI_CONFIG, payload);
  }

  async _saveSettingsFromForm() {
    const form = this.shadowRoot?.querySelector("#settings-form");
    if (!form) {
      return;
    }
    const result = this._buildUiConfigFromSettingsForm(form);
    if (result.error) {
      this._settingsError = result.error;
      this._requestRender({ immediate: true, full: true });
      return;
    }
    try {
      await this._saveRuntimeSettings(result.runtime);
    } catch (error) {
      this._settingsError = `Tibber Einstellungen konnten nicht gespeichert werden: ${error?.message || error}`;
      this._requestRender({ immediate: true, full: true });
      return;
    }
    try {
      await this._saveUiConfigBackend(result.value, false);
    } catch (error) {
      this._settingsError = `Dashboard Einstellungen konnten nicht gespeichert werden: ${error?.message || error}`;
      this._requestRender({ immediate: true, full: true });
      return;
    }
    this._uiConfig = result.value || {};
    this._saveUiConfig();
    this._settingsError = "";
    this._settingsOpen = false;
    this._settingsDraft = null;
    this._positions = null;
    this._trendHoverIndex = null;
    this._savingsHoverIndex = null;
    this._detailHoverIndex = null;
    this._detailOpen = false;
    this._detailKey = null;
    this._trendKey = null;
    this._trendData = null;
    this._trendCache.clear();
    this._lastHassSignature = "";
    this._requestRender({ immediate: true, full: true });
  }

  async _resetSettingsToYamlFallback() {
    try {
      await this._saveUiConfigBackend({}, true);
    } catch (error) {
      this._settingsError = `Zurücksetzen auf YAML fehlgeschlagen: ${error?.message || error}`;
      this._requestRender({ immediate: true, full: true });
      return;
    }
    this._clearUiConfig();
    this._settingsOpen = false;
    this._settingsDraft = null;
    this._settingsError = "";
    this._positions = null;
    this._trendHoverIndex = null;
    this._savingsHoverIndex = null;
    this._detailHoverIndex = null;
    this._detailOpen = false;
    this._detailKey = null;
    this._trendKey = null;
    this._trendData = null;
    this._trendCache.clear();
    this._lastHassSignature = "";
    this._requestRender({ immediate: true, full: true });
  }

  _entityDatalistOptions(prefix = "") {
    const states = this._hass?.states || {};
    const ids = Object.keys(states)
      .filter((id) => (prefix ? id.startsWith(prefix) : true))
      .sort((a, b) => a.localeCompare(b));
    return ids.map((id) => `<option value="${this._escapeHtml(id)}"></option>`).join("");
  }

  _settingsInputRow({
    label,
    name,
    value = "",
    listId = "",
    placeholder = "",
    kind = "text",
    inputType = "text",
    checked = false,
    options = [],
  }) {
    if (kind === "checkbox") {
      return `
        <label class="settings-check">
          <input type="checkbox" name="${this._escapeHtml(name)}" ${checked ? "checked" : ""}>
          <span>${this._escapeHtml(label)}</span>
        </label>
      `;
    }
    if (kind === "select") {
      const opts = options
        .map(
          (opt) =>
            `<option value="${this._escapeHtml(opt.value)}" ${
              String(opt.value) === String(value) ? "selected" : ""
            }>${this._escapeHtml(opt.label)}</option>`
        )
        .join("");
      return `
        <label class="settings-row">
          <span>${this._escapeHtml(label)}</span>
          <select name="${this._escapeHtml(name)}">${opts}</select>
        </label>
      `;
    }
    return `
      <label class="settings-row">
        <span>${this._escapeHtml(label)}</span>
        <input
          type="${this._escapeHtml(inputType || "text")}"
          name="${this._escapeHtml(name)}"
          value="${this._escapeHtml(value)}"
          ${listId ? `list="${this._escapeHtml(listId)}"` : ""}
          placeholder="${this._escapeHtml(placeholder)}"
          autocomplete="off"
          spellcheck="false"
        >
      </label>
    `;
  }

  _settingsModalHTML(draft, options) {
    const sensors = this._isObject(draft?.sensors) ? draft.sensors : {};
    const priceSensors = this._isObject(draft?.price_sensors) ? draft.price_sensors : {};
    const standardChipColors = this._normalizeStandardChipColors(
      draft?.standard_chip_colors
    );
    const chipColorOptions = [
      { value: "aqua", label: "Aqua" },
      { value: "blue", label: "Blau" },
      { value: "orange", label: "Orange" },
      { value: "gray", label: "Grau" },
      { value: "purple", label: "Lila" },
    ];
    return `
      <div class="settings-overlay" data-action="close-settings-overlay">
        <section class="settings-dialog" role="dialog" aria-modal="true" aria-label="Dashboard Einstellungen">
          <header class="settings-head">
            <div class="settings-title">Dashboard Einstellungen</div>
            <button class="btn ghost" data-action="close-settings">Schließen</button>
          </header>
          ${
            this._settingsError
              ? `<div class="settings-error">${this._escapeHtml(this._settingsError)}</div>`
              : ""
          }
          <form id="settings-form" class="settings-form" onsubmit="return false;">
            <section class="settings-block">
              <h4>Allgemeine Einstellungen</h4>
              <div class="settings-note">Sidebar-Titel links kommt aus YAML (<code>sidebar_title</code>) und wird nicht live geändert.</div>
              <div class="settings-grid">
                ${this._settingsInputRow({
                  label: "Dashboard Titel (intern)",
                  name: "title",
                  value: draft?.title || "",
                  placeholder: "Visual Layer",
                })}
                ${this._settingsInputRow({
                  label: "Hintergrundbild URL",
                  name: "background_image",
                  value: draft?.background_image || "",
                  placeholder: "/energy_dashboard_panel_panel/dashboard.png?v=1",
                })}
                ${this._settingsInputRow({
                  label: "Wetter Entity",
                  name: "weather_entity",
                  value: draft?.weather_entity || "",
                  listId: "edp-weather-options",
                  placeholder: "weather.home",
                })}
                ${this._settingsInputRow({
                  label: "Wetter Ort (Open-Meteo)",
                  name: "weather_location",
                  value: draft?.weather_location || "",
                  placeholder: "Berlin,DE",
                })}
              </div>
              <div class="settings-note settings-subtitle"><b>Standard Chip Farben</b></div>
              <div class="settings-grid settings-grid-tight">
                ${this._settingsInputRow({
                  label: "Solar Chip",
                  name: "chip_color_solar_power",
                  kind: "select",
                  value: standardChipColors.solar_power,
                  options: chipColorOptions,
                })}
                ${this._settingsInputRow({
                  label: "Netz Chip",
                  name: "chip_color_grid_power",
                  kind: "select",
                  value: standardChipColors.grid_power,
                  options: chipColorOptions,
                })}
                ${this._settingsInputRow({
                  label: "Batterie Chip",
                  name: "chip_color_battery_power",
                  kind: "select",
                  value: standardChipColors.battery_power,
                  options: chipColorOptions,
                })}
                ${this._settingsInputRow({
                  label: "Hauslast Chip",
                  name: "chip_color_load_power",
                  kind: "select",
                  value: standardChipColors.load_power,
                  options: chipColorOptions,
                })}
              </div>
              <div class="settings-note settings-subtitle"><b>Extra Chips (JSON)</b></div>
              <label class="settings-row">
                <span>Array aus key/label/entity/accent</span>
                <textarea
                  name="extra_chips_json"
                  rows="6"
                  spellcheck="false"
                >${this._escapeHtml(draft?.extra_chips_json || "[]")}</textarea>
              </label>
            </section>

            <section class="settings-block">
              <h4>Tibber Einstellungen</h4>
              <div class="settings-note">Tibber Token gesetzt: <strong>${draft?.tibber_token_configured ? "Ja" : "Nein"}</strong> · Speicherung im HA Backend.</div>
              <div class="settings-grid">
                ${this._settingsInputRow({
                  label: "Tibber API Token",
                  name: "tibber_api_token",
                  value: "",
                  inputType: "password",
                  placeholder: "nur eintragen, wenn ändern",
                })}
                ${this._settingsInputRow({
                  label: "Tibber Home ID (optional)",
                  name: "tibber_home_id",
                  value: draft?.tibber_home_id || "",
                  placeholder: "optional_home_id",
                })}
                ${this._settingsInputRow({
                  label: "Preis Entity",
                  name: "price_entity",
                  value: draft?.price_entity || "",
                  listId: "edp-entity-options",
                  placeholder: "sensor.dein_preis",
                })}
                ${this._settingsInputRow({
                  label: "Preis Fallback Entity",
                  name: "price_fallback_entity",
                  value: draft?.price_fallback_entity || "",
                  listId: "edp-entity-options",
                  placeholder: "sensor.dein_preis_fallback",
                })}
                ${this._settingsInputRow({
                  label: "Tibber Token löschen",
                  name: "tibber_clear_token",
                  kind: "checkbox",
                  checked: false,
                })}
              </div>
              <div class="settings-note settings-subtitle"><b>Preis Sensoren (optional)</b></div>
              <div class="settings-grid">
                ${this._settingsInputRow({ label: "current", name: "price_current", value: priceSensors.current || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "next_1h", name: "price_next_1h", value: priceSensors.next_1h || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "next_2h", name: "price_next_2h", value: priceSensors.next_2h || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "next_3h", name: "price_next_3h", value: priceSensors.next_3h || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "next_4h", name: "price_next_4h", value: priceSensors.next_4h || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "next_5h", name: "price_next_5h", value: priceSensors.next_5h || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "min_today", name: "price_min_today", value: priceSensors.min_today || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "max_today", name: "price_max_today", value: priceSensors.max_today || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "level", name: "price_level", value: priceSensors.level || "", listId: "edp-sensor-options" })}
              </div>
            </section>

            <section class="settings-block">
              <h4>Netz Einstellungen</h4>
              <div class="settings-grid settings-grid-tight">
                ${this._settingsInputRow({
                  label: "Grid Sensor Modus",
                  name: "grid_sensor_mode",
                  kind: "select",
                  value: draft?.grid_sensor_mode || "auto",
                  options: [
                    { value: "auto", label: "auto" },
                    { value: "signed", label: "signed" },
                    { value: "dual", label: "dual" },
                  ],
                })}
                ${this._settingsInputRow({
                  label: "Load Vorzeichen invertieren",
                  name: "invert_load_power_sign",
                  kind: "checkbox",
                  checked: Boolean(draft?.invert_load_power_sign),
                })}
              </div>
              <div class="settings-note settings-subtitle"><b>Leistungssensoren (W)</b></div>
              <div class="settings-grid">
                ${this._settingsInputRow({ label: "Netz Zwei-Wege Leistung signed (grid_power)", name: "sensor_grid_power", value: sensors.grid_power || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Netzbezug Leistung (grid_import_power)", name: "sensor_grid_import_power", value: sensors.grid_import_power || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Netzeinspeisung Leistung (grid_export_power)", name: "sensor_grid_export_power", value: sensors.grid_export_power || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Gesamtlast Leistung (load_power, optional)", name: "sensor_load_power", value: sensors.load_power || "", listId: "edp-sensor-options" })}
              </div>
              <div class="settings-note settings-subtitle"><b>Energiezähler (kWh, optional aber bevorzugt)</b></div>
              <div class="settings-grid">
                ${this._settingsInputRow({ label: "Netzbezug gesamt (grid_import_energy)", name: "sensor_grid_import_energy", value: sensors.grid_import_energy || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Netzeinspeisung gesamt (grid_export_energy)", name: "sensor_grid_export_energy", value: sensors.grid_export_energy || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Gesamtlast Energie (load_energy)", name: "sensor_load_energy", value: sensors.load_energy || "", listId: "edp-sensor-options" })}
              </div>
            </section>

            <section class="settings-block">
              <h4>Solar Einstellungen</h4>
              <div class="settings-grid">
                ${this._settingsInputRow({ label: "Solar Leistung (solar_power)", name: "sensor_solar_power", value: sensors.solar_power || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "PV Erzeugung gesamt (solar_energy)", name: "sensor_solar_energy", value: sensors.solar_energy || "", listId: "edp-sensor-options" })}
              </div>
            </section>

            <section class="settings-block">
              <h4>Batterie Einstellungen</h4>
              <div class="settings-grid settings-grid-tight">
                ${this._settingsInputRow({
                  label: "Batterie Sensor Modus",
                  name: "battery_sensor_mode",
                  kind: "select",
                  value: draft?.battery_sensor_mode || "auto",
                  options: [
                    { value: "auto", label: "auto" },
                    { value: "signed", label: "signed" },
                    { value: "dual", label: "dual" },
                  ],
                })}
                ${this._settingsInputRow({
                  label: "Signed Batterie nutzen",
                  name: "use_signed_battery_power",
                  kind: "checkbox",
                  checked: Boolean(draft?.use_signed_battery_power),
                })}
                ${this._settingsInputRow({
                  label: "Batterie Vorzeichen invertieren",
                  name: "invert_battery_power_sign",
                  kind: "checkbox",
                  checked: Boolean(draft?.invert_battery_power_sign),
                })}
              </div>
              <div class="settings-note settings-subtitle"><b>Kapazität & Ziele</b></div>
              <div class="settings-grid">
                ${this._settingsInputRow({
                  label: "Akku Kapazität (kWh)",
                  name: "battery_capacity_kwh",
                  value: draft?.battery_capacity_kwh || "",
                  placeholder: "z.B. 10.2",
                })}
                ${this._settingsInputRow({
                  label: "Akku Reserve SOC (%)",
                  name: "battery_reserve_soc",
                  value: draft?.battery_reserve_soc || "10",
                  placeholder: "10",
                })}
                ${this._settingsInputRow({
                  label: "Akku Max Lade-SOC (%)",
                  name: "battery_max_charge_soc",
                  value: draft?.battery_max_charge_soc || "100",
                  placeholder: "100",
                })}
              </div>
              <div class="settings-note settings-subtitle"><b>Leistungssensoren (W)</b></div>
              <div class="settings-grid">
                ${this._settingsInputRow({ label: "Batterie WR Wirkleistung signed (battery_inverter_power)", name: "sensor_battery_inverter_power", value: sensors.battery_inverter_power || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Batterie Leistung signed (battery_power)", name: "sensor_battery_power", value: sensors.battery_power || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Batterie Laden Leistung (battery_charge_power)", name: "sensor_battery_charge_power", value: sensors.battery_charge_power || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Batterie Entladen Leistung (battery_discharge_power)", name: "sensor_battery_discharge_power", value: sensors.battery_discharge_power || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Batterie SOC (%) (battery_soc)", name: "sensor_battery_soc", value: sensors.battery_soc || "", listId: "edp-sensor-options" })}
              </div>
              <div class="settings-note settings-subtitle"><b>Energiezähler (kWh, optional)</b></div>
              <div class="settings-grid">
                ${this._settingsInputRow({ label: "Batterie Laden Energie (battery_charge_energy)", name: "sensor_battery_charge_energy", value: sensors.battery_charge_energy || "", listId: "edp-sensor-options" })}
                ${this._settingsInputRow({ label: "Batterie Entladen Energie (battery_discharge_energy)", name: "sensor_battery_discharge_energy", value: sensors.battery_discharge_energy || "", listId: "edp-sensor-options" })}
              </div>
            </section>
          </form>
          <footer class="settings-actions">
            <button class="btn ghost" data-action="close-settings">Abbrechen</button>
            <button class="btn warn" data-action="reset-settings-yaml">YAML Fallback</button>
            <button class="btn primary" data-action="save-settings">Speichern</button>
          </footer>
          <datalist id="edp-sensor-options">${options.sensorOptions}</datalist>
          <datalist id="edp-weather-options">${options.weatherOptions}</datalist>
          <datalist id="edp-entity-options">${options.entityOptions}</datalist>
        </section>
      </div>
    `;
  }

  _clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  _slugifyKey(raw) {
    const cleaned = String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    return cleaned || null;
  }

  _extraChipDefaultPosition(index) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return {
      x: this._clamp(59 + col * 24, 4, 96),
      y: this._clamp(36 + row * 12, 6, 94),
    };
  }

  _extraChips() {
    const raw = this._panelConfig().extra_chips;
    if (!Array.isArray(raw) || raw.length === 0) {
      return [];
    }

    const usedKeys = new Set(Object.keys(DEFAULT_POSITIONS));
    const chips = [];

    for (let i = 0; i < raw.length; i += 1) {
      const item = raw[i];
      if (!item || typeof item !== "object") {
        continue;
      }
      const entity = String(item.entity || "").trim();
      if (!entity) {
        continue;
      }
      const label = String(item.label || item.key || `Verbraucher ${i + 1}`).trim();
      const baseKey = this._slugifyKey(item.key || label) || `extra_${i + 1}`;
      let key = baseKey;
      let dedupe = 2;
      while (usedKeys.has(key)) {
        key = `${baseKey}_${dedupe}`;
        dedupe += 1;
      }
      usedKeys.add(key);

      const accentRaw = String(item.accent || "").trim().toLowerCase();
      const accent = CHIP_ACCENT_SET.has(accentRaw) ? accentRaw : "purple";
      chips.push({
        key,
        label: label || `Verbraucher ${i + 1}`,
        entity,
        accent,
      });
    }

    return chips;
  }

  _positionDefaults() {
    const defaults = { ...DEFAULT_POSITIONS };
    const extras = this._extraChips();
    extras.forEach((chip, idx) => {
      defaults[chip.key] = this._extraChipDefaultPosition(idx);
    });
    return defaults;
  }

  _normalizePositions(raw) {
    const defaults = this._positionDefaults();
    const result = { ...defaults };
    if (!raw || typeof raw !== "object") {
      return result;
    }
    for (const key of Object.keys(defaults)) {
      const p = raw[key];
      if (!p || typeof p !== "object") {
        continue;
      }
      const x = Number.parseFloat(p.x);
      const y = Number.parseFloat(p.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        result[key] = {
          x: this._clamp(x, 4, 96),
          y: this._clamp(y, 6, 94),
        };
      }
    }
    return result;
  }

  _loadSavedPositions() {
    try {
      const raw = window.localStorage.getItem(this._storageKey());
      if (!raw) {
        return null;
      }
      return this._normalizePositions(JSON.parse(raw));
    } catch (error) {
      return null;
    }
  }

  _savePositions() {
    if (!this._positions) {
      return;
    }
    try {
      window.localStorage.setItem(this._storageKey(), JSON.stringify(this._positions));
    } catch (error) {
      // Ignore storage failures.
    }
  }

  _resetPositions() {
    this._positions = this._positionDefaults();
    this._savePositions();
    this._requestRender({ immediate: true, full: true });
  }

  _ensurePositions() {
    if (this._positions) {
      return;
    }
    const configPositions = this._panelConfig().positions || null;
    const saved = this._loadSavedPositions();
    this._positions = this._normalizePositions({
      ...configPositions,
      ...saved,
    });
  }

  _sensors() {
    const merged = {
      ...FALLBACK_SENSORS,
      ...(this._panelConfig().sensors || {}),
    };
    const loadEntity = typeof merged.load_power === "string" ? merged.load_power.trim() : "";
    if (loadEntity) {
      const loadEntityKey = loadEntity.toLowerCase();
      if (LEGACY_LOAD_SENSOR_IDS.has(loadEntityKey) && !this._stateObj(loadEntity)) {
        merged.load_power = null;
      }
    }
    return merged;
  }

  _priceSensors() {
    return {
      ...FALLBACK_PRICE_SENSORS,
      ...(this._panelConfig().price_sensors || {}),
    };
  }

  _trackedEntityIds() {
    const ids = [];
    const sensors = this._sensors();
    const priceSensors = this._priceSensors();
    const extras = this._extraChips();

    ids.push(...Object.values(sensors));
    ids.push(...Object.values(priceSensors));
    ids.push(this._priceEntityId());
    ids.push(this._weatherEntityId());
    ids.push(...Object.values(LIFETIME_SENSORS));
    ids.push(TIBBER_PRICE_SENSOR);
    ids.push(TIBBER_LIVE_GRID_SENSOR);
    extras.forEach((chip) => ids.push(chip.entity));

    return [...new Set(ids.filter((id) => typeof id === "string" && id.trim()))];
  }

  _hassSignature(hassObj) {
    if (!hassObj?.states) {
      return "no_states";
    }
    const ids = this._trackedEntityIds();
    if (ids.length === 0) {
      return "no_entities";
    }
    return ids
      .map((entityId) => {
        const stateObj = hassObj.states[entityId];
        if (!stateObj) {
          return `${entityId}:missing`;
        }
        return `${entityId}:${stateObj.state}|${stateObj.last_updated || ""}|${
          stateObj.last_changed || ""
        }`;
      })
      .join(";");
  }

  _flowOptions() {
    const cfg = this._panelConfig();
    const gridSensorMode = this._normalizeSensorMode(
      cfg.grid_sensor_mode ?? FLOW_OPTION_DEFAULTS.grid_sensor_mode
    );
    const batterySensorMode = this._normalizeSensorMode(
      cfg.battery_sensor_mode ?? FLOW_OPTION_DEFAULTS.battery_sensor_mode
    );
    return {
      useSignedBatteryPower: Boolean(
        cfg.use_signed_battery_power ?? FLOW_OPTION_DEFAULTS.use_signed_battery_power
      ),
      invertBatteryPowerSign: Boolean(
        cfg.invert_battery_power_sign ?? FLOW_OPTION_DEFAULTS.invert_battery_power_sign
      ),
      invertLoadPowerSign: Boolean(
        cfg.invert_load_power_sign ?? FLOW_OPTION_DEFAULTS.invert_load_power_sign
      ),
      gridSensorMode,
      batterySensorMode,
    };
  }

  _normalizeSensorMode(raw) {
    const value = String(raw || "")
      .trim()
      .toLowerCase();
    if (value === "signed" || value === "dual") {
      return value;
    }
    return "auto";
  }

  _deriveLoadFromInputs({ solarPower, gridSignedPower, batteryDischargePower }) {
    if (
      solarPower === null ||
      gridSignedPower === null ||
      batteryDischargePower === null
    ) {
      return null;
    }
    const derived =
      Math.max(0, solarPower) +
      gridSignedPower +
      Math.max(0, batteryDischargePower);
    return Math.max(0, derived);
  }

  _resolveLoadPower(entityId, flowOpts = this._flowOptions(), fallbackInputs = null) {
    const raw = this._numericPowerState(entityId);
    if (raw !== null) {
      const normalized = flowOpts.invertLoadPowerSign ? -raw : raw;
      return Math.max(0, normalized);
    }

    if (!fallbackInputs || typeof fallbackInputs !== "object") {
      return null;
    }
    return this._deriveLoadFromInputs(fallbackInputs);
  }

  _stateObj(entityId) {
    return this._hass?.states?.[entityId] || null;
  }

  _numericState(entityId) {
    const stateObj = this._stateObj(entityId);
    if (!stateObj) {
      return null;
    }
    const raw = String(stateObj.state ?? "").trim();
    const parsed = Number.parseFloat(raw.replace(",", ".").replace(/[^\d+\-.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  _powerToWatts(value, unitRaw) {
    if (value === null || value === undefined) {
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return null;
    }

    const unit = String(unitRaw || "")
      .toLowerCase()
      .replace(/\s+/g, "");
    if (!unit) {
      return n;
    }
    if (unit.includes("gw")) {
      return n * 1000000000;
    }
    if (unit.includes("mw")) {
      return n * 1000000;
    }
    if (unit.includes("kw")) {
      return n * 1000;
    }
    return n;
  }

  _numericPowerState(entityId) {
    const stateObj = this._stateObj(entityId);
    if (!stateObj) {
      return null;
    }
    const raw = this._numericState(entityId);
    if (raw === null) {
      return null;
    }
    return this._powerToWatts(raw, stateObj.attributes?.unit_of_measurement);
  }

  _parseNumber(raw) {
    if (raw === null || raw === undefined) {
      return null;
    }
    const txt = String(raw).trim();
    if (!txt) {
      return null;
    }
    const parsed = Number.parseFloat(txt.replace(",", ".").replace(/[^\d+\-.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  _energyToKwh(value, unitRaw, keyHint = "") {
    if (value === null || value === undefined) {
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return null;
    }
    const unit = String(unitRaw || "")
      .toLowerCase()
      .replace(/\s+/g, "");
    const hint = String(keyHint || "").toLowerCase();
    if (unit.includes("mwh") || hint.includes("mwh")) {
      return n * 1000;
    }
    if (unit.includes("kwh") || hint.includes("kwh")) {
      return n;
    }
    if (unit.includes("wh") || hint.endsWith("_wh") || hint.includes("energy_full")) {
      return n / 1000;
    }
    return n;
  }

  _batteryCapacityFromSocAttributes(sensors = this._sensors()) {
    const socState = this._stateObj(sensors?.battery_soc);
    const attrs = socState?.attributes || {};
    const candidates = [
      "battery_capacity_kwh",
      "capacity_kwh",
      "nominal_capacity_kwh",
      "usable_capacity_kwh",
      "total_capacity_kwh",
      "battery_capacity_wh",
      "capacity_wh",
      "nominal_capacity_wh",
      "usable_capacity_wh",
      "energy_full",
      "energy_full_design",
      "max_energy_wh",
      "battery_capacity",
      "capacity",
      "nominal_capacity",
      "usable_capacity",
      "max_energy",
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const key = candidates[i];
      if (!Object.prototype.hasOwnProperty.call(attrs, key)) {
        continue;
      }
      const num = this._parseNumber(attrs[key]);
      if (num === null || num <= 0) {
        continue;
      }
      const kwh = this._energyToKwh(num, null, key);
      if (kwh !== null && kwh > 0) {
        return kwh;
      }
    }
    return null;
  }

  _batteryCapacityKwh(sensors = this._sensors(), cfg = this._panelConfig()) {
    const fromConfig = this._parseNumber(cfg?.battery_capacity_kwh);
    if (fromConfig !== null && fromConfig > 0) {
      return fromConfig;
    }
    return this._batteryCapacityFromSocAttributes(sensors);
  }

  _formatDurationHours(hours) {
    if (!Number.isFinite(hours) || hours <= 0) {
      return "0m";
    }
    const totalMin = Math.max(0, Math.round(hours * 60));
    const days = Math.floor(totalMin / (24 * 60));
    const hoursPart = Math.floor((totalMin % (24 * 60)) / 60);
    const mins = totalMin % 60;
    if (days > 0) {
      if (hoursPart > 0) {
        return `${days}d ${hoursPart}h`;
      }
      return `${days}d`;
    }
    if (hoursPart > 0) {
      return `${hoursPart}h ${mins}m`;
    }
    return `${mins}m`;
  }

  _batteryRuntimeEstimate({
    sensors = this._sensors(),
    soc = null,
    batteryDischarge = null,
  }) {
    const cfg = this._panelConfig();
    const capacityKwh = this._batteryCapacityKwh(sensors, cfg);
    const reserveSocRaw = this._parseNumber(cfg?.battery_reserve_soc);
    const reserveSoc = this._clamp(reserveSocRaw ?? 10, 0, 99);

    if (soc === null) {
      return {
        label: "--",
        detail: "SOC fehlt",
      };
    }
    if (capacityKwh === null || capacityKwh <= 0) {
      return {
        label: "--",
        detail: "Akku-Kapazität fehlt",
      };
    }

    const usableSocPct = this._clamp(soc - reserveSoc, 0, 100);
    const usableKwh = capacityKwh * (usableSocPct / 100);
    const dischargeW = Math.max(0, Number(batteryDischarge) || 0);

    if (dischargeW < 30) {
      return {
        label: "--",
        detail: `Nicht am Entladen · ${usableKwh.toFixed(2)} kWh verfügbar`,
      };
    }
    if (usableKwh <= 0.001) {
      return {
        label: "0m",
        detail: "Reserve erreicht",
      };
    }

    const hours = usableKwh / (dischargeW / 1000);
    return {
      label: this._formatDurationHours(hours),
      detail: `bei ${this._formatPower(dischargeW)} · ${usableKwh.toFixed(2)} kWh`,
    };
  }

  _batteryChargeEstimate({
    sensors = this._sensors(),
    soc = null,
    batteryCharge = null,
  }) {
    const cfg = this._panelConfig();
    const capacityKwh = this._batteryCapacityKwh(sensors, cfg);
    const targetSocRaw = this._parseNumber(cfg?.battery_max_charge_soc);
    const targetSoc = this._clamp(targetSocRaw ?? 100, 1, 100);

    if (soc === null) {
      return {
        label: "--",
        detail: "SOC fehlt",
      };
    }
    if (capacityKwh === null || capacityKwh <= 0) {
      return {
        label: "--",
        detail: "Akku-Kapazität fehlt",
      };
    }

    const remainingSocPct = this._clamp(targetSoc - soc, 0, 100);
    const remainingKwh = capacityKwh * (remainingSocPct / 100);
    const chargeW = Math.max(0, Number(batteryCharge) || 0);

    if (remainingKwh <= 0.001) {
      return {
        label: "0m",
        detail: `Ziel ${Math.round(targetSoc)}% erreicht`,
        targetSoc: Math.round(targetSoc),
      };
    }

    if (chargeW < 30) {
      return {
        label: "--",
        detail: `Nicht am Laden · ${remainingKwh.toFixed(2)} kWh bis ${Math.round(targetSoc)}%`,
        targetSoc: Math.round(targetSoc),
      };
    }

    const hours = remainingKwh / (chargeW / 1000);
    return {
      label: this._formatDurationHours(hours),
      detail: `bei ${this._formatPower(chargeW)} · ${remainingKwh.toFixed(2)} kWh bis ${Math.round(targetSoc)}%`,
      targetSoc: Math.round(targetSoc),
    };
  }

  _powerScale(entityId) {
    if (!entityId) {
      return 1;
    }
    const unit = this._stateObj(entityId)?.attributes?.unit_of_measurement;
    const scale = this._powerToWatts(1, unit);
    return Number.isFinite(scale) && scale > 0 ? scale : 1;
  }

  _seriesEnergyKwh(entityId, rawValue) {
    if (!entityId || rawValue === null || rawValue === undefined) {
      return null;
    }
    const unit = this._stateObj(entityId)?.attributes?.unit_of_measurement;
    return this._energyToKwh(rawValue, unit, entityId);
  }

  _counterDeltaKwh(prevKwh, nextKwh) {
    if (
      prevKwh === null ||
      prevKwh === undefined ||
      nextKwh === null ||
      nextKwh === undefined
    ) {
      return null;
    }
    const delta = Number(nextKwh) - Number(prevKwh);
    if (!Number.isFinite(delta)) {
      return null;
    }
    // Ignore meter resets/rollovers for one interval and continue from next value.
    if (delta < -0.001) {
      return null;
    }
    return Math.max(0, delta);
  }

  _formatPower(value) {
    if (value === null) {
      return "--";
    }
    const abs = Math.abs(value);
    if (abs >= 1000) {
      return `${(value / 1000).toFixed(2)} kW`;
    }
    return `${value.toFixed(0)} W`;
  }

  _formatPowerTight(value) {
    if (value === null) {
      return "--";
    }
    const abs = Math.abs(value);
    if (abs >= 1000) {
      return `${(value / 1000).toFixed(2)}kW`;
    }
    return `${value.toFixed(0)}W`;
  }

  _trendMetricFromPowerW(powerW, stepHours) {
    if (powerW === null || powerW === undefined) {
      return null;
    }
    const watts = Math.max(0, Number(powerW) || 0);
    if (this._trendValueMode === TREND_VALUE_MODES.kwh) {
      return (watts * stepHours) / 1000;
    }
    return watts / 1000;
  }

  _formatTrendMetricValue(powerW, stepHours) {
    const value = this._trendMetricFromPowerW(powerW, stepHours);
    if (value === null || !Number.isFinite(value)) {
      return "--";
    }
    if (this._trendValueMode === TREND_VALUE_MODES.kwh) {
      const decimals = value >= 1 ? 2 : 3;
      return `${value.toFixed(decimals)} kWh`;
    }
    const decimals = value >= 10 ? 1 : 2;
    return `${value.toFixed(decimals)} kW`;
  }

  _formatTrendAxisValue(value) {
    const n = Math.max(0, Number(value) || 0);
    if (this._trendValueMode === TREND_VALUE_MODES.kwh) {
      const decimals = n >= 1 ? 2 : 3;
      return `${n.toFixed(decimals)} kWh`;
    }
    const decimals = n >= 10 ? 1 : 2;
    return `${n.toFixed(decimals)} kW`;
  }

  _trendMetricLegendUnit() {
    return this._trendValueMode === TREND_VALUE_MODES.kwh ? "kWh/Intervall" : "kW";
  }

  _formatEnergyKwh(valueKwh) {
    if (valueKwh === null || valueKwh === undefined) {
      return "--";
    }
    const n = Number(valueKwh);
    if (!Number.isFinite(n)) {
      return "--";
    }
    const safe = Math.max(0, n);
    const decimals = safe >= 10 ? 1 : 2;
    return `${safe.toFixed(decimals)} kWh`;
  }

  _formatPercent(value) {
    if (value === null) {
      return "--";
    }
    return `${Math.max(0, Math.min(100, value)).toFixed(0)} %`;
  }

  _remainingHoursToday() {
    const now = new Date();
    const end = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      24,
      0,
      0,
      0
    );
    const diffMs = end.getTime() - now.getTime();
    return Math.max(0, diffMs / (60 * 60 * 1000));
  }

  _gridProjectionSummary({ houseLoad, gridImport, houseSources }) {
    const remainingHours = this._remainingHoursToday();
    if (houseLoad === null) {
      return {
        main: "--",
        detail: "Rest heute: Lastdaten fehlen",
      };
    }

    const loadW = Math.max(0, Number(houseLoad) || 0);
    const gridW = Math.max(0, Number(gridImport) || 0);
    const solarW = Math.max(0, Number(houseSources?.solarToHouse) || 0);
    const localW = Math.max(
      0,
      (Number(houseSources?.solarToHouse) || 0) + (Number(houseSources?.batteryToHouse) || 0)
    );
    const autarkyNow = loadW > 0 ? this._clamp((1 - gridW / loadW) * 100, 0, 100) : null;

    const gridKwh = (gridW * remainingHours) / 1000;
    const solarKwh = (solarW * remainingHours) / 1000;
    const localKwh = (localW * remainingHours) / 1000;

    return {
      main: `Rest heute: Netz ${this._formatEnergyKwh(gridKwh)} · Solar ${this._formatEnergyKwh(solarKwh)}`,
      detail: `Lokal inkl. Akku ${this._formatEnergyKwh(localKwh)} · Autarkie ${this._formatPercent(autarkyNow)}`,
    };
  }

  _formatMoneyEur(valueEur) {
    if (valueEur === null || valueEur === undefined) {
      return "--";
    }
    const n = Number(valueEur);
    if (!Number.isFinite(n)) {
      return "--";
    }
    return `${n.toFixed(2)} €`;
  }

  _formatMoneyWithCent(valueEur) {
    if (valueEur === null || valueEur === undefined) {
      return "--";
    }
    const n = Number(valueEur);
    if (!Number.isFinite(n)) {
      return "--";
    }
    return `${n.toFixed(2)}€`;
  }

  _formatBatteryTwoWay(chargePower, dischargePower) {
    const charge = Math.max(0, Number(chargePower) || 0);
    const discharge = Math.max(0, Number(dischargePower) || 0);
    return `↓${this._formatPowerTight(charge)} · ↑${this._formatPowerTight(discharge)}`;
  }

  _gridStatus(gridPower) {
    if (gridPower === null) {
      this._gridStatusState = "unknown";
      return "Unbekannt";
    }

    let state = this._gridStatusState;
    if (!state || state === "unknown") {
      state = "idle";
    }

    if (state === "import") {
      if (gridPower <= GRID_STATUS_EXIT_W) {
        if (gridPower <= -GRID_STATUS_ENTER_W) {
          state = "export";
        } else {
          state = "idle";
        }
      }
    } else if (state === "export") {
      if (gridPower >= -GRID_STATUS_EXIT_W) {
        if (gridPower >= GRID_STATUS_ENTER_W) {
          state = "import";
        } else {
          state = "idle";
        }
      }
    } else if (gridPower >= GRID_STATUS_ENTER_W) {
      state = "import";
    } else if (gridPower <= -GRID_STATUS_ENTER_W) {
      state = "export";
    } else {
      state = "idle";
    }

    this._gridStatusState = state;

    if (state === "import") {
      return "Netzbezug";
    }
    if (state === "export") {
      return "Einspeisung";
    }
    return "Nahe 0";
  }

  _batteryStatus(batteryPower) {
    if (batteryPower === null) {
      return "Unbekannt";
    }
    if (batteryPower > 25) {
      return "Entlädt";
    }
    if (batteryPower < -25) {
      return "Lädt";
    }
    return "Idle";
  }

  _autarky(loadPower, gridPower) {
    if (loadPower === null || gridPower === null || loadPower <= 0) {
      return null;
    }
    const gridImport = Math.max(gridPower, 0);
    const ratio = (1 - gridImport / loadPower) * 100;
    return this._clamp(ratio, 0, 100);
  }

  _batteryChargeSource({ solarPower, houseLoad, batteryCharge, gridImport }) {
    const charge = batteryCharge ?? null;
    if (charge === null || charge <= 20) {
      return {
        mode: "idle",
        label: "Nicht am Laden",
        detail: "--",
        solarPart: 0,
        gridPart: 0,
      };
    }

    let solarToBat = null;
    let gridToBat = null;

    if (solarPower !== null && houseLoad !== null) {
      const solarSurplus = Math.max(0, solarPower - houseLoad);
      solarToBat = Math.min(charge, solarSurplus);
      gridToBat = Math.max(0, charge - solarToBat);
    } else if (gridImport !== null) {
      gridToBat = Math.min(charge, Math.max(0, gridImport));
      solarToBat = Math.max(0, charge - gridToBat);
    } else {
      return {
        mode: "unknown",
        label: "Quelle unklar",
        detail: "zu wenig Daten",
        solarPart: 0,
        gridPart: 0,
      };
    }

    const solarPct = charge > 0 ? this._clamp((solarToBat / charge) * 100, 0, 100) : 0;
    const gridPct = charge > 0 ? this._clamp((gridToBat / charge) * 100, 0, 100) : 0;

    let mode = "mix";
    let label = "Lädt aus Mix";
    if (solarPct >= 90) {
      mode = "solar";
      label = "Lädt aus Solar";
    } else if (gridPct >= 90) {
      mode = "grid";
      label = "Lädt aus Netz";
    }

    return {
      mode,
      label,
      detail: `${Math.round(solarPct)}% Solar / ${Math.round(gridPct)}% Netz`,
      solarPart: solarToBat,
      gridPart: gridToBat,
    };
  }

  _houseSourceBreakdown({ houseLoad, solarPower, batteryDischarge, gridImport }) {
    if (houseLoad === null || houseLoad <= 0) {
      return {
        solarToHouse: 0,
        batteryToHouse: 0,
        gridToHouse: 0,
        solarPct: 0,
        batteryPct: 0,
        gridPct: 0,
      };
    }

    const solarAvail = Math.max(0, solarPower ?? 0);
    const solarToHouse = Math.min(houseLoad, solarAvail);

    const afterSolar = Math.max(0, houseLoad - solarToHouse);
    const batteryAvail = Math.max(0, batteryDischarge ?? 0);
    const batteryToHouse = Math.min(afterSolar, batteryAvail);

    const afterBattery = Math.max(0, afterSolar - batteryToHouse);
    const gridAvail = gridImport === null ? afterBattery : Math.max(0, gridImport);
    const gridToHouse = Math.min(afterBattery, gridAvail);

    const solarPct = this._clamp((solarToHouse / houseLoad) * 100, 0, 100);
    const batteryPct = this._clamp((batteryToHouse / houseLoad) * 100, 0, 100);
    const gridPct = this._clamp((gridToHouse / houseLoad) * 100, 0, 100);

    return {
      solarToHouse,
      batteryToHouse,
      gridToHouse,
      solarPct,
      batteryPct,
      gridPct,
    };
  }

  _trendWindow() {
    const now = Date.now();
    if (this._trendRange === TREND_RANGES.day24.key) {
      const startMs = now - 24 * 60 * 60 * 1000;
      return {
        key: TREND_RANGES.day24.key,
        label: TREND_RANGES.day24.label,
        startMs,
        endMs: now,
        stepMs: TREND_STEP_MIN_MS,
      };
    }
    if (this._trendRange === TREND_RANGES.week7.key) {
      const startMs = now - 7 * 24 * 60 * 60 * 1000;
      return {
        key: TREND_RANGES.week7.key,
        label: TREND_RANGES.week7.label,
        startMs,
        endMs: now,
        stepMs: 60 * 60 * 1000,
      };
    }
    if (this._trendRange === TREND_RANGES.month.key) {
      const today = new Date();
      const startMs = new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
        0,
        0,
        0,
        0
      ).getTime();
      const days = Math.max(1, (now - startMs) / (24 * 60 * 60 * 1000));
      return {
        key: TREND_RANGES.month.key,
        label: `Monat ${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`,
        startMs,
        endMs: now,
        stepMs: days > 16 ? 60 * 60 * 1000 : 30 * 60 * 1000,
      };
    }
    if (this._trendRange === TREND_RANGES.total.key) {
      const today = new Date();
      const start = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0);
      const startMs = start.getTime();
      const days = (now - startMs) / (24 * 60 * 60 * 1000);
      let stepMs = 60 * 60 * 1000;
      if (days > 120) {
        stepMs = 2 * 60 * 60 * 1000;
      }
      if (days > 240) {
        stepMs = 4 * 60 * 60 * 1000;
      }
      return {
        key: TREND_RANGES.total.key,
        label: `Gesamt seit ${this._formatDate(startMs)}`,
        startMs,
        endMs: now,
        stepMs,
      };
    }

    const today = new Date();
    const startMs = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0,
      0,
      0,
      0
    ).getTime();
    return {
      key: TREND_RANGES.today.key,
      label: TREND_RANGES.today.label,
      startMs,
      endMs: now,
      stepMs: TREND_STEP_MIN_MS,
    };
  }

  _formatTime(ts) {
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  _formatDate(ts) {
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    return `${dd}.${mm}.${yyyy}`;
  }

  _formatDateTime(ts) {
    const d = new Date(ts);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getFullYear());
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
  }

  _reportWindow(period = "month") {
    const now = Date.now();
    const today = new Date();
    if (period === "year") {
      const startMs = new Date(today.getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
      const days = Math.max(1, (now - startMs) / (24 * 60 * 60 * 1000));
      let stepMs = 60 * 60 * 1000;
      if (days > 120) {
        stepMs = 2 * 60 * 60 * 1000;
      }
      if (days > 240) {
        stepMs = 4 * 60 * 60 * 1000;
      }
      return {
        key: "report_year",
        label: `Jahr ${today.getFullYear()}`,
        startMs,
        endMs: now,
        stepMs,
      };
    }

    const startMs = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0).getTime();
    const days = Math.max(1, (now - startMs) / (24 * 60 * 60 * 1000));
    return {
      key: "report_month",
      label: `Monat ${String(today.getMonth() + 1).padStart(2, "0")}.${today.getFullYear()}`,
      startMs,
      endMs: now,
      stepMs: days > 16 ? 60 * 60 * 1000 : 30 * 60 * 1000,
    };
  }

  _setTrendRange(rangeKey) {
    if (!TREND_RANGES[rangeKey] || this._trendRange === rangeKey) {
      return;
    }
    this._trendRange = rangeKey;
    this._trendKey = null;
    this._trendData = null;
    this._trendHoverIndex = null;
    this._savingsHoverIndex = null;
    this._detailHoverIndex = null;
    this._requestRender({ immediate: true, full: true });
  }

  _setTrendCache(key, data, ts = Date.now()) {
    if (!key || !data) {
      return;
    }
    this._trendCache.set(key, { data, ts });
    if (this._trendCache.size <= 12) {
      return;
    }
    let oldestKey = null;
    let oldestTs = Number.POSITIVE_INFINITY;
    this._trendCache.forEach((entry, entryKey) => {
      if (entry?.ts < oldestTs) {
        oldestTs = entry.ts;
        oldestKey = entryKey;
      }
    });
    if (oldestKey) {
      this._trendCache.delete(oldestKey);
    }
  }

  _priceEntityId() {
    const cfg = this._panelConfig();
    const explicit = cfg.price_entity || cfg.price_fallback_entity || null;
    this._cachedAutoPriceEntity = null;
    if (explicit) {
      return explicit;
    }
    if (this._stateObj(TIBBER_PRICE_SENSOR)) {
      return TIBBER_PRICE_SENSOR;
    }
    return null;
  }

  _trendPriceConfig() {
    const entityId = this._priceEntityId();
    if (!entityId) {
      return {
        entityId: null,
        unit: "€/kWh",
      };
    }
    const stateObj = this._stateObj(entityId);
    const unit = this._normalizePriceUnit(stateObj?.attributes?.unit_of_measurement || "€/kWh");
    return {
      entityId,
      unit,
    };
  }

  _extractPriceRows(rawRows, dayStartMs = null, unit = null) {
    if (!Array.isArray(rawRows)) {
      return [];
    }
    const out = [];
    for (let i = 0; i < rawRows.length; i += 1) {
      const row = rawRows[i];
      if (typeof row === "number") {
        if (dayStartMs === null) {
          continue;
        }
        const price = this._priceToEur(row, unit);
        if (price !== null) {
          out.push({ t: dayStartMs + i * 60 * 60 * 1000, p: price });
        }
        continue;
      }
      if (!row || typeof row !== "object") {
        continue;
      }
      const priceRaw =
        this._toNum(row.total) ??
        this._toNum(row.price) ??
        this._toNum(row.value) ??
        this._toNum(row.energy);
      const rowUnit = row.unit_of_measurement || row.unit || unit;
      const price = this._priceToEur(priceRaw, rowUnit);
      const tRaw = row.startsAt || row.start || row.time || row.datetime || row.from;
      const t = tRaw ? new Date(tRaw).getTime() : dayStartMs !== null ? dayStartMs + i * 60 * 60 * 1000 : NaN;
      if (!Number.isFinite(t) || price === null) {
        continue;
      }
      out.push({ t, p: price });
    }
    out.sort((a, b) => a.t - b.t);
    return out;
  }

  _quantile(values, q) {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }
    const arr = [...values].sort((a, b) => a - b);
    const pos = (arr.length - 1) * q;
    const low = Math.floor(pos);
    const high = Math.ceil(pos);
    if (low === high) {
      return arr[low];
    }
    const ratio = pos - low;
    return arr[low] * (1 - ratio) + arr[high] * ratio;
  }

  _inferPriceResolutionMs(rows) {
    if (!Array.isArray(rows) || rows.length < 2) {
      return 60 * 60 * 1000;
    }
    let minDiff = Infinity;
    for (let i = 1; i < rows.length; i += 1) {
      const a = rows[i - 1];
      const b = rows[i];
      const diff = (Number(b?.t) || 0) - (Number(a?.t) || 0);
      if (Number.isFinite(diff) && diff > 0 && diff < minDiff) {
        minDiff = diff;
      }
    }
    if (!Number.isFinite(minDiff)) {
      return 60 * 60 * 1000;
    }
    if (minDiff < 5 * 60 * 1000 || minDiff > 6 * 60 * 60 * 1000) {
      return 60 * 60 * 1000;
    }
    return minDiff;
  }

  _normalizePriceUnit(unit) {
    const raw = String(unit || "").trim();
    if (!raw) {
      return "€/kWh";
    }
    const normalized = raw.toLowerCase().replace(/\s+/g, "");
    if (
      normalized.includes("ct/kwh") ||
      normalized.includes("¢/kwh") ||
      normalized.includes("cent/kwh")
    ) {
      return "ct/kWh";
    }
    if (
      normalized.includes("€/kwh") ||
      normalized.includes("eur/kwh") ||
      normalized.includes("euro/kwh")
    ) {
      return "€/kWh";
    }
    return raw;
  }

  _priceToEur(value, unit) {
    if (value === null || value === undefined) {
      return null;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return null;
    }
    const u = this._normalizePriceUnit(unit).toLowerCase();
    if (u === "ct/kwh") {
      return n / 100;
    }
    return n;
  }

  _priceFromEur(valueEur, unit) {
    if (valueEur === null || valueEur === undefined) {
      return null;
    }
    const n = Number(valueEur);
    if (!Number.isFinite(n)) {
      return null;
    }
    const u = this._normalizePriceUnit(unit).toLowerCase();
    if (u === "ct/kwh") {
      return n * 100;
    }
    return n;
  }

  _priceValueFromEntity(entityId, fallbackUnit = null) {
    const unitDefault = this._normalizePriceUnit(fallbackUnit || "€/kWh");
    if (!entityId) {
      return { entityId: null, unit: unitDefault, valueEur: null };
    }
    const stateObj = this._stateObj(entityId);
    if (!stateObj) {
      return { entityId, unit: unitDefault, valueEur: null };
    }
    const attrs = stateObj.attributes || {};
    const unit = this._normalizePriceUnit(attrs.unit_of_measurement || unitDefault);
    const rawValue =
      this._toNum(stateObj.state) ??
      this._toNum(attrs.current_price) ??
      this._toNum(attrs.price) ??
      null;
    return {
      entityId,
      unit,
      valueEur: this._priceToEur(rawValue, unit),
    };
  }

  _priceRowsFromNextSensors(priceSensors, fallbackUnit = null) {
    const rows = [];
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const base = now.getTime();

    const keys = [
      ["next_1h", 1],
      ["next_2h", 2],
      ["next_3h", 3],
      ["next_4h", 4],
      ["next_5h", 5],
    ];

    for (const [key, hourOffset] of keys) {
      const entityId = priceSensors[key];
      if (!entityId) {
        continue;
      }
      const info = this._priceValueFromEntity(entityId, fallbackUnit);
      if (info.valueEur === null) {
        continue;
      }
      rows.push({ t: base + hourOffset * 60 * 60 * 1000, p: info.valueEur });
    }
    return rows;
  }

  _modeFromPriceLevel(levelValue) {
    const txt = String(levelValue || "").trim().toLowerCase();
    if (!txt || txt === "unknown" || txt === "unavailable" || txt === "unbekannt") {
      return null;
    }
    if (
      txt.includes("sehr teuer") ||
      txt.includes("teuer") ||
      txt.includes("expensive") ||
      txt.includes("high") ||
      txt.includes("ungünstig")
    ) {
      return { mode: "expensive", action: "Teuer: Speicher entladen" };
    }
    if (
      txt.includes("sehr günstig") ||
      txt.includes("günstig") ||
      txt.includes("cheap") ||
      txt.includes("low")
    ) {
      return { mode: "cheap", action: "Günstig: Speicher laden" };
    }
    return { mode: "neutral", action: "Neutral: normal betreiben" };
  }

  _formatPrice(value, unit) {
    if (value === null || value === undefined) {
      return "--";
    }
    const n = Number(value);
    if (!Number.isFinite(n)) {
      return "--";
    }
    const u = this._normalizePriceUnit(unit || "€/kWh");
    const decimals = u.toLowerCase() === "ct/kwh" ? 1 : 3;
    return `${n.toFixed(decimals)} ${u}`;
  }

  _priceInsight() {
    const priceSensors = this._priceSensors();
    const currentEntityId = this._priceEntityId();
    const hasFallbackSensors =
      Boolean(priceSensors.next_1h) ||
      Boolean(priceSensors.next_2h) ||
      Boolean(priceSensors.next_3h) ||
      Boolean(priceSensors.next_4h) ||
      Boolean(priceSensors.next_5h) ||
      Boolean(priceSensors.min_today) ||
      Boolean(priceSensors.max_today) ||
      Boolean(priceSensors.level);

    if (!currentEntityId && !hasFallbackSensors) {
      return {
        available: false,
        entityId: null,
        label: "Kein Preis-Sensor",
        detail: "tibber_api_token/tibber_api_key oder price_fallback_entity konfigurieren",
        chartRows: [],
        chartStartTs: null,
        chartEndTs: null,
        chartMin: null,
        chartNow: null,
        chartMax: null,
      };
    }

    const mainStateObj = this._stateObj(currentEntityId);
    const displayUnit = this._normalizePriceUnit(
      this._stateObj(currentEntityId)?.attributes?.unit_of_measurement ||
      mainStateObj?.attributes?.unit_of_measurement ||
      "€/kWh"
    );
    const currentInfo = this._priceValueFromEntity(currentEntityId, displayUnit);
    let nowPriceEur = currentInfo.valueEur;

    const now = Date.now();
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;

    const attrs = mainStateObj?.attributes || {};
    const attrsUnit = this._normalizePriceUnit(attrs.unit_of_measurement || displayUnit);
    const sensorResolutionMin = this._toNum(attrs.resolution_minutes);
    const attrRows = [
      ...this._extractPriceRows(attrs.raw_today, todayStart, attrsUnit),
      ...this._extractPriceRows(attrs.raw_tomorrow, tomorrowStart, attrsUnit),
      ...this._extractPriceRows(attrs.today, todayStart, attrsUnit),
      ...this._extractPriceRows(attrs.tomorrow, tomorrowStart, attrsUnit),
    ];

    const fallbackRows = attrRows.length === 0 ? this._priceRowsFromNextSensors(priceSensors, displayUnit) : [];
    const rows = [...attrRows, ...fallbackRows];

    const rowByTs = new Map();
    for (const row of rows) {
      if (!Number.isFinite(row.t) || row.p === null) {
        continue;
      }
      if (!rowByTs.has(row.t)) {
        rowByTs.set(row.t, row);
      }
    }
    const uniqueRows = [...rowByTs.values()];
    uniqueRows.sort((a, b) => a.t - b.t);

    const resolutionMs =
      sensorResolutionMin !== null && sensorResolutionMin > 0
        ? sensorResolutionMin * 60 * 1000
        : this._inferPriceResolutionMs(uniqueRows);
    const dayStartTs = todayStart;
    const tomorrowTs = tomorrowStart;
    const dayEndTs = dayStartTs + 48 * 60 * 60 * 1000;
    const hasForecastRows = attrRows.length > 0;
    const hasTomorrowRows = uniqueRows.some((row) => row.t >= tomorrowTs && row.t < dayEndTs);
    const horizonEndTs = hasForecastRows
      ? (hasTomorrowRows ? dayEndTs : tomorrowTs)
      : now + 24 * 60 * 60 * 1000;
    const lookbackMs = Math.max(
      5 * 60 * 1000,
      Math.min(2 * 60 * 60 * 1000, resolutionMs + 2 * 60 * 1000)
    );
    const futureRows = uniqueRows.filter(
      (r) => r.t >= now - lookbackMs && r.t <= horizonEndTs
    );
    const prices = futureRows.map((r) => r.p);
    let cheapEur = prices.length >= 2 ? this._quantile(prices, 0.25) : null;
    let expensiveEur = prices.length >= 2 ? this._quantile(prices, 0.75) : null;

    const minTodayEur = this._priceValueFromEntity(priceSensors.min_today, displayUnit).valueEur;
    const maxTodayEur = this._priceValueFromEntity(priceSensors.max_today, displayUnit).valueEur;
    if (
      (cheapEur === null || expensiveEur === null) &&
      minTodayEur !== null &&
      maxTodayEur !== null &&
      maxTodayEur > minTodayEur
    ) {
      const spread = maxTodayEur - minTodayEur;
      cheapEur = minTodayEur + spread * 0.25;
      expensiveEur = minTodayEur + spread * 0.75;
    }

    let mode = "neutral";
    let action = "Neutral: normal betreiben";
    if (nowPriceEur !== null && cheapEur !== null && nowPriceEur <= cheapEur) {
      mode = "cheap";
      action = "Günstig: Speicher laden";
    } else if (nowPriceEur !== null && expensiveEur !== null && nowPriceEur >= expensiveEur) {
      mode = "expensive";
      action = "Teuer: Speicher entladen";
    }

    const levelState =
      this._stateObj(priceSensors.level)?.state ||
      attrs.price_level ||
      attrs.level ||
      attrs.current?.level ||
      null;
    const levelSignal = this._modeFromPriceLevel(levelState);
    if ((cheapEur === null || expensiveEur === null || nowPriceEur === null) && levelSignal) {
      mode = levelSignal.mode;
      action = levelSignal.action;
    }

    const nextRows = uniqueRows.filter((row) => row.t >= now && row.t <= horizonEndTs);
    const markerRows = nextRows.length > 0 ? nextRows : futureRows;
    const cheapestRow =
      markerRows.length > 0 ? markerRows.reduce((a, b) => (a.p <= b.p ? a : b)) : null;
    const mostExpensiveRow =
      markerRows.length > 0 ? markerRows.reduce((a, b) => (a.p >= b.p ? a : b)) : null;

    let chartStartTs = null;
    let chartEndTs = null;
    let chartRowsEur = [];
    if (hasForecastRows) {
      chartStartTs = dayStartTs;
      chartEndTs = hasTomorrowRows ? dayEndTs : tomorrowTs;
      chartRowsEur = uniqueRows.filter((row) => row.t >= chartStartTs && row.t < chartEndTs);
    } else {
      chartRowsEur =
        futureRows.length >= 2
          ? futureRows
          : uniqueRows;
    }
    if (chartRowsEur.length === 0) {
      chartRowsEur = uniqueRows;
    }
    if (chartRowsEur.length > 0) {
      if (!Number.isFinite(chartStartTs)) {
        chartStartTs = chartRowsEur[0].t;
      }
      if (!Number.isFinite(chartEndTs)) {
        chartEndTs = chartRowsEur[chartRowsEur.length - 1].t;
      }
      if (chartEndTs <= chartStartTs) {
        chartEndTs = chartRowsEur[chartRowsEur.length - 1].t;
      }
    }
    const chartRows = chartRowsEur.map((row) => ({
      t: row.t,
      p: this._priceFromEur(row.p, displayUnit),
    }));
    const chartValuesEur = chartRowsEur.map((row) => row.p).filter((row) => row !== null && row !== undefined);
    const chartMinEur =
      chartValuesEur.length > 0 ? Math.min(...chartValuesEur) : (minTodayEur ?? cheapEur);
    const chartMaxEur =
      chartValuesEur.length > 0 ? Math.max(...chartValuesEur) : (maxTodayEur ?? expensiveEur);
    const chartNowEur = nowPriceEur;

    const resolutionLabel = `${Math.max(1, Math.round(resolutionMs / (60 * 1000)))}m`;
    const horizonLabel = hasForecastRows ? (hasTomorrowRows ? "48h" : "24h") : null;
    const sourceText =
      attrRows.length > 0
        ? `Tibber Forecast (${horizonLabel}, ${resolutionLabel})`
        : fallbackRows.length > 0
          ? "Preis nächste 1h-5h"
          : minTodayEur !== null || maxTodayEur !== null
            ? "Mindest-/Höchstpreis"
            : levelSignal
              ? "Preisniveau-Sensor"
              : "Aktueller Preis";

    const hasData =
      nowPriceEur !== null ||
      futureRows.length > 0 ||
      minTodayEur !== null ||
      maxTodayEur !== null ||
      Boolean(levelSignal);

    if (!hasData) {
      return {
        available: false,
        entityId: currentEntityId || null,
        label: "Preis-Sensor ohne Werte",
        detail: currentEntityId || "tibber_api_token/tibber_api_key oder price_fallback_entity konfigurieren",
        chartRows: [],
        chartStartTs: null,
        chartEndTs: null,
        chartMin: null,
        chartNow: null,
        chartMax: null,
      };
    }

    return {
      available: true,
      mode,
      entityId: currentEntityId || null,
      unit: displayUnit,
      resolutionMinutes: Math.max(1, Math.round(resolutionMs / (60 * 1000))),
      nowPrice: this._priceFromEur(nowPriceEur, displayUnit),
      cheap: this._priceFromEur(cheapEur, displayUnit),
      expensive: this._priceFromEur(expensiveEur, displayUnit),
      minToday: this._priceFromEur(minTodayEur, displayUnit),
      maxToday: this._priceFromEur(maxTodayEur, displayUnit),
      levelText: levelState ?? "--",
      cheapestPoint: cheapestRow
        ? {
            t: cheapestRow.t,
            p: this._priceFromEur(cheapestRow.p, displayUnit),
          }
        : null,
      expensivePoint: mostExpensiveRow
        ? {
            t: mostExpensiveRow.t,
            p: this._priceFromEur(mostExpensiveRow.p, displayUnit),
          }
        : null,
      sourceText,
      action,
      chartRows,
      chartStartTs,
      chartEndTs,
      chartMin: this._priceFromEur(chartMinEur, displayUnit),
      chartNow: this._priceFromEur(chartNowEur, displayUnit),
      chartMax: this._priceFromEur(chartMaxEur, displayUnit),
      cheapestText: cheapestRow
        ? `${this._formatTime(cheapestRow.t)} · ${this._formatPrice(this._priceFromEur(cheapestRow.p, displayUnit), displayUnit)}`
        : minTodayEur !== null
          ? `Heute min · ${this._formatPrice(this._priceFromEur(minTodayEur, displayUnit), displayUnit)}`
          : "--",
      expensiveText: mostExpensiveRow
        ? `${this._formatTime(mostExpensiveRow.t)} · ${this._formatPrice(this._priceFromEur(mostExpensiveRow.p, displayUnit), displayUnit)}`
        : maxTodayEur !== null
          ? `Heute max · ${this._formatPrice(this._priceFromEur(maxTodayEur, displayUnit), displayUnit)}`
          : "--",
    };
  }

  _resolveGridFlowValues(
    { signedRaw = null, importRaw = null, exportRaw = null },
    flowOpts = this._flowOptions()
  ) {
    const mode = this._normalizeSensorMode(flowOpts.gridSensorMode);
    const signed = signedRaw;
    const hasDual = importRaw !== null || exportRaw !== null;

    if (mode === "dual") {
      if (!hasDual) {
        return {
          mode: "dual_missing",
          signed: null,
          importPower: null,
          exportPower: null,
        };
      }
      const importPower = Math.max(0, importRaw ?? 0);
      const exportPower = Math.max(0, exportRaw ?? 0);
      return {
        mode: "dual",
        signed: importPower - exportPower,
        importPower,
        exportPower,
      };
    }

    if (mode === "signed") {
      if (signed === null) {
        return {
          mode: "signed_missing",
          signed: null,
          importPower: null,
          exportPower: null,
        };
      }
      return {
        mode: "signed",
        signed,
        importPower: Math.max(0, signed),
        exportPower: Math.max(0, -signed),
      };
    }

    // Auto mode prefers the signed two-way meter sensor when available.
    if (signed !== null) {
      return {
        mode: "signed_auto",
        signed,
        importPower: Math.max(0, signed),
        exportPower: Math.max(0, -signed),
      };
    }

    if (hasDual) {
      const importPower = Math.max(0, importRaw ?? 0);
      const exportPower = Math.max(0, exportRaw ?? 0);
      return {
        mode: "dual_auto_fallback",
        signed: importPower - exportPower,
        importPower,
        exportPower,
      };
    }

    return {
      mode: "none",
      signed: null,
      importPower: null,
      exportPower: null,
    };
  }

  _resolveGridSignedSource(sensors = this._sensors()) {
    const configuredEntityId = sensors?.grid_power || null;
    const configuredValue = this._numericPowerState(configuredEntityId);
    if (configuredValue !== null) {
      return {
        entityId: configuredEntityId,
        signedRaw: configuredValue,
        source: "configured",
      };
    }

    const tibberValue = this._numericPowerState(TIBBER_LIVE_GRID_SENSOR);
    if (tibberValue !== null) {
      return {
        entityId: TIBBER_LIVE_GRID_SENSOR,
        signedRaw: tibberValue,
        source: "tibber_api_fallback",
      };
    }

    return {
      entityId: configuredEntityId || TIBBER_LIVE_GRID_SENSOR,
      signedRaw: null,
      source: configuredEntityId ? "configured_missing" : "missing",
    };
  }

  _resolveGridFlow(sensors) {
    const signedSource = this._resolveGridSignedSource(sensors);
    const flow = this._resolveGridFlowValues(
      {
        signedRaw: signedSource.signedRaw,
        importRaw: this._numericPowerState(sensors.grid_import_power),
        exportRaw: this._numericPowerState(sensors.grid_export_power),
      },
      this._flowOptions()
    );
    flow.signedEntityId = signedSource.entityId;
    flow.signedSource = signedSource.source;
    return flow;
  }

  _resolveBatterySignedSource(sensors = this._sensors()) {
    const inverterEntityId = sensors?.battery_inverter_power || null;
    const inverterValue = this._numericPowerState(inverterEntityId);
    if (inverterValue !== null) {
      return {
        entityId: inverterEntityId,
        signedRaw: inverterValue,
        source: "inverter",
      };
    }

    const batteryEntityId = sensors?.battery_power || null;
    const batteryValue = this._numericPowerState(batteryEntityId);
    if (batteryValue !== null) {
      return {
        entityId: batteryEntityId,
        signedRaw: batteryValue,
        source: "battery",
      };
    }

    const fallbackEntityId = inverterEntityId || batteryEntityId || null;
    return {
      entityId: fallbackEntityId,
      signedRaw: null,
      source: fallbackEntityId ? "configured_missing" : "missing",
    };
  }

  _resolveBatteryFlowValues(
    { signedRaw = null, chargeRaw = null, dischargeRaw = null },
    flowOpts = this._flowOptions()
  ) {
    const mode = this._normalizeSensorMode(flowOpts.batterySensorMode);
    const signed =
      signedRaw === null
        ? null
        : flowOpts.invertBatteryPowerSign
          ? -signedRaw
          : signedRaw;
    const hasDual = chargeRaw !== null || dischargeRaw !== null;

    if (mode === "signed") {
      if (signed === null) {
        return {
          mode: "signed_missing",
          signed: null,
          chargePower: null,
          dischargePower: null,
        };
      }
      return {
        mode: "signed",
        signed,
        chargePower: Math.max(0, -signed),
        dischargePower: Math.max(0, signed),
      };
    }

    if (mode === "dual") {
      if (!hasDual) {
        return {
          mode: "dual_missing",
          signed: null,
          chargePower: null,
          dischargePower: null,
        };
      }
      const chargePower = Math.max(0, chargeRaw ?? 0);
      const dischargePower = Math.max(0, dischargeRaw ?? 0);
      return {
        mode: "dual",
        signed: dischargePower - chargePower,
        chargePower,
        dischargePower,
      };
    }

    if (flowOpts.useSignedBatteryPower) {
      if (signed === null) {
        return {
          mode: "signed_forced_missing",
          signed: null,
          chargePower: null,
          dischargePower: null,
        };
      }
      return {
        mode: "signed_forced",
        signed,
        chargePower: Math.max(0, -signed),
        dischargePower: Math.max(0, signed),
      };
    }

    if (hasDual) {
      const chargePower = Math.max(0, chargeRaw ?? 0);
      const dischargePower = Math.max(0, dischargeRaw ?? 0);
      return {
        mode: "dual_auto",
        signed: dischargePower - chargePower,
        chargePower,
        dischargePower,
      };
    }

    if (signed === null) {
      return {
        mode: "none",
        signed: null,
        chargePower: null,
        dischargePower: null,
      };
    }

    return {
      mode: "signed",
      signed,
      chargePower: Math.max(0, -signed),
      dischargePower: Math.max(0, signed),
    };
  }

  _resolveBatteryFlow(sensors, flowOpts = this._flowOptions()) {
    const signedSource = this._resolveBatterySignedSource(sensors);
    const batteryMode = this._normalizeSensorMode(flowOpts.batterySensorMode);
    const effectiveFlowOpts =
      batteryMode === "auto" && signedSource.source === "inverter"
        ? {
            ...flowOpts,
            useSignedBatteryPower: true,
          }
        : flowOpts;
    const flow = this._resolveBatteryFlowValues(
      {
        signedRaw: signedSource.signedRaw,
        chargeRaw: this._numericPowerState(sensors.battery_charge_power),
        dischargeRaw: this._numericPowerState(sensors.battery_discharge_power),
      },
      effectiveFlowOpts
    );
    flow.signedEntityId = signedSource.entityId;
    flow.signedSource = signedSource.source;
    return flow;
  }

  _resolveBatteryDcFlow(sensors, flowOpts = this._flowOptions()) {
    const signedRaw = this._numericPowerState(sensors?.battery_power);
    const flow = this._resolveBatteryFlowValues(
      {
        signedRaw,
        chargeRaw: null,
        dischargeRaw: null,
      },
      {
        ...flowOpts,
        batterySensorMode: "signed",
        useSignedBatteryPower: true,
      }
    );
    flow.signedEntityId = sensors?.battery_power || null;
    flow.signedSource = sensors?.battery_power ? "battery_dc" : "missing";
    return flow;
  }

  _buildTrendKey(
    sensors,
    windowCfg,
    priceCfg = null,
    gridSignedEntityId = null,
    batterySignedEntityId = null,
    extraEntityIds = []
  ) {
    const flowOpts = this._flowOptions();
    const stepForBucket = Math.max(
      TREND_STEP_MIN_MS,
      Number(windowCfg?.stepMs) || TREND_STEP_MIN_MS
    );
    const endBucket = Math.floor(windowCfg.endMs / stepForBucket);
    return [
      TREND_DATA_REV,
      windowCfg.key,
      Math.floor(windowCfg.startMs / (60 * 60 * 1000)),
      endBucket,
      sensors.solar_power || "-",
      sensors.solar_energy || "-",
      sensors.load_power || "-",
      sensors.load_energy || "-",
      sensors.grid_import_power || "-",
      sensors.grid_export_power || "-",
      sensors.grid_import_energy || "-",
      sensors.grid_export_energy || "-",
      gridSignedEntityId || sensors.grid_power || TIBBER_LIVE_GRID_SENSOR,
      batterySignedEntityId || sensors.battery_inverter_power || sensors.battery_power || "-",
      flowOpts.useSignedBatteryPower ? "-" : sensors.battery_charge_power || "-",
      flowOpts.useSignedBatteryPower ? "-" : sensors.battery_discharge_power || "-",
      sensors.battery_charge_energy || "-",
      sensors.battery_discharge_energy || "-",
      sensors.battery_inverter_power || "-",
      sensors.battery_power || "-",
      flowOpts.useSignedBatteryPower ? "1" : "0",
      flowOpts.gridSensorMode || "auto",
      flowOpts.batterySensorMode || "auto",
      flowOpts.invertBatteryPowerSign ? "1" : "0",
      flowOpts.invertLoadPowerSign ? "1" : "0",
      priceCfg?.entityId || "-",
      priceCfg?.unit || "-",
      Array.isArray(extraEntityIds) && extraEntityIds.length > 0
        ? [...new Set(extraEntityIds.filter(Boolean))].sort().join(",")
        : "-",
    ].join("|");
  }

  _toNum(raw) {
    const txt = String(raw ?? "").trim();
    if (!txt || txt === "unknown" || txt === "unavailable") {
      return null;
    }
    const n = Number.parseFloat(txt.replace(",", ".").replace(/[^\d+\-.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  _historyToSeries(historyData) {
    const map = {};
    if (!Array.isArray(historyData)) {
      return map;
    }
    for (const group of historyData) {
      if (!Array.isArray(group) || group.length === 0) {
        continue;
      }
      let groupEntityId = null;
      for (const row of group) {
        if (!row || typeof row !== "object") {
          continue;
        }
        const entityId = row.entity_id || row.eid || groupEntityId;
        if (!entityId) {
          continue;
        }
        groupEntityId = entityId;
        if (!map[entityId]) {
          map[entityId] = [];
        }
        const tRaw = row.last_changed || row.last_updated || row.lc || row.lu;
        const v = this._toNum(row.state ?? row.s);
        const t = new Date(tRaw).getTime();
        if (!Number.isFinite(t) || v === null) {
          continue;
        }
        map[entityId].push({ t, v });
      }
    }
    for (const entityId of Object.keys(map)) {
      map[entityId].sort((a, b) => a.t - b.t);
      const dedup = [];
      for (const point of map[entityId]) {
        const prev = dedup.length > 0 ? dedup[dedup.length - 1] : null;
        if (prev && prev.t === point.t) {
          prev.v = point.v;
        } else {
          dedup.push(point);
        }
      }
      map[entityId] = dedup;
    }
    return map;
  }

  _seriesReader(series) {
    let index = 0;
    let current = null;
    return (t) => {
      while (index < series.length && series[index].t <= t) {
        current = series[index].v;
        index += 1;
      }
      return current;
    };
  }

  _formatAxisLabel(ts, rangeKey) {
    const d = new Date(ts);
    if (rangeKey === TREND_RANGES.week7.key || rangeKey === TREND_RANGES.total.key) {
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${dd}.${mm}`;
    }
    return this._formatTime(ts);
  }

  _buildTrendData(
    seriesMap,
    sensors,
    windowCfg,
    priceCfg = null,
    gridSignedEntityId = null,
    batterySignedEntityId = null,
    extraChips = []
  ) {
    const start = windowCfg.startMs;
    const end = windowCfg.endMs;
    const stepMs = windowCfg.stepMs;
    const stepHours = stepMs / (60 * 60 * 1000);
    const flowOpts = this._flowOptions();

    const solarSeries = seriesMap[sensors.solar_power] || [];
    const solarEnergySeries = sensors.solar_energy
      ? seriesMap[sensors.solar_energy] || []
      : [];
    const loadSeries = seriesMap[sensors.load_power] || [];
    const loadEnergySeries = sensors.load_energy
      ? seriesMap[sensors.load_energy] || []
      : [];
    const gridImportSeries = sensors.grid_import_power
      ? seriesMap[sensors.grid_import_power] || []
      : [];
    const gridExportSeries = sensors.grid_export_power
      ? seriesMap[sensors.grid_export_power] || []
      : [];
    const gridImportEnergySeries = sensors.grid_import_energy
      ? seriesMap[sensors.grid_import_energy] || []
      : [];
    const gridExportEnergySeries = sensors.grid_export_energy
      ? seriesMap[sensors.grid_export_energy] || []
      : [];
    const gridSignedCandidates = [
      gridSignedEntityId,
      sensors.grid_power,
      TIBBER_LIVE_GRID_SENSOR,
    ].filter((id, index, arr) => id && arr.indexOf(id) === index);
    let gridSignedSeries = [];
    let gridSignedScaleEntity = gridSignedCandidates[0] || null;
    for (const entityId of gridSignedCandidates) {
      const candidateSeries = seriesMap[entityId] || [];
      if (candidateSeries.length > 0) {
        gridSignedSeries = candidateSeries;
        gridSignedScaleEntity = entityId;
        break;
      }
    }
    if (gridSignedSeries.length === 0 && gridSignedScaleEntity) {
      gridSignedSeries = seriesMap[gridSignedScaleEntity] || [];
    }
    const batteryChargeSeries = sensors.battery_charge_power
      ? seriesMap[sensors.battery_charge_power] || []
      : [];
    const batteryChargeEnergySeries = sensors.battery_charge_energy
      ? seriesMap[sensors.battery_charge_energy] || []
      : [];
    const batteryDischargeSeries = sensors.battery_discharge_power
      ? seriesMap[sensors.battery_discharge_power] || []
      : [];
    const batteryDischargeEnergySeries = sensors.battery_discharge_energy
      ? seriesMap[sensors.battery_discharge_energy] || []
      : [];
    const batterySignedSeries = sensors.battery_power
      ? seriesMap[sensors.battery_power] || []
      : [];
    const batterySignedCandidates = [
      batterySignedEntityId,
      sensors.battery_inverter_power,
      sensors.battery_power,
    ].filter((id, index, arr) => id && arr.indexOf(id) === index);
    let batterySignedFlowSeries = [];
    let batterySignedFlowScaleEntity = batterySignedCandidates[0] || null;
    for (const entityId of batterySignedCandidates) {
      const candidateSeries = seriesMap[entityId] || [];
      if (candidateSeries.length > 0) {
        batterySignedFlowSeries = candidateSeries;
        batterySignedFlowScaleEntity = entityId;
        break;
      }
    }
    if (batterySignedFlowSeries.length === 0 && batterySignedFlowScaleEntity) {
      batterySignedFlowSeries = seriesMap[batterySignedFlowScaleEntity] || [];
    }
    const priceSeries = priceCfg?.entityId ? seriesMap[priceCfg.entityId] || [] : [];

    const scaleSolar = this._powerScale(sensors.solar_power);
    const scaleLoad = this._powerScale(sensors.load_power);
    const scaleGridImport = this._powerScale(sensors.grid_import_power);
    const scaleGridExport = this._powerScale(sensors.grid_export_power);
    const scaleGridSigned = this._powerScale(gridSignedScaleEntity);
    const scaleBatteryCharge = this._powerScale(sensors.battery_charge_power);
    const scaleBatteryDischarge = this._powerScale(sensors.battery_discharge_power);
    const scaleBatterySigned = this._powerScale(sensors.battery_power);
    const scaleBatterySignedFlow = this._powerScale(batterySignedFlowScaleEntity);
    const batteryMode = this._normalizeSensorMode(flowOpts.batterySensorMode);
    const effectiveBatteryFlowOpts =
      batteryMode === "auto" &&
      sensors.battery_inverter_power &&
      batterySignedFlowScaleEntity === sensors.battery_inverter_power
        ? {
            ...flowOpts,
            useSignedBatteryPower: true,
          }
        : flowOpts;

    const readSolar = this._seriesReader(solarSeries);
    const readSolarEnergy = this._seriesReader(solarEnergySeries);
    const readLoad = this._seriesReader(loadSeries);
    const readLoadEnergy = this._seriesReader(loadEnergySeries);
    const readGridImport = this._seriesReader(gridImportSeries);
    const readGridExport = this._seriesReader(gridExportSeries);
    const readGridImportEnergy = this._seriesReader(gridImportEnergySeries);
    const readGridExportEnergy = this._seriesReader(gridExportEnergySeries);
    const readGridSigned = this._seriesReader(gridSignedSeries);
    const readBatteryCharge = this._seriesReader(batteryChargeSeries);
    const readBatteryChargeEnergy = this._seriesReader(batteryChargeEnergySeries);
    const readBatteryDischarge = this._seriesReader(batteryDischargeSeries);
    const readBatteryDischargeEnergy = this._seriesReader(batteryDischargeEnergySeries);
    const readBatterySigned = this._seriesReader(batterySignedSeries);
    const readBatterySignedFlow = this._seriesReader(batterySignedFlowSeries);
    const readPrice = this._seriesReader(priceSeries);
    const extraSeriesReaders = Array.isArray(extraChips)
      ? extraChips
          .filter((chip) => chip?.key && chip?.entity)
          .map((chip) => ({
            key: chip.key,
            scale: this._powerScale(chip.entity),
            read: this._seriesReader(seriesMap[chip.entity] || []),
          }))
      : [];

    const points = [];
    let sumLoad = 0;
    let sumRenewable = 0;
    let sumAutarky = 0;
    let autarkyCount = 0;

    let savedNonGridEur = 0;
    let savedSolarDirectEur = 0;
    let batteryShiftBuyEur = 0;
    let batteryShiftSellEur = 0;
    let batteryArbitrageEur = 0;
    let batteryArbitrageKwh = 0;
    let priceIntervals = 0;
    let nonGridPricedIntervals = 0;
    let solarPricedIntervals = 0;

    // FIFO pool: nur Netzladung als "gekaufte" Akku-Energie tracken.
    let batteryGridPoolKwh = 0;
    let batteryGridPoolCostEur = 0;
    let smartCumEur = 0;
    let smartCumHasValue = false;
    let prevSolarMeterKwh = null;
    let prevLoadMeterKwh = null;
    let prevGridImportMeterKwh = null;
    let prevGridExportMeterKwh = null;
    let prevBatteryChargeMeterKwh = null;
    let prevBatteryDischargeMeterKwh = null;

    for (let t = start; t <= end; t += stepMs) {
      const solarRawHist = readSolar(t);
      const loadRawHist = readLoad(t);
      const importDualHist = readGridImport(t);
      const exportDualHist = readGridExport(t);
      const signedHist = readGridSigned(t);
      const chargeDualHist = readBatteryCharge(t);
      const dischargeDualHist = readBatteryDischarge(t);
      const batterySignedRawHist = readBatterySigned(t);
      const batterySignedFlowRawHist = readBatterySignedFlow(t);

      const solarRaw = solarRawHist === null ? null : solarRawHist * scaleSolar;
      const loadRaw = loadRawHist === null ? null : loadRawHist * scaleLoad;
      const importDual = importDualHist === null ? null : importDualHist * scaleGridImport;
      const exportDual = exportDualHist === null ? null : exportDualHist * scaleGridExport;
      const signed = signedHist === null ? null : signedHist * scaleGridSigned;
      const chargeDual = chargeDualHist === null ? null : chargeDualHist * scaleBatteryCharge;
      const dischargeDual = dischargeDualHist === null ? null : dischargeDualHist * scaleBatteryDischarge;
      const batterySignedRaw =
        batterySignedRawHist === null ? null : batterySignedRawHist * scaleBatterySigned;
      const batterySignedFlowRaw =
        batterySignedFlowRawHist === null ? null : batterySignedFlowRawHist * scaleBatterySignedFlow;
      const priceRaw = readPrice(t);
      const priceEur = this._priceToEur(priceRaw, priceCfg?.unit || "€/kWh");
      const solarEnergyRawHist = readSolarEnergy(t);
      const loadEnergyRawHist = readLoadEnergy(t);
      const batteryChargeEnergyRawHist = readBatteryChargeEnergy(t);
      const batteryDischargeEnergyRawHist = readBatteryDischargeEnergy(t);
      const solarMeterKwh = this._seriesEnergyKwh(sensors.solar_energy, solarEnergyRawHist);
      const loadMeterKwh = this._seriesEnergyKwh(sensors.load_energy, loadEnergyRawHist);
      const batteryChargeMeterKwh = this._seriesEnergyKwh(
        sensors.battery_charge_energy,
        batteryChargeEnergyRawHist
      );
      const batteryDischargeMeterKwh = this._seriesEnergyKwh(
        sensors.battery_discharge_energy,
        batteryDischargeEnergyRawHist
      );
      const solarMeterDeltaKwh = this._counterDeltaKwh(prevSolarMeterKwh, solarMeterKwh);
      const loadMeterDeltaKwh = this._counterDeltaKwh(prevLoadMeterKwh, loadMeterKwh);
      const batteryChargeMeterDeltaKwh = this._counterDeltaKwh(
        prevBatteryChargeMeterKwh,
        batteryChargeMeterKwh
      );
      const batteryDischargeMeterDeltaKwh = this._counterDeltaKwh(
        prevBatteryDischargeMeterKwh,
        batteryDischargeMeterKwh
      );
      if (solarMeterKwh !== null) {
        prevSolarMeterKwh = solarMeterKwh;
      }
      if (loadMeterKwh !== null) {
        prevLoadMeterKwh = loadMeterKwh;
      }
      if (batteryChargeMeterKwh !== null) {
        prevBatteryChargeMeterKwh = batteryChargeMeterKwh;
      }
      if (batteryDischargeMeterKwh !== null) {
        prevBatteryDischargeMeterKwh = batteryDischargeMeterKwh;
      }
      const solarMeterPower =
        solarMeterDeltaKwh === null ? null : (solarMeterDeltaKwh * 1000) / stepHours;
      const loadMeterPower =
        loadMeterDeltaKwh === null ? null : (loadMeterDeltaKwh * 1000) / stepHours;
      const batteryChargeMeterPower =
        batteryChargeMeterDeltaKwh === null
          ? null
          : (batteryChargeMeterDeltaKwh * 1000) / stepHours;
      const batteryDischargeMeterPower =
        batteryDischargeMeterDeltaKwh === null
          ? null
          : (batteryDischargeMeterDeltaKwh * 1000) / stepHours;
      let solar =
        solarMeterPower === null
          ? solarRaw === null
            ? null
            : Math.max(0, solarRaw)
          : Math.max(0, solarMeterPower);
      let load =
        loadMeterPower === null
          ? loadRaw === null
            ? null
            : Math.max(0, flowOpts.invertLoadPowerSign ? -loadRaw : loadRaw)
          : Math.max(0, loadMeterPower);

      const gridFlow = this._resolveGridFlowValues(
        {
          signedRaw: signed,
          importRaw: importDual,
          exportRaw: exportDual,
        },
        flowOpts
      );
      const gridImport = gridFlow.importPower;

      const batteryFlow = this._resolveBatteryFlowValues(
        {
          signedRaw: batterySignedFlowRaw,
          chargeRaw: chargeDual,
          dischargeRaw: dischargeDual,
        },
        effectiveBatteryFlowOpts
      );
      const batteryDcFlow = this._resolveBatteryFlowValues(
        {
          signedRaw: batterySignedRaw,
          chargeRaw: null,
          dischargeRaw: null,
        },
        {
          ...flowOpts,
          batterySensorMode: "signed",
          useSignedBatteryPower: true,
        }
      );
      const batteryChargeAc = Number.isFinite(batteryFlow.chargePower)
        ? Math.max(0, Number(batteryFlow.chargePower))
        : null;
      const batteryDischargeAc = Number.isFinite(batteryFlow.dischargePower)
        ? Math.max(0, Number(batteryFlow.dischargePower))
        : null;
      const batteryChargeDc = Number.isFinite(batteryDcFlow.chargePower)
        ? Math.max(0, Number(batteryDcFlow.chargePower))
        : null;
      const batteryDischargeDc = Number.isFinite(batteryDcFlow.dischargePower)
        ? Math.max(0, Number(batteryDcFlow.dischargePower))
        : null;
      const batteryChargeLoss =
        batteryChargeAc === null || batteryChargeDc === null
          ? null
          : Math.max(0, batteryChargeAc - batteryChargeDc);
      const batteryDischargeLoss =
        batteryDischargeAc === null || batteryDischargeDc === null
          ? null
          : Math.max(0, batteryDischargeDc - batteryDischargeAc);
      const batteryLossPower =
        batteryChargeLoss === null && batteryDischargeLoss === null
          ? null
          : Math.max(0, (batteryChargeLoss ?? 0) + (batteryDischargeLoss ?? 0));
      const batteryCharge = Math.max(
        0,
        batteryChargeMeterPower === null
          ? batteryFlow.chargePower ?? 0
          : batteryChargeMeterPower
      );
      const batteryDischarge = Math.max(
        0,
        batteryDischargeMeterPower === null
          ? batteryFlow.dischargePower ?? 0
          : batteryDischargeMeterPower
      );
      const gridImportEnergyRawHist = readGridImportEnergy(t);
      const gridExportEnergyRawHist = readGridExportEnergy(t);
      const gridImportMeterKwh = this._seriesEnergyKwh(
        sensors.grid_import_energy,
        gridImportEnergyRawHist
      );
      const gridExportMeterKwh = this._seriesEnergyKwh(
        sensors.grid_export_energy,
        gridExportEnergyRawHist
      );
      const gridImportMeterDeltaKwh = this._counterDeltaKwh(
        prevGridImportMeterKwh,
        gridImportMeterKwh
      );
      const gridExportMeterDeltaKwh = this._counterDeltaKwh(
        prevGridExportMeterKwh,
        gridExportMeterKwh
      );
      if (gridImportMeterKwh !== null) {
        prevGridImportMeterKwh = gridImportMeterKwh;
      }
      if (gridExportMeterKwh !== null) {
        prevGridExportMeterKwh = gridExportMeterKwh;
      }
      const gridImportMeterPower =
        gridImportMeterDeltaKwh === null ? null : (gridImportMeterDeltaKwh * 1000) / stepHours;
      const gridExportMeterPower =
        gridExportMeterDeltaKwh === null ? null : (gridExportMeterDeltaKwh * 1000) / stepHours;
      const signedGridFromEnergyMeters =
        gridImportMeterPower === null && gridExportMeterPower === null
          ? null
          : Math.max(0, gridImportMeterPower ?? 0) - Math.max(0, gridExportMeterPower ?? 0);
      const gridImportTotalPower =
        gridImportMeterPower === null ? gridImport : Math.max(0, gridImportMeterPower);

      const point = {
        t,
        load: null,
        loadTotalPower: null,
        houseNetPower: null,
        loadToBatteryPower: null,
        renewable: null,
        autarky: null,
        solarCover: null,
        batteryCover: null,
        gridCover: null,
        solarToHousePower: null,
        solarToBatteryPower: null,
        gridToHousePower: null,
        gridToBatteryPower: null,
        batteryToHousePower: null,
        solarPower: null,
        gridSignedPower: null,
        gridImportPower: null,
        gridExportPower: null,
        batterySignedPower: null,
        batterySignedDcPower: null,
        batteryChargePower: null,
        batteryDischargePower: null,
        batteryDcChargePower: null,
        batteryDcDischargePower: null,
        batteryLossPower: null,
        batteryChargeLossPower: null,
        batteryDischargeLossPower: null,
        extraPowers: {},
        saveSolarEur: null,
        saveArbitrageEur: null,
        saveSmartEur: null,
        saveSmartCumEur: smartCumHasValue ? smartCumEur : null,
      };

      if (load === null) {
        load = this._deriveLoadFromInputs({
          solarPower: solar,
          gridSignedPower: gridFlow.signed ?? signedGridFromEnergyMeters,
          batteryDischargePower: batteryDischarge,
        });
      }

      point.solarPower = solar === null ? null : Math.max(0, solar);
      point.gridSignedPower =
        gridFlow.signed === null || gridFlow.signed === undefined
          ? signedGridFromEnergyMeters
          : gridFlow.signed;
      point.gridImportPower =
        gridImportMeterPower === null ? gridImport : Math.max(0, gridImportMeterPower);
      point.gridExportPower =
        gridExportMeterPower === null
          ? Math.max(0, gridFlow.exportPower ?? 0)
          : Math.max(0, gridExportMeterPower);
      point.batterySignedPower = batteryFlow.signed;
      point.batterySignedDcPower = batteryDcFlow.signed;
      point.batteryChargePower = batteryCharge;
      point.batteryDischargePower = batteryDischarge;
      point.batteryDcChargePower = batteryChargeDc;
      point.batteryDcDischargePower = batteryDischargeDc;
      point.batteryLossPower = batteryLossPower;
      point.batteryChargeLossPower = batteryChargeLoss;
      point.batteryDischargeLossPower = batteryDischargeLoss;
      if (extraSeriesReaders.length > 0) {
        extraSeriesReaders.forEach((entry) => {
          const raw = entry.read(t);
          const power = raw === null ? null : Math.max(0, raw * entry.scale);
          point.extraPowers[entry.key] = power;
        });
      }

      if (load === null) {
        points.push(point);
        continue;
      }
      const houseNet = Math.max(0, load - batteryCharge);
      let solarCover = solar === null ? 0 : Math.min(load, Math.max(0, solar));
      let batteryCover = Math.min(Math.max(0, load - solarCover), batteryDischarge);
      let gridCover = Math.max(0, load - solarCover - batteryCover);

      const meterGridCover =
        gridImportMeterPower === null
          ? null
          : this._clamp(Math.max(0, gridImportMeterPower), 0, load);
      if (meterGridCover !== null) {
        const localTarget = Math.max(0, load - meterGridCover);
        const localCurrent = Math.max(0, solarCover + batteryCover);
        if (localCurrent > 0) {
          const factor = localTarget / localCurrent;
          solarCover *= factor;
          batteryCover *= factor;
        } else {
          solarCover = Math.min(localTarget, Math.max(0, solar ?? 0));
          batteryCover = Math.max(0, localTarget - solarCover);
        }
        gridCover = meterGridCover;
      }

      batteryCover = this._clamp(batteryCover, 0, batteryDischarge);
      const solarCoverMaxByLoad = Math.max(0, load - batteryCover);
      const solarCoverMaxByProd =
        solar === null || solar === undefined ? solarCoverMaxByLoad : Math.max(0, solar);
      solarCover = this._clamp(solarCover, 0, Math.min(solarCoverMaxByLoad, solarCoverMaxByProd));
      gridCover = Math.max(0, load - solarCover - batteryCover);

      const renew = Math.max(0, load - gridCover);
      const autarky =
        houseNet > 0
          ? this._clamp((1 - this._clamp(gridCover, 0, houseNet) / houseNet) * 100, 0, 100)
          : null;

      point.load = load;
      point.loadTotalPower = load;
      point.houseNetPower = houseNet;
      point.loadToBatteryPower = batteryCharge;
      point.renewable = renew;
      point.autarky = autarky;
      point.solarCover = solarCover;
      point.batteryCover = batteryCover;
      point.gridCover = gridCover;

      const gridToHousePower = this._clamp(gridCover, 0, houseNet);
      const solarAvailPower =
        solar === null || solar === undefined ? null : Math.max(0, solar);
      const solarToHousePower = solarAvailPower === null
        ? Math.min(houseNet, solarCover)
        : Math.min(houseNet, solarCover, solarAvailPower);
      const batteryToHousePower = Math.min(houseNet, batteryDischarge);
      let gridToBatteryPower = 0;
      if (batteryCharge > 0) {
        const estGridToBatteryByMeter =
          gridImportTotalPower === null
            ? null
            : Math.max(0, gridImportTotalPower - gridToHousePower);
        if (solar !== null) {
          const solarSurplus = Math.max(0, solar - houseNet);
          const solarToBattery = Math.min(batteryCharge, solarSurplus);
          const residualChargeNeed = Math.max(0, batteryCharge - solarToBattery);
          if (estGridToBatteryByMeter !== null) {
            gridToBatteryPower = this._clamp(
              estGridToBatteryByMeter,
              0,
              residualChargeNeed
            );
          } else {
            gridToBatteryPower = residualChargeNeed;
          }
        } else if (estGridToBatteryByMeter !== null) {
          gridToBatteryPower = this._clamp(estGridToBatteryByMeter, 0, batteryCharge);
        } else if (gridImport !== null) {
          gridToBatteryPower = Math.min(
            batteryCharge,
            Math.max(0, gridImport - gridToHousePower)
          );
        }
      }
      let solarToBatteryPower = Math.max(0, batteryCharge - gridToBatteryPower);
      if (solarAvailPower !== null) {
        const solarLeftForBattery = Math.max(0, solarAvailPower - solarToHousePower);
        solarToBatteryPower = this._clamp(solarToBatteryPower, 0, solarLeftForBattery);
        gridToBatteryPower = this._clamp(
          Math.max(0, batteryCharge - solarToBatteryPower),
          0,
          batteryCharge
        );
      }
      point.gridToHousePower = gridToHousePower;
      point.gridToBatteryPower = gridToBatteryPower;
      point.solarToHousePower = solarToHousePower;
      point.solarToBatteryPower = solarToBatteryPower;
      point.batteryToHousePower = batteryToHousePower;

      sumLoad += load;
      sumRenewable += renew;
      if (autarky !== null) {
        sumAutarky += autarky;
        autarkyCount += 1;
      }

      if (priceEur !== null) {
        priceIntervals += 1;
        let stepSolarEur = 0;
        let stepArbitrageEur = 0;
        const nonGridToHousePower = Math.max(0, houseNet - gridToHousePower);
        savedNonGridEur += (nonGridToHousePower * stepHours / 1000) * priceEur;
        nonGridPricedIntervals += 1;

        if (solarCover > 0) {
          const solarStepEur = (solarToHousePower * stepHours / 1000) * priceEur;
          savedSolarDirectEur += solarStepEur;
          stepSolarEur += solarStepEur;
          solarPricedIntervals += 1;
        }

        const gridToBatteryKwh = (gridToBatteryPower * stepHours) / 1000;
        if (gridToBatteryKwh > 0) {
          const buyCost = gridToBatteryKwh * priceEur;
          batteryGridPoolKwh += gridToBatteryKwh;
          batteryGridPoolCostEur += buyCost;
          batteryShiftBuyEur += buyCost;
        }

        const batteryToHouseKwh = (batteryToHousePower * stepHours) / 1000;
        if (batteryToHouseKwh > 0 && batteryGridPoolKwh > 0) {
          const usedGridKwh = Math.min(batteryToHouseKwh, batteryGridPoolKwh);
          const avgBuyPrice = batteryGridPoolCostEur / batteryGridPoolKwh;
          const sellValue = usedGridKwh * priceEur;
          const buyValue = usedGridKwh * avgBuyPrice;
          const arbitrageStepEur = sellValue - buyValue;

          batteryShiftSellEur += sellValue;
          batteryArbitrageEur += arbitrageStepEur;
          stepArbitrageEur += arbitrageStepEur;
          batteryArbitrageKwh += usedGridKwh;

          batteryGridPoolCostEur = Math.max(0, batteryGridPoolCostEur - buyValue);
          batteryGridPoolKwh = Math.max(0, batteryGridPoolKwh - usedGridKwh);
        }

        const stepSmartEur = stepSolarEur + stepArbitrageEur;
        smartCumEur += stepSmartEur;
        smartCumHasValue = true;
        point.saveSolarEur = stepSolarEur;
        point.saveArbitrageEur = stepArbitrageEur;
        point.saveSmartEur = stepSmartEur;
        point.saveSmartCumEur = smartCumEur;
      }

      points.push(point);
    }

    const renewableShareDay = sumLoad > 0 ? this._clamp((sumRenewable / sumLoad) * 100, 0, 100) : null;
    const avgAutarkyDay = autarkyCount > 0 ? sumAutarky / autarkyCount : null;
    const hasPriceStats = priceIntervals > 0;
    const savedNonGridFinal = hasPriceStats && nonGridPricedIntervals > 0 ? savedNonGridEur : null;
    const savedSolarFinal = hasPriceStats && solarPricedIntervals > 0 ? savedSolarDirectEur : null;
    const batteryArbitrageFinal = hasPriceStats ? batteryArbitrageEur : null;
    const smartSavingsEur =
      !hasPriceStats || (savedSolarFinal === null && batteryArbitrageFinal === null)
        ? null
        : (savedSolarFinal ?? 0) + (batteryArbitrageFinal ?? 0);

    const stepValues = points
      .reduce((acc, p) => {
        acc.push(p.saveSolarEur, p.saveArbitrageEur, p.saveSmartEur);
        return acc;
      }, [])
      .filter((v) => v !== null && v !== undefined);
    const cumValues = points
      .map((p) => p.saveSmartCumEur)
      .filter((v) => v !== null && v !== undefined);
    const savingsStepMin = stepValues.length > 0 ? Math.min(0, ...stepValues) : 0;
    const savingsStepMax = stepValues.length > 0 ? Math.max(0, ...stepValues) : 0;
    const savingsCumMin = cumValues.length > 0 ? Math.min(0, ...cumValues) : 0;
    const savingsCumMax = cumValues.length > 0 ? Math.max(0, ...cumValues) : 0;

    return {
      points,
      stepMs,
      renewableShareDay,
      avgAutarkyDay,
      savedNonGridEur: savedNonGridFinal,
      savedSolarDirectEur: savedSolarFinal,
      batteryShiftBuyEur: hasPriceStats ? batteryShiftBuyEur : null,
      batteryShiftSellEur: hasPriceStats ? batteryShiftSellEur : null,
      batteryArbitrageEur: batteryArbitrageFinal,
      batteryArbitrageKwh: hasPriceStats ? batteryArbitrageKwh : null,
      smartSavingsEur,
      savingsStepMin,
      savingsStepMax,
      savingsCumMin,
      savingsCumMax,
      maxLoad: Math.max(1, ...points.map((p) => p.load ?? 0)),
      rangeLabel: windowCfg.label,
      startLabel: this._formatAxisLabel(start, windowCfg.key),
      endLabel: this._formatAxisLabel(end, windowCfg.key),
    };
  }

  _isLongTrendRange(windowCfg) {
    if (!windowCfg?.key) {
      return false;
    }
    return (
      windowCfg.key === TREND_RANGES.week7.key ||
      windowCfg.key === TREND_RANGES.month.key ||
      windowCfg.key === TREND_RANGES.total.key
    );
  }

  _historyChunkMs(windowCfg) {
    if (windowCfg?.key === TREND_RANGES.total.key) {
      return 7 * 24 * 60 * 60 * 1000;
    }
    if (windowCfg?.key === TREND_RANGES.month.key) {
      return 3 * 24 * 60 * 60 * 1000;
    }
    if (windowCfg?.key === TREND_RANGES.week7.key) {
      return 2 * 24 * 60 * 60 * 1000;
    }
    return null;
  }

  _historyPath({ startMs, endMs, entities, significantChangesOnly = false }) {
    const params = new URLSearchParams({
      filter_entity_id: entities.join(","),
      end_time: new Date(endMs).toISOString(),
      no_attributes: "1",
      minimal_response: "1",
      significant_changes_only: significantChangesOnly ? "1" : "0",
    });
    return `history/period/${new Date(startMs).toISOString()}?${params.toString()}`;
  }

  async _fetchHistoryWindow(entities, windowCfg) {
    const longRange = this._isLongTrendRange(windowCfg);
    const chunkMs = this._historyChunkMs(windowCfg);

    if (!longRange || !chunkMs) {
      const path = this._historyPath({
        startMs: windowCfg.startMs,
        endMs: windowCfg.endMs,
        entities,
        significantChangesOnly: false,
      });
      return this._hass.callApi("GET", path);
    }

    const chunkRanges = [];
    for (let cursor = windowCfg.startMs; cursor < windowCfg.endMs; cursor += chunkMs) {
      chunkRanges.push({
        chunkStart: cursor,
        chunkEnd: Math.min(windowCfg.endMs, cursor + chunkMs),
      });
    }
    if (chunkRanges.length === 0) {
      return [];
    }

    const parts = new Array(chunkRanges.length);
    let successChunks = 0;
    let lastError = null;
    let nextIndex = 0;
    const workerCount = Math.min(4, chunkRanges.length);

    const runWorker = async () => {
      while (nextIndex < chunkRanges.length) {
        const idx = nextIndex;
        nextIndex += 1;
        const range = chunkRanges[idx];
        const path = this._historyPath({
          startMs: range.chunkStart,
          endMs: range.chunkEnd,
          entities,
          significantChangesOnly: true,
        });
        try {
          const part = await this._hass.callApi("GET", path);
          if (Array.isArray(part)) {
            parts[idx] = part;
            successChunks += 1;
          } else {
            parts[idx] = [];
          }
        } catch (error) {
          parts[idx] = [];
          lastError = error;
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

    if (successChunks === 0 && lastError) {
      throw lastError;
    }
    const history = [];
    for (const part of parts) {
      if (Array.isArray(part)) {
        history.push(...part);
      }
    }
    return history;
  }

  _trendEntitiesForFetch(
    sensors,
    priceCfg = null,
    flowOpts = this._flowOptions(),
    batterySignedEntityId = null,
    extraEntityIds = []
  ) {
    const entities = [sensors.load_power];
    if (sensors.solar_power) {
      entities.push(sensors.solar_power);
    }
    if (sensors.solar_energy) {
      entities.push(sensors.solar_energy);
    }
    if (sensors.load_energy) {
      entities.push(sensors.load_energy);
    }
    if (sensors.grid_import_power) {
      entities.push(sensors.grid_import_power);
    }
    if (sensors.grid_export_power) {
      entities.push(sensors.grid_export_power);
    }
    if (sensors.grid_import_energy) {
      entities.push(sensors.grid_import_energy);
    }
    if (sensors.grid_export_energy) {
      entities.push(sensors.grid_export_energy);
    }
    if (sensors.grid_power) {
      entities.push(sensors.grid_power);
    }
    if (this._stateObj(TIBBER_LIVE_GRID_SENSOR) || !sensors.grid_power) {
      entities.push(TIBBER_LIVE_GRID_SENSOR);
    }
    if (!flowOpts.useSignedBatteryPower && sensors.battery_charge_power) {
      entities.push(sensors.battery_charge_power);
    }
    if (!flowOpts.useSignedBatteryPower && sensors.battery_discharge_power) {
      entities.push(sensors.battery_discharge_power);
    }
    if (sensors.battery_charge_energy) {
      entities.push(sensors.battery_charge_energy);
    }
    if (sensors.battery_discharge_energy) {
      entities.push(sensors.battery_discharge_energy);
    }
    if (batterySignedEntityId) {
      entities.push(batterySignedEntityId);
    }
    if (sensors.battery_inverter_power) {
      entities.push(sensors.battery_inverter_power);
    }
    if (sensors.battery_power) {
      entities.push(sensors.battery_power);
    }
    if (priceCfg?.entityId) {
      entities.push(priceCfg.entityId);
    }
    if (Array.isArray(extraEntityIds) && extraEntityIds.length > 0) {
      entities.push(...extraEntityIds.filter(Boolean));
    }
    return [...new Set(entities.filter(Boolean))];
  }

  async _fetchTrendDataForWindow(
    sensors,
    windowCfg,
    priceCfg = null,
    signedGridEntityId = null,
    signedBatteryEntityId = null,
    force = false,
    extraChips = []
  ) {
    if (!this._hass?.callApi) {
      throw new Error("History API nicht verfügbar");
    }

    const extraEntityIds = Array.isArray(extraChips)
      ? extraChips.map((chip) => chip?.entity).filter(Boolean)
      : [];
    const key = this._buildTrendKey(
      sensors,
      windowCfg,
      priceCfg,
      signedGridEntityId,
      signedBatteryEntityId,
      extraEntityIds
    );
    const now = Date.now();
    if (!force) {
      const cached = this._trendCache.get(key);
      if (cached?.data && now - (cached.ts || 0) < 20 * 60 * 1000) {
        return cached.data;
      }
    }

    const uniqEntities = this._trendEntitiesForFetch(
      sensors,
      priceCfg,
      this._flowOptions(),
      signedBatteryEntityId,
      extraEntityIds
    );
    if (uniqEntities.length === 0) {
      throw new Error("Keine Verlauf-Entitäten verfügbar");
    }

    try {
      const history = await this._fetchHistoryWindow(uniqEntities, windowCfg);
      const series = this._historyToSeries(history);
      const trend = this._buildTrendData(
        series,
        sensors,
        windowCfg,
        priceCfg,
        signedGridEntityId,
        signedBatteryEntityId,
        extraChips
      );
      this._setTrendCache(key, trend, Date.now());
      return trend;
    } catch (error) {
      if (this._isLongTrendRange(windowCfg)) {
        const path = this._historyPath({
          startMs: windowCfg.startMs,
          endMs: windowCfg.endMs,
          entities: uniqEntities,
          significantChangesOnly: false,
        });
        const history = await this._hass.callApi("GET", path);
        const series = this._historyToSeries(history);
        const trend = this._buildTrendData(
          series,
          sensors,
          windowCfg,
          priceCfg,
          signedGridEntityId,
          signedBatteryEntityId,
          extraChips
        );
        this._setTrendCache(key, trend, Date.now());
        return trend;
      }
      throw error;
    }
  }

  _buildReportFromTrendData(trendData, windowCfg, period) {
    const points = Array.isArray(trendData?.points) ? trendData.points : [];
    const stepHours = (windowCfg?.stepMs || 0) / (60 * 60 * 1000);
    let loadKwh = 0;
    let gridKwh = 0;
    let solarKwh = 0;
    let batteryKwh = 0;
    let nonNullPoints = 0;
    const rows = [];

    points.forEach((point) => {
      const loadW = point?.load;
      const gridW = point?.gridCover;
      const solarW = point?.solarCover;
      const batteryW = point?.batteryCover;
      if (loadW !== null && loadW !== undefined) {
        loadKwh += (Math.max(0, Number(loadW) || 0) * stepHours) / 1000;
        nonNullPoints += 1;
      }
      if (gridW !== null && gridW !== undefined) {
        gridKwh += (Math.max(0, Number(gridW) || 0) * stepHours) / 1000;
      }
      if (solarW !== null && solarW !== undefined) {
        solarKwh += (Math.max(0, Number(solarW) || 0) * stepHours) / 1000;
      }
      if (batteryW !== null && batteryW !== undefined) {
        batteryKwh += (Math.max(0, Number(batteryW) || 0) * stepHours) / 1000;
      }

      rows.push({
        t: point?.t || null,
        loadW: loadW === null || loadW === undefined ? null : Math.max(0, Number(loadW) || 0),
        gridW: gridW === null || gridW === undefined ? null : Math.max(0, Number(gridW) || 0),
        solarW: solarW === null || solarW === undefined ? null : Math.max(0, Number(solarW) || 0),
        batteryW:
          batteryW === null || batteryW === undefined ? null : Math.max(0, Number(batteryW) || 0),
        autarkyPct:
          point?.autarky === null || point?.autarky === undefined
            ? null
            : this._clamp(Number(point.autarky) || 0, 0, 100),
      });
    });

    const localKwh = Math.max(0, loadKwh - gridKwh);
    const autarkyPct = loadKwh > 0 ? this._clamp((1 - gridKwh / loadKwh) * 100, 0, 100) : null;
    const pvUsagePct = loadKwh > 0 ? this._clamp((solarKwh / loadKwh) * 100, 0, 100) : null;
    const batterySharePct = loadKwh > 0 ? this._clamp((batteryKwh / loadKwh) * 100, 0, 100) : null;

    return {
      period,
      label: windowCfg?.label || (period === "year" ? "Jahr" : "Monat"),
      startMs: windowCfg?.startMs || null,
      endMs: windowCfg?.endMs || null,
      generatedAt: Date.now(),
      sourcePoints: nonNullPoints,
      totals: {
        loadKwh,
        gridKwh,
        localKwh,
        solarKwh,
        batteryKwh,
        autarkyPct,
        pvUsagePct,
        batterySharePct,
      },
      savings: {
        smartEur: trendData?.smartSavingsEur ?? null,
        solarDirectEur: trendData?.savedSolarDirectEur ?? null,
        nonGridEur: trendData?.savedNonGridEur ?? null,
        batteryArbitrageEur: trendData?.batteryArbitrageEur ?? null,
      },
      rows,
    };
  }

  async _loadReportData(period = this._reportPeriod, force = false) {
    if (this._reportLoading) {
      return;
    }
    this._reportLoading = true;
    this._reportError = "";
    this._requestRender({ immediate: true, full: true });

    try {
      const sensors = this._sensors();
      const priceCfg = this._trendPriceConfig();
      const signedGridSource = this._resolveGridSignedSource(sensors);
      const signedBatterySource = this._resolveBatterySignedSource(sensors);
      const windowCfg = this._reportWindow(period);
      const trendData = await this._fetchTrendDataForWindow(
        sensors,
        windowCfg,
        priceCfg,
        signedGridSource.entityId,
        signedBatterySource.entityId,
        force
      );
      this._reportData = this._buildReportFromTrendData(trendData, windowCfg, period);
    } catch (error) {
      this._reportData = null;
      this._reportError = `Bericht konnte nicht erstellt werden: ${error?.message || error}`;
    } finally {
      this._reportLoading = false;
      this._requestRender({ immediate: true, full: true });
    }
  }

  _openReportDialog() {
    this._settingsOpen = false;
    this._reportOpen = true;
    this._reportError = "";
    if (!this._reportData || this._reportData.period !== this._reportPeriod) {
      void this._loadReportData(this._reportPeriod, false);
    }
    this._requestRender({ immediate: true, full: true });
  }

  _closeReportDialog() {
    this._reportOpen = false;
    this._requestRender({ immediate: true, full: true });
  }

  _setReportPeriod(period) {
    const next = period === "year" ? "year" : "month";
    if (this._reportPeriod === next) {
      return;
    }
    this._reportPeriod = next;
    this._reportData = null;
    void this._loadReportData(next, false);
    this._requestRender({ immediate: true, full: true });
  }

  _downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  _csvValue(raw) {
    if (raw === null || raw === undefined) {
      return "";
    }
    const txt = String(raw);
    if (txt.includes(";") || txt.includes("\n") || txt.includes('"')) {
      return `"${txt.replace(/"/g, '""')}"`;
    }
    return txt;
  }

  _reportFilenameBase(report) {
    const suffix = report?.period === "year" ? "jahr" : "monat";
    const stamp = this._formatDateTime(report?.generatedAt || Date.now())
      .replace(/[.: ]/g, "-")
      .replace(/-+/g, "-");
    return `energie_report_${suffix}_${stamp}`;
  }

  _exportReportCsv() {
    const report = this._reportData;
    if (!report) {
      return;
    }
    const totals = report.totals || {};
    const savings = report.savings || {};
    const lines = [];
    lines.push("Metrik;Wert");
    lines.push(`Zeitraum;${this._csvValue(report.label || "-")}`);
    lines.push(`Von;${this._csvValue(report.startMs ? this._formatDateTime(report.startMs) : "-")}`);
    lines.push(`Bis;${this._csvValue(report.endMs ? this._formatDateTime(report.endMs) : "-")}`);
    lines.push(`Erstellt;${this._csvValue(this._formatDateTime(report.generatedAt || Date.now()))}`);
    lines.push(`Gesamtlast_kWh;${this._csvValue((totals.loadKwh ?? 0).toFixed(3))}`);
    lines.push(`Netzbezug_kWh;${this._csvValue((totals.gridKwh ?? 0).toFixed(3))}`);
    lines.push(`Lokale_Versorgung_kWh;${this._csvValue((totals.localKwh ?? 0).toFixed(3))}`);
    lines.push(`PV_Nutzung_kWh;${this._csvValue((totals.solarKwh ?? 0).toFixed(3))}`);
    lines.push(`Batterie_Nutzung_kWh;${this._csvValue((totals.batteryKwh ?? 0).toFixed(3))}`);
    lines.push(`Autarkie_pct;${this._csvValue(totals.autarkyPct === null ? "" : totals.autarkyPct.toFixed(2))}`);
    lines.push(`PV_Anteil_pct;${this._csvValue(totals.pvUsagePct === null ? "" : totals.pvUsagePct.toFixed(2))}`);
    lines.push(
      `Batterie_Anteil_pct;${this._csvValue(
        totals.batterySharePct === null ? "" : totals.batterySharePct.toFixed(2)
      )}`
    );
    lines.push(`Ersparnis_Smart_EUR;${this._csvValue(savings.smartEur === null ? "" : Number(savings.smartEur).toFixed(2))}`);
    lines.push(
      `Ersparnis_Solar_Direkt_EUR;${this._csvValue(
        savings.solarDirectEur === null ? "" : Number(savings.solarDirectEur).toFixed(2)
      )}`
    );
    lines.push(
      `Wert_Nichtbezug_EUR;${this._csvValue(
        savings.nonGridEur === null ? "" : Number(savings.nonGridEur).toFixed(2)
      )}`
    );
    lines.push(
      `Akku_Preisvorteil_EUR;${this._csvValue(
        savings.batteryArbitrageEur === null ? "" : Number(savings.batteryArbitrageEur).toFixed(2)
      )}`
    );
    lines.push("");
    lines.push("Zeit;Gesamtlast_W;Netz_W;Solar_W;Batterie_W;Autarkie_pct");

    (report.rows || []).forEach((row) => {
      lines.push(
        [
          this._csvValue(row.t ? this._formatDateTime(row.t) : ""),
          this._csvValue(row.loadW === null ? "" : Number(row.loadW).toFixed(1)),
          this._csvValue(row.gridW === null ? "" : Number(row.gridW).toFixed(1)),
          this._csvValue(row.solarW === null ? "" : Number(row.solarW).toFixed(1)),
          this._csvValue(row.batteryW === null ? "" : Number(row.batteryW).toFixed(1)),
          this._csvValue(row.autarkyPct === null ? "" : Number(row.autarkyPct).toFixed(2)),
        ].join(";")
      );
    });

    const filename = `${this._reportFilenameBase(report)}.csv`;
    this._downloadTextFile(filename, lines.join("\n"), "text/csv;charset=utf-8");
  }

  _exportReportPdf() {
    const report = this._reportData;
    if (!report) {
      return;
    }
    const totals = report.totals || {};
    const savings = report.savings || {};
    const html = `
<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Energie Report</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; margin: 22px; color: #1d2a36; }
    h1 { margin: 0 0 10px; font-size: 22px; }
    .meta { margin-bottom: 14px; color: #45596d; font-size: 13px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
    th, td { border: 1px solid #d2dbe4; padding: 8px 10px; text-align: left; font-size: 13px; }
    th { background: #eef3f8; }
    .foot { margin-top: 8px; color: #5a6f84; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Energie Report (${this._escapeHtml(report.period === "year" ? "Jahr" : "Monat")})</h1>
  <div class="meta">
    Zeitraum: ${this._escapeHtml(report.label || "-")}<br>
    Von: ${this._escapeHtml(report.startMs ? this._formatDateTime(report.startMs) : "-")}<br>
    Bis: ${this._escapeHtml(report.endMs ? this._formatDateTime(report.endMs) : "-")}<br>
    Erstellt: ${this._escapeHtml(this._formatDateTime(report.generatedAt || Date.now()))}
  </div>
  <table>
    <thead><tr><th>Metrik</th><th>Wert</th></tr></thead>
    <tbody>
      <tr><td>Gesamtlast</td><td>${this._escapeHtml(this._formatEnergyKwh(totals.loadKwh))}</td></tr>
      <tr><td>Netzbezug</td><td>${this._escapeHtml(this._formatEnergyKwh(totals.gridKwh))}</td></tr>
      <tr><td>Lokale Versorgung</td><td>${this._escapeHtml(this._formatEnergyKwh(totals.localKwh))}</td></tr>
      <tr><td>PV-Nutzung</td><td>${this._escapeHtml(this._formatEnergyKwh(totals.solarKwh))}</td></tr>
      <tr><td>Batterie-Nutzung</td><td>${this._escapeHtml(this._formatEnergyKwh(totals.batteryKwh))}</td></tr>
      <tr><td>Autarkie</td><td>${this._escapeHtml(this._formatPercent(totals.autarkyPct))}</td></tr>
      <tr><td>PV-Anteil</td><td>${this._escapeHtml(this._formatPercent(totals.pvUsagePct))}</td></tr>
      <tr><td>Batterie-Anteil</td><td>${this._escapeHtml(this._formatPercent(totals.batterySharePct))}</td></tr>
      <tr><td>Smart-Ersparnis</td><td>${this._escapeHtml(this._formatMoneyWithCent(savings.smartEur))}</td></tr>
      <tr><td>Solar direkt</td><td>${this._escapeHtml(this._formatMoneyWithCent(savings.solarDirectEur))}</td></tr>
      <tr><td>Wert Nichtbezug</td><td>${this._escapeHtml(this._formatMoneyWithCent(savings.nonGridEur))}</td></tr>
      <tr><td>Akku Preisvorteil</td><td>${this._escapeHtml(this._formatMoneyWithCent(savings.batteryArbitrageEur))}</td></tr>
    </tbody>
  </table>
  <div class="foot">Hinweis: PDF enthält die Zusammenfassung. Detaillierte Zeitreihe steht im CSV-Export.</div>
</body>
</html>`;

    const popup = window.open("", "_blank", "noopener,noreferrer,width=960,height=840");
    if (!popup) {
      this._reportError = "PDF konnte nicht geöffnet werden (Popup blockiert).";
      this._requestRender({ immediate: true, full: true });
      return;
    }
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    window.setTimeout(() => {
      popup.focus();
      popup.print();
    }, 300);
  }

  _reportModalHTML() {
    const report = this._reportData;
    const isMonth = this._reportPeriod === "month";
    const isYear = this._reportPeriod === "year";
    const totals = report?.totals || {};
    const savings = report?.savings || {};
    return `
      <div class="report-overlay" data-action="close-report-overlay">
        <section class="report-dialog" role="dialog" aria-modal="true" aria-label="Berichte">
          <header class="settings-head">
            <div class="settings-title">Berichte (Monat/Jahr)</div>
            <button class="btn ghost" data-action="close-report">Schließen</button>
          </header>
          <div class="report-controls">
            <div class="trend-controls">
              <button class="range-btn ${isMonth ? "active" : ""}" data-action="report-period" data-period="month">Monat</button>
              <button class="range-btn ${isYear ? "active" : ""}" data-action="report-period" data-period="year">Jahr</button>
            </div>
            <button class="btn ghost" data-action="report-refresh">Neu laden</button>
            <button class="btn ghost" data-action="report-export-csv" ${report && !this._reportLoading ? "" : "disabled"}>CSV</button>
            <button class="btn primary" data-action="report-export-pdf" ${report && !this._reportLoading ? "" : "disabled"}>PDF</button>
          </div>
          ${
            this._reportError
              ? `<div class="settings-error">${this._escapeHtml(this._reportError)}</div>`
              : ""
          }
          ${
            this._reportLoading
              ? `<div class="report-loading">Bericht wird erstellt...</div>`
              : report
                ? `
                  <div class="report-meta">
                    Zeitraum: <strong>${this._escapeHtml(report.label || "-")}</strong> ·
                    Von ${this._escapeHtml(report.startMs ? this._formatDateTime(report.startMs) : "-")} bis ${this._escapeHtml(report.endMs ? this._formatDateTime(report.endMs) : "-")} ·
                    erstellt ${this._escapeHtml(this._formatDateTime(report.generatedAt || Date.now()))}
                  </div>
                  <div class="report-kpis">
                    <article class="card"><div class="k">Gesamtlast</div><div class="v">${this._formatEnergyKwh(totals.loadKwh)}</div></article>
                    <article class="card"><div class="k">Netzbezug</div><div class="v">${this._formatEnergyKwh(totals.gridKwh)}</div></article>
                    <article class="card"><div class="k">Autarkie</div><div class="v">${this._formatPercent(totals.autarkyPct)}</div></article>
                    <article class="card"><div class="k">PV-Nutzung</div><div class="v">${this._formatEnergyKwh(totals.solarKwh)}</div></article>
                    <article class="card"><div class="k">Batterie-Nutzung</div><div class="v">${this._formatEnergyKwh(totals.batteryKwh)}</div></article>
                    <article class="card"><div class="k">Lokale Versorgung</div><div class="v">${this._formatEnergyKwh(totals.localKwh)}</div></article>
                    <article class="card"><div class="k">Smart-Ersparnis</div><div class="v">${this._formatMoneyWithCent(savings.smartEur)}</div></article>
                    <article class="card"><div class="k">Solar direkt</div><div class="v">${this._formatMoneyWithCent(savings.solarDirectEur)}</div></article>
                    <article class="card"><div class="k">Akku Preisvorteil</div><div class="v">${this._formatMoneyWithCent(savings.batteryArbitrageEur)}</div></article>
                  </div>
                `
                : `<div class="report-loading">Noch kein Bericht vorhanden.</div>`
          }
        </section>
      </div>
    `;
  }

  async _fetchTrendIfNeeded(sensors) {
    if (!this._hass?.callApi) {
      return;
    }
    const flowOpts = this._flowOptions();
    const windowCfg = this._trendWindow();
    const priceCfg = this._trendPriceConfig();
    const signedGridSource = this._resolveGridSignedSource(sensors);
    const signedGridEntityId = signedGridSource.entityId;
    const signedBatterySource = this._resolveBatterySignedSource(sensors);
    const signedBatteryEntityId = signedBatterySource.entityId;
    const extraChips = this._extraChips();
    const extraEntityIds = extraChips.map((chip) => chip?.entity).filter(Boolean);
    const key = this._buildTrendKey(
      sensors,
      windowCfg,
      priceCfg,
      signedGridEntityId,
      signedBatteryEntityId,
      extraEntityIds
    );
    const now = Date.now();

    const cached = this._trendCache.get(key);
    if (cached?.data && now - (cached.ts || 0) < 20 * 60 * 1000) {
      this._trendKey = key;
      this._trendData = cached.data;
      this._trendLastFetch = cached.ts || now;
      return;
    }

    if (this._trendLoading) {
      return;
    }
    if (this._trendKey === key && this._trendData && now - this._trendLastFetch < 10 * 60 * 1000) {
      return;
    }

    const uniqEntities = this._trendEntitiesForFetch(
      sensors,
      priceCfg,
      flowOpts,
      signedBatteryEntityId,
      extraEntityIds
    );
    if (uniqEntities.length === 0) {
      return;
    }

    this._trendLoading = true;
    this._trendKey = key;
    this._requestRender({ immediate: true, full: true });

    try {
      const history = await this._fetchHistoryWindow(uniqEntities, windowCfg);
      const series = this._historyToSeries(history);
      this._trendData = this._buildTrendData(
        series,
        sensors,
        windowCfg,
        priceCfg,
        signedGridEntityId,
        signedBatteryEntityId,
        extraChips
      );
      this._trendLastFetch = Date.now();
      this._setTrendCache(key, this._trendData, this._trendLastFetch);
    } catch (error) {
      // Fallback for installations with strict history response limits.
      if (this._isLongTrendRange(windowCfg)) {
        try {
          const path = this._historyPath({
            startMs: windowCfg.startMs,
            endMs: windowCfg.endMs,
            entities: uniqEntities,
            significantChangesOnly: false,
          });
          const history = await this._hass.callApi("GET", path);
          const series = this._historyToSeries(history);
          this._trendData = this._buildTrendData(
            series,
            sensors,
            windowCfg,
            priceCfg,
            signedGridEntityId,
            signedBatteryEntityId,
            extraChips
          );
          this._trendLastFetch = Date.now();
          this._setTrendCache(key, this._trendData, this._trendLastFetch);
          return;
        } catch (fallbackError) {
          // keep null state below
        }
      }
      this._trendData = null;
      this._trendLastFetch = Date.now();
    } finally {
      this._trendLoading = false;
      this._requestRender({ immediate: true, full: true });
    }
  }

  _trendMixSummary(data = this._trendData) {
    const empty = {
      available: false,
      totalKwh: 0,
      houseLoadKwh: 0,
      solarKwh: 0,
      batteryKwh: 0,
      gridKwh: 0,
      solarProducedKwh: 0,
      gridImportTotalKwh: 0,
      gridImportAccountedKwh: 0,
      gridImportDiffKwh: 0,
      gridExportTotalKwh: 0,
      gridToBatteryKwh: 0,
      batteryDischargeTotalKwh: 0,
      batteryChargeTotalKwh: 0,
      solarPct: 0,
      batteryPct: 0,
      gridPct: 0,
      autarkyPct: null,
    };
    if (!data || !Array.isArray(data.points) || data.points.length === 0) {
      return empty;
    }

    const stepMs = Math.max(TREND_STEP_MIN_MS, Number(data.stepMs) || TREND_STEP_MIN_MS);
    const stepHours = stepMs / (60 * 60 * 1000);
    let solarKwh = 0;
    let batteryKwh = 0;
    let gridKwh = 0;
    let loadKwh = 0;
    let solarProducedKwh = 0;
    let gridImportTotalKwh = 0;
    let gridExportTotalKwh = 0;
    let gridToBatteryKwh = 0;
    let batteryDischargeTotalKwh = 0;
    let batteryChargeTotalKwh = 0;

    data.points.forEach((point) => {
      const solarW = Math.max(
        0,
        Number(
          point?.solarToHousePower === null || point?.solarToHousePower === undefined
            ? point?.solarCover
            : point?.solarToHousePower
        ) || 0
      );
      const batteryW = Math.max(
        0,
        Number(
          point?.batteryToHousePower === null || point?.batteryToHousePower === undefined
            ? point?.batteryCover
            : point?.batteryToHousePower
        ) || 0
      );
      const gridW = Math.max(
        0,
        Number(
          point?.gridToHousePower === null || point?.gridToHousePower === undefined
            ? point?.gridCover
            : point?.gridToHousePower
        ) || 0
      );
      const loadW = Math.max(
        0,
        Number(
          point?.houseNetPower === null || point?.houseNetPower === undefined
            ? point?.load
            : point?.houseNetPower
        ) || 0
      );
      const solarProducedW = Math.max(0, Number(point?.solarPower) || 0);
      const gridImportTotalW = Math.max(0, Number(point?.gridImportPower) || 0);
      const gridExportTotalW = Math.max(0, Number(point?.gridExportPower) || 0);
      const gridToBatteryW = Math.max(0, Number(point?.gridToBatteryPower) || 0);
      const batteryDischargeW = Math.max(0, Number(point?.batteryDischargePower) || 0);
      const batteryChargeW = Math.max(0, Number(point?.batteryChargePower) || 0);

      solarKwh += (solarW * stepHours) / 1000;
      batteryKwh += (batteryW * stepHours) / 1000;
      gridKwh += (gridW * stepHours) / 1000;
      solarProducedKwh += (solarProducedW * stepHours) / 1000;
      gridImportTotalKwh += (gridImportTotalW * stepHours) / 1000;
      gridExportTotalKwh += (gridExportTotalW * stepHours) / 1000;
      gridToBatteryKwh += (gridToBatteryW * stepHours) / 1000;
      batteryDischargeTotalKwh += (batteryDischargeW * stepHours) / 1000;
      batteryChargeTotalKwh += (batteryChargeW * stepHours) / 1000;
      if (loadW > 0) {
        loadKwh += (loadW * stepHours) / 1000;
      }
    });

    const splitTotalKwh = Math.max(0, solarKwh + batteryKwh + gridKwh);
    const totalKwh = loadKwh > 0 ? loadKwh : splitTotalKwh;
    if (!(totalKwh > 0) && !(splitTotalKwh > 0)) {
      return empty;
    }

    const baseKwh = totalKwh > 0 ? totalKwh : splitTotalKwh;
    const solarPct = baseKwh > 0 ? this._clamp((solarKwh / baseKwh) * 100, 0, 100) : 0;
    const batteryPct = baseKwh > 0 ? this._clamp((batteryKwh / baseKwh) * 100, 0, 100) : 0;
    const gridPct = baseKwh > 0 ? this._clamp((gridKwh / baseKwh) * 100, 0, 100) : 0;
    const autarkyPct = baseKwh > 0 ? this._clamp(((solarKwh + batteryKwh) / baseKwh) * 100, 0, 100) : null;
    const gridImportAccountedKwh = Math.max(0, gridKwh + gridToBatteryKwh);
    const gridImportDiffKwh = gridImportTotalKwh - gridImportAccountedKwh;

    return {
      available: true,
      totalKwh: baseKwh,
      houseLoadKwh: baseKwh,
      solarKwh,
      batteryKwh,
      gridKwh,
      solarProducedKwh,
      gridImportTotalKwh,
      gridImportAccountedKwh,
      gridImportDiffKwh,
      gridExportTotalKwh,
      gridToBatteryKwh,
      batteryDischargeTotalKwh,
      batteryChargeTotalKwh,
      solarPct,
      batteryPct,
      gridPct,
      autarkyPct,
    };
  }

  _drawTrendMixChart() {
    const canvas = this.shadowRoot?.querySelector("#trend-mix-canvas");
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const mix = this._trendMixSummary(this._trendData);
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 280;
    const cssHeight = canvas.clientHeight || 220;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (!mix.available) {
      ctx.fillStyle = this._themeDark ? "#9eb4c8" : "#6f8090";
      ctx.font = "12px Sora, Segoe UI, sans-serif";
      ctx.fillText(this._trendLoading ? "Lade Mix..." : "Kein Mix verfügbar", 10, 18);
      return;
    }

    const centerX = cssWidth / 2;
    const centerY = cssHeight / 2 - 4;
    const outerR = Math.max(34, Math.min(cssWidth, cssHeight) * 0.34);
    const innerR = outerR * 0.62;
    const ringWidth = outerR - innerR;
    const slices = [
      { key: "solar", value: mix.solarKwh, color: "#25b788" },
      { key: "battery", value: mix.batteryKwh, color: "#7c5cff" },
      { key: "grid", value: mix.gridKwh, color: "#f29b38" },
    ];
    const total = Math.max(0, mix.totalKwh);

    ctx.beginPath();
    ctx.strokeStyle = this._themeDark ? "rgba(147, 171, 194, 0.2)" : "rgba(45, 68, 89, 0.16)";
    ctx.lineWidth = ringWidth;
    ctx.arc(centerX, centerY, innerR + ringWidth / 2, 0, Math.PI * 2);
    ctx.stroke();

    let start = -Math.PI / 2;
    slices.forEach((slice) => {
      if (!(slice.value > 0) || !(total > 0)) {
        return;
      }
      const angle = (slice.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.strokeStyle = slice.color;
      ctx.lineWidth = ringWidth;
      ctx.lineCap = "butt";
      ctx.arc(centerX, centerY, innerR + ringWidth / 2, start, start + angle);
      ctx.stroke();
      start += angle;
    });

    ctx.fillStyle = this._themeDark ? "#9eb4c8" : "#637789";
    ctx.font = "600 11px Sora, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Hauslast", centerX, centerY - 10);
    ctx.fillStyle = this._themeDark ? "#e7f1fa" : "#1a2c3b";
    ctx.font = "700 13px Sora, Segoe UI, sans-serif";
    ctx.fillText(this._formatEnergyKwh(total), centerX, centerY + 10);
  }

  _drawTrendChart() {
    const canvas = this.shadowRoot?.querySelector("#trend-canvas");
    if (!canvas) {
      return;
    }
    const data = this._trendData;
    if (!data || !Array.isArray(data.points) || data.points.length < 2) {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#6f8090";
      ctx.font = "12px Sora, Segoe UI, sans-serif";
      ctx.fillText(this._trendLoading ? "Lade Verlauf..." : "Keine Verlaufdaten", 12, 20);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 600;
    const cssHeight = canvas.clientHeight || 220;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const pad = { left: 44, right: 38, top: 14, bottom: 24 };
    const w = cssWidth - pad.left - pad.right;
    const h = cssHeight - pad.top - pad.bottom;

    const stepMs = Math.max(TREND_STEP_MIN_MS, Number(data.stepMs) || TREND_STEP_MIN_MS);
    const stepHours = stepMs / (60 * 60 * 1000);
    const toMetric = (powerW) => this._trendMetricFromPowerW(powerW, stepHours);
    const maxLoad = Math.max(
      0.001,
      ...data.points.map((point) => {
        const metric = toMetric(point?.load);
        return metric === null ? 0 : metric;
      })
    );
    const yPower = (v) => pad.top + h - ((Math.max(0, Number(v) || 0) / maxLoad) * h);
    const yPct = (v) => pad.top + h - (this._clamp(v ?? 0, 0, 100) / 100) * h;
    const xAt = (i, n) => pad.left + (i / (n - 1)) * w;

    ctx.strokeStyle = "rgba(36, 56, 72, 0.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#6b7b8a";
    ctx.font = "11px Sora, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(this._formatTrendAxisValue(maxLoad), pad.left - 6, pad.top + 10);
    ctx.fillText(this._formatTrendAxisValue(0), pad.left - 6, pad.top + h);
    ctx.textAlign = "left";
    ctx.fillText("100%", pad.left + w + 6, pad.top + 10);
    ctx.fillText("0%", pad.left + w + 6, pad.top + h);
    ctx.textAlign = "left";
    ctx.fillText(data.startLabel || "", pad.left, pad.top + h + 16);
    ctx.textAlign = "right";
    ctx.fillText(data.endLabel || "", pad.left + w, pad.top + h + 16);

    const drawPowerLine = (key, color, width = 2) => {
      ctx.beginPath();
      let moved = false;
      for (let i = 0; i < data.points.length; i += 1) {
        const metric = toMetric(data.points[i][key]);
        if (metric === null || metric === undefined) {
          moved = false;
          continue;
        }
        const x = xAt(i, data.points.length);
        const y = yPower(metric);
        if (!moved) {
          ctx.moveTo(x, y);
          moved = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash([]);
      ctx.stroke();
    };

    const drawPctLine = (key, color) => {
      ctx.beginPath();
      let moved = false;
      for (let i = 0; i < data.points.length; i += 1) {
        const val = data.points[i][key];
        if (val === null || val === undefined) {
          moved = false;
          continue;
        }
        const x = xAt(i, data.points.length);
        const y = yPct(val);
        if (!moved) {
          ctx.moveTo(x, y);
          moved = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    if (this._trendChartMode === TREND_CHART_MODES.bars) {
      const slot = data.points.length > 1 ? w / (data.points.length - 1) : w;
      const barWidth = this._clamp(slot * 0.62, 2, 18);
      const baselineY = pad.top + h;
      const segmentWidth = Math.max(1, barWidth - 2);
      data.points.forEach((point, i) => {
        const load = toMetric(point?.load);
        if (!(load > 0)) {
          return;
        }
        const xCenter = xAt(i, data.points.length);
        const xLeft = xCenter - barWidth / 2;
        const yTop = yPower(load);
        const barHeight = baselineY - yTop;
        if (!(barHeight > 0)) {
          return;
        }

        ctx.fillStyle = this._themeDark ? "rgba(242, 155, 56, 0.12)" : "rgba(242, 155, 56, 0.16)";
        ctx.fillRect(xLeft, yTop, barWidth, barHeight);
        ctx.strokeStyle = this._themeDark ? "rgba(242, 155, 56, 0.36)" : "rgba(184, 111, 24, 0.34)";
        ctx.lineWidth = 1;
        ctx.strokeRect(xLeft + 0.5, yTop + 0.5, Math.max(1, barWidth - 1), Math.max(1, barHeight - 1));

        const solarCoverRaw = toMetric(point.solarCover) ?? 0;
        const batteryCoverRaw = toMetric(point.batteryCover) ?? 0;
        const gridCoverRaw = toMetric(point.gridCover) ?? 0;
        const solarCover = this._clamp(solarCoverRaw, 0, load);
        const batteryCover = this._clamp(batteryCoverRaw, 0, load - solarCover);
        const gridCover = this._clamp(gridCoverRaw, 0, load - solarCover - batteryCover);

        let cursor = baselineY;
        const drawSegment = (value, color) => {
          if (!(value > 0)) {
            return;
          }
          const segHeight = (value / maxLoad) * h;
          if (!(segHeight > 0.2)) {
            return;
          }
          cursor -= segHeight;
          ctx.fillStyle = color;
          ctx.fillRect(xLeft + 1, cursor, segmentWidth, segHeight);
        };

        drawSegment(solarCover, "#25b788");
        drawSegment(batteryCover, "#7c5cff");
        drawSegment(gridCover, this._themeDark ? "rgba(156, 174, 195, 0.38)" : "rgba(82, 104, 126, 0.35)");

        if (point.autarky !== null && point.autarky !== undefined) {
          const autarkyCover = this._clamp((point.autarky / 100) * load, 0, load);
          const yAut = yPower(autarkyCover);
          ctx.strokeStyle = "#2b78d7";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(xLeft, yAut);
          ctx.lineTo(xLeft + barWidth, yAut);
          ctx.stroke();
        }
      });
    } else {
      drawPowerLine("load", "#f29b38", 2.4);
      drawPowerLine("renewable", "#25b788", 2.2);
      drawPctLine("autarky", "#2b78d7");
    }

    const hoverIdx = this._trendHoverIndex;
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < data.points.length) {
      const point = data.points[hoverIdx] || null;
      if (point) {
        const x = xAt(hoverIdx, data.points.length);
        ctx.strokeStyle = this._themeDark ? "rgba(164, 188, 214, 0.48)" : "rgba(39, 58, 77, 0.42)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + h);
        ctx.stroke();
        ctx.setLineDash([]);

        const markerY = [];
        const drawMarker = (val, yFn, color) => {
          if (val === null || val === undefined) {
            return;
          }
          const y = yFn(val);
          markerY.push(y);
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = this._themeDark ? "rgba(22, 33, 48, 0.9)" : "rgba(255, 255, 255, 0.9)";
          ctx.stroke();
        };

        if (this._trendChartMode === TREND_CHART_MODES.bars) {
          drawMarker(toMetric(point.load), yPower, "#f29b38");
          drawMarker(toMetric(point.solarCover), yPower, "#25b788");
          drawMarker(toMetric(point.batteryCover), yPower, "#7c5cff");
          const autarkyCover =
            point.autarky === null || point.autarky === undefined || point.load === null
              ? null
              : this._clamp(
                  (point.autarky / 100) * (toMetric(point.load) ?? 0),
                  0,
                  toMetric(point.load) ?? 0
                );
          drawMarker(autarkyCover, yPower, "#2b78d7");
        } else {
          drawMarker(toMetric(point.load), yPower, "#f29b38");
          drawMarker(toMetric(point.renewable), yPower, "#25b788");
          drawMarker(point.autarky, yPct, "#2b78d7");
        }

        const lines = [`Zeit: ${this._formatTime(point.t)}`];
        const intervalSuffix = this._trendValueMode === TREND_VALUE_MODES.kwh ? " (Intervall)" : "";
        if (point.load !== null && point.load !== undefined) {
          lines.push(`Gesamtlast${intervalSuffix}: ${this._formatTrendMetricValue(point.load, stepHours)}`);
        }
        if (point.solarCover !== null && point.solarCover !== undefined) {
          lines.push(`Solar deckt${intervalSuffix}: ${this._formatTrendMetricValue(point.solarCover, stepHours)}`);
        }
        if (point.batteryCover !== null && point.batteryCover !== undefined) {
          lines.push(`Batterie deckt${intervalSuffix}: ${this._formatTrendMetricValue(point.batteryCover, stepHours)}`);
        }
        if (point.gridCover !== null && point.gridCover !== undefined) {
          lines.push(`Netz deckt${intervalSuffix}: ${this._formatTrendMetricValue(point.gridCover, stepHours)}`);
        }
        if (point.renewable !== null && point.renewable !== undefined && this._trendChartMode !== TREND_CHART_MODES.bars) {
          lines.push(`Erneuerbar${intervalSuffix}: ${this._formatTrendMetricValue(point.renewable, stepHours)}`);
        }
        if (point.autarky !== null && point.autarky !== undefined) {
          lines.push(`Autarkie: ${this._formatPercent(point.autarky)}`);
        }

        this._drawCanvasTooltip(
          ctx,
          lines,
          x,
          markerY.length > 0 ? Math.min(...markerY) : pad.top + 20,
          cssWidth,
          cssHeight
        );
      }
    }
  }

  _drawSavingsChart() {
    const canvas = this.shadowRoot?.querySelector("#savings-canvas");
    if (!canvas) {
      return;
    }
    const data = this._trendData;
    if (!data || !Array.isArray(data.points) || data.points.length < 2) {
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#6f8090";
      ctx.font = "12px Sora, Segoe UI, sans-serif";
      ctx.fillText(this._trendLoading ? "Lade Sparverlauf..." : "Keine Sparwerte", 12, 20);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 600;
    const cssHeight = canvas.clientHeight || 210;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const pad = { left: 56, right: 56, top: 14, bottom: 24 };
    const w = cssWidth - pad.left - pad.right;
    const h = cssHeight - pad.top - pad.bottom;
    const xAt = (i, n) => pad.left + (i / (n - 1)) * w;

    let stepMin = Number.isFinite(data.savingsStepMin) ? data.savingsStepMin : 0;
    let stepMax = Number.isFinite(data.savingsStepMax) ? data.savingsStepMax : 0;
    if (Math.abs(stepMax - stepMin) < 0.00001) {
      stepMin -= 0.001;
      stepMax += 0.001;
    }
    let cumMin = Number.isFinite(data.savingsCumMin) ? data.savingsCumMin : 0;
    let cumMax = Number.isFinite(data.savingsCumMax) ? data.savingsCumMax : 0;
    if (Math.abs(cumMax - cumMin) < 0.00001) {
      cumMin -= 0.001;
      cumMax += 0.001;
    }

    const yStep = (v) => pad.top + h - ((v - stepMin) / (stepMax - stepMin)) * h;
    const yCum = (v) => pad.top + h - ((v - cumMin) / (cumMax - cumMin)) * h;
    const fmtCent = (eur) => `${(eur * 100).toFixed(1)} ct`;
    const fmtEur = (eur) => `${eur.toFixed(2)} €`;

    ctx.strokeStyle = "rgba(36, 56, 72, 0.16)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
    }

    const zeroY = yStep(0);
    ctx.strokeStyle = "rgba(36, 56, 72, 0.26)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(pad.left + w, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "#6b7b8a";
    ctx.font = "11px Sora, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(fmtCent(stepMax), pad.left - 6, pad.top + 10);
    ctx.fillText(fmtCent(stepMin), pad.left - 6, pad.top + h);
    ctx.textAlign = "left";
    ctx.fillText(fmtEur(cumMax), pad.left + w + 6, pad.top + 10);
    ctx.fillText(fmtEur(cumMin), pad.left + w + 6, pad.top + h);
    ctx.textAlign = "left";
    ctx.fillText(data.startLabel || "", pad.left, pad.top + h + 16);
    ctx.textAlign = "right";
    ctx.fillText(data.endLabel || "", pad.left + w, pad.top + h + 16);

    const drawLine = (key, yFn, color, width = 2, dash = []) => {
      ctx.beginPath();
      let moved = false;
      for (let i = 0; i < data.points.length; i += 1) {
        const val = data.points[i][key];
        if (val === null || val === undefined) {
          moved = false;
          continue;
        }
        const x = xAt(i, data.points.length);
        const y = yFn(val);
        if (!moved) {
          ctx.moveTo(x, y);
          moved = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    drawLine("saveSolarEur", yStep, "#25b788", 2.1);
    drawLine("saveArbitrageEur", yStep, "#d1782e", 2.1);
    drawLine("saveSmartCumEur", yCum, "#2b78d7", 2.6);

    const hoverIdx = this._savingsHoverIndex;
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < data.points.length) {
      const point = data.points[hoverIdx] || null;
      if (point) {
        const x = xAt(hoverIdx, data.points.length);
        ctx.strokeStyle = this._themeDark ? "rgba(164, 188, 214, 0.48)" : "rgba(39, 58, 77, 0.42)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + h);
        ctx.stroke();
        ctx.setLineDash([]);

        const markerY = [];
        const drawMarker = (val, yFn, color) => {
          if (val === null || val === undefined) {
            return;
          }
          const y = yFn(val);
          markerY.push(y);
          ctx.beginPath();
          ctx.fillStyle = color;
          ctx.arc(x, y, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = this._themeDark ? "rgba(22, 33, 48, 0.9)" : "rgba(255, 255, 255, 0.9)";
          ctx.stroke();
        };

        drawMarker(point.saveSolarEur, yStep, "#25b788");
        drawMarker(point.saveArbitrageEur, yStep, "#d1782e");
        drawMarker(point.saveSmartCumEur, yCum, "#2b78d7");

        const lines = [`Zeit: ${this._formatTime(point.t)}`];
        if (point.saveSolarEur !== null && point.saveSolarEur !== undefined) {
          lines.push(`Solar (Intervall): ${this._formatMoneyWithCent(point.saveSolarEur)}`);
        }
        if (point.saveArbitrageEur !== null && point.saveArbitrageEur !== undefined) {
          lines.push(`Akku (Intervall): ${this._formatMoneyWithCent(point.saveArbitrageEur)}`);
        }
        if (point.saveSmartCumEur !== null && point.saveSmartCumEur !== undefined) {
          lines.push(`Smart kumuliert: ${this._formatMoneyWithCent(point.saveSmartCumEur)}`);
        }

        this._drawCanvasTooltip(
          ctx,
          lines,
          x,
          markerY.length > 0 ? Math.min(...markerY) : pad.top + 20,
          cssWidth,
          cssHeight
        );
      }
    }
  }

  _drawPriceChart() {
    const canvas = this.shadowRoot?.querySelector("#price-canvas");
    if (!canvas) {
      return;
    }

    const priceInfo = this._priceInsight();
    const rowsRaw = Array.isArray(priceInfo?.chartRows) ? priceInfo.chartRows : [];
    const rows = rowsRaw
      .filter((row) => Number.isFinite(row?.t) && Number.isFinite(row?.p))
      .sort((a, b) => a.t - b.t);
    this._priceChartRows = rows;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 520;
    const cssHeight = canvas.clientHeight || 164;
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    if (!priceInfo?.available || rows.length < 2) {
      this._priceHoverIndex = null;
      this._priceChartRangeStart = null;
      this._priceChartRangeEnd = null;
      ctx.fillStyle = this._themeDark ? "#9eb4c8" : "#6f8090";
      ctx.font = "12px Sora, Segoe UI, sans-serif";
      ctx.fillText("Kein Preisverlauf verfügbar", 10, 18);
      return;
    }

    const pad = { left: 34, right: 10, top: 10, bottom: 22 };
    const w = cssWidth - pad.left - pad.right;
    const h = cssHeight - pad.top - pad.bottom;
    if (!(w > 10 && h > 10)) {
      return;
    }

    const configuredStartTs = Number(priceInfo.chartStartTs);
    const configuredEndTs = Number(priceInfo.chartEndTs);
    const minTs = Number.isFinite(configuredStartTs) ? configuredStartTs : rows[0].t;
    const fallbackEndTs = rows[rows.length - 1].t;
    const maxTsCandidate = Number.isFinite(configuredEndTs) ? configuredEndTs : fallbackEndTs;
    const maxTs = maxTsCandidate > minTs ? maxTsCandidate : fallbackEndTs;
    this._priceChartRangeStart = minTs;
    this._priceChartRangeEnd = maxTs;
    const spanTs = Math.max(1, maxTs - minTs);
    const values = rows.map((row) => row.p);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const spanVal = Math.max(0.001, maxVal - minVal);
    const yPad = spanVal * 0.12;
    const yMin = Math.max(0, minVal - yPad);
    const yMax = maxVal + yPad;
    const ySpan = Math.max(0.001, yMax - yMin);

    const xAt = (ts) => pad.left + ((ts - minTs) / spanTs) * w;
    const yAt = (price) => pad.top + h - ((price - yMin) / ySpan) * h;
    const unit = priceInfo.unit || "€/kWh";

    ctx.strokeStyle = this._themeDark ? "rgba(142, 165, 186, 0.22)" : "rgba(41, 66, 90, 0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i += 1) {
      const y = pad.top + (h / 3) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + w, y);
      ctx.stroke();
    }

    const firstRow = rows[0];
    const lastRow = rows[rows.length - 1];
    const chartStartX = xAt(minTs);
    const chartEndX = xAt(maxTs);
    const firstX = xAt(firstRow.t);
    const firstY = yAt(firstRow.p);
    const lastX = xAt(lastRow.t);
    const lastY = yAt(lastRow.p);

    const areaPath = new Path2D();
    areaPath.moveTo(chartStartX, firstY);
    if (firstX > chartStartX) {
      areaPath.lineTo(firstX, firstY);
    }
    rows.forEach((row, idx) => {
      const x = xAt(row.t);
      const y = yAt(row.p);
      if (idx === 0) {
        areaPath.lineTo(x, y);
      } else {
        areaPath.lineTo(x, y);
      }
    });
    if (lastX < chartEndX) {
      areaPath.lineTo(chartEndX, lastY);
    }
    areaPath.lineTo(chartEndX, pad.top + h);
    areaPath.lineTo(chartStartX, pad.top + h);
    areaPath.closePath();

    const fillGrad = ctx.createLinearGradient(0, pad.top, 0, pad.top + h);
    fillGrad.addColorStop(0, this._themeDark ? "rgba(96, 177, 235, 0.42)" : "rgba(104, 186, 237, 0.5)");
    fillGrad.addColorStop(1, this._themeDark ? "rgba(96, 177, 235, 0.12)" : "rgba(104, 186, 237, 0.18)");
    ctx.fillStyle = fillGrad;
    ctx.fill(areaPath);

    ctx.beginPath();
    ctx.moveTo(chartStartX, firstY);
    if (firstX > chartStartX) {
      ctx.lineTo(firstX, firstY);
    }
    rows.forEach((row) => {
      ctx.lineTo(xAt(row.t), yAt(row.p));
    });
    if (lastX < chartEndX) {
      ctx.lineTo(chartEndX, lastY);
    }
    ctx.strokeStyle = this._themeDark ? "#7bc4ff" : "#3aa2ef";
    ctx.lineWidth = 2;
    ctx.stroke();

    const drawVerticalSignal = (ts, pointPrice, color, label, lane = 0) => {
      if (!Number.isFinite(ts) || ts < minTs || ts > maxTs) {
        return;
      }
      const x = xAt(ts);
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + h);
      ctx.stroke();
      ctx.setLineDash([]);

      if (Number.isFinite(pointPrice)) {
        const y = yAt(pointPrice);
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      const text = String(label || "");
      if (!text) {
        return;
      }
      ctx.font = "10px Sora, Segoe UI, sans-serif";
      const tw = Math.ceil(ctx.measureText(text).width);
      const bw = tw + 10;
      const bh = 14;
      const bx = this._clamp(x - bw / 2, pad.left + 2, pad.left + w - bw - 2);
      const by = pad.top + h - 16 - lane * 16;
      ctx.fillStyle = this._themeDark ? "rgba(22, 33, 48, 0.84)" : "rgba(250, 253, 255, 0.9)";
      ctx.strokeStyle = this._themeDark ? "rgba(146, 168, 189, 0.32)" : "rgba(60, 85, 108, 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(bx, by, bw, bh, 7);
      } else {
        ctx.rect(bx, by, bw, bh);
      }
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillStyle = color;
      ctx.fillText(text, bx + bw / 2, by + 10);
    };

    const cheapColor = this._themeDark ? "rgba(46, 201, 169, 0.96)" : "rgba(15, 153, 122, 0.92)";
    const peakColor = this._themeDark ? "rgba(245, 169, 83, 0.96)" : "rgba(210, 124, 28, 0.92)";
    const nowColor = this._themeDark ? "rgba(255, 174, 174, 0.95)" : "rgba(185, 54, 54, 0.9)";
    drawVerticalSignal(priceInfo.cheapestPoint?.t, priceInfo.cheapestPoint?.p, cheapColor, "Günstig", 0);
    drawVerticalSignal(priceInfo.expensivePoint?.t, priceInfo.expensivePoint?.p, peakColor, "Peak", 1);
    drawVerticalSignal(Date.now(), null, nowColor, "Jetzt", 2);

    const hoverIdx = this._priceHoverIndex;
    if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < rows.length) {
      const row = rows[hoverIdx];
      const x = xAt(row.t);
      const y = yAt(row.p);
      ctx.strokeStyle = this._themeDark ? "rgba(164, 188, 214, 0.48)" : "rgba(39, 58, 77, 0.42)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, pad.top + h);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.fillStyle = this._themeDark ? "#9ed3ff" : "#268ddd";
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = this._themeDark ? "rgba(22, 33, 48, 0.9)" : "rgba(255, 255, 255, 0.9)";
      ctx.stroke();

      this._drawCanvasTooltip(
        ctx,
        [
          `Zeit: ${this._formatTime(row.t)}`,
          `Preis: ${this._formatPrice(row.p, unit)}`,
        ],
        x,
        y,
        cssWidth,
        cssHeight
      );
    }

    const unitLower = String(priceInfo.unit || "").toLowerCase();
    const axisUnit = unitLower === "ct/kwh" ? "ct" : "€";
    const fmtAxis = (value) => {
      if (!Number.isFinite(value)) {
        return "--";
      }
      if (axisUnit === "ct") {
        return `${value.toFixed(0)}`;
      }
      return value.toFixed(2);
    };
    const fmtAxisTime = (ts) => {
      if (!Number.isFinite(ts)) {
        return "--";
      }
      if (spanTs >= 24 * 60 * 60 * 1000) {
        const d = new Date(ts);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        return `${dd}.${mm} ${this._formatTime(ts)}`;
      }
      return this._formatTime(ts);
    };

    ctx.fillStyle = this._themeDark ? "#9eb4c8" : "#6f8090";
    ctx.font = "10px Sora, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`${fmtAxis(yMax)} ${axisUnit}`, pad.left - 4, pad.top + 10);
    ctx.fillText(`${fmtAxis(yMin)} ${axisUnit}`, pad.left - 4, pad.top + h);
    ctx.textAlign = "left";
    ctx.fillText(fmtAxisTime(minTs), pad.left, pad.top + h + 14);
    ctx.textAlign = "right";
    ctx.fillText(fmtAxisTime(maxTs), pad.left + w, pad.top + h + 14);
  }

  _weatherEntityId() {
    const configured = this._panelConfig().weather_entity;
    if (configured) {
      if (this._stateObj(configured)) {
        return configured;
      }
      if (!this._hass?.states) {
        return configured;
      }
      const idsFallback = Object.keys(this._hass.states);
      return idsFallback.find((id) => id.startsWith("weather.")) || configured;
    }
    if (!this._hass?.states) {
      this._cachedAutoWeatherEntity = null;
      return null;
    }
    if (
      this._cachedAutoWeatherEntity &&
      Object.prototype.hasOwnProperty.call(this._hass.states, this._cachedAutoWeatherEntity)
    ) {
      return this._cachedAutoWeatherEntity;
    }
    const ids = Object.keys(this._hass.states);
    const found = ids.find((id) => id.startsWith("weather.")) || null;
    this._cachedAutoWeatherEntity = found;
    return found;
  }

  _weatherData() {
    const entityId = this._weatherEntityId();
    if (!entityId) {
      return {
        icon: "mdi:weather-partly-cloudy",
        condition: "Wetter nicht eingerichtet",
        temp: "--",
      };
    }

    const weather = this._stateObj(entityId);
    if (!weather || String(weather.state || "").toLowerCase() === "unavailable") {
      return {
        icon: "mdi:weather-partly-cloudy",
        condition: "Wetter nicht verfügbar",
        temp: "--",
      };
    }

    const forecast = Array.isArray(weather.attributes?.forecast) ? weather.attributes.forecast : [];
    const firstForecast = forecast.length > 0 && forecast[0] ? forecast[0] : null;

    let conditionRaw = String(weather.state || "").toLowerCase().trim();
    if (!conditionRaw || conditionRaw === "unknown") {
      conditionRaw = String(firstForecast?.condition || "").toLowerCase().trim();
    }
    const icon = WEATHER_ICON[conditionRaw] || "mdi:weather-partly-cloudy";
    const conditionAttr = String(weather.attributes?.condition_label || "").trim();
    const condition =
      conditionAttr ||
      WEATHER_CONDITION_LABEL[conditionRaw] ||
      (conditionRaw ? conditionRaw.replace(/_/g, " ") : "Unbekannt");
    const tempAttr =
      weather.attributes?.temperature ??
      weather.attributes?.current_temperature ??
      firstForecast?.temperature ??
      null;
    const tempNum = Number(tempAttr);
    const temp = Number.isFinite(tempNum) ? `${Math.round(tempNum)}°C` : "--";

    return { icon, condition, temp };
  }

  _missingEntities(sensorMap, extraChips = []) {
    if (!this._hass) {
      return [];
    }
    const flowOpts = this._flowOptions();
    const gridMode = this._normalizeSensorMode(flowOpts.gridSensorMode);
    const batteryMode = this._normalizeSensorMode(flowOpts.batterySensorMode);
    const hasGridDual = Boolean(sensorMap.grid_import_power || sensorMap.grid_export_power);
    const signedGridConfiguredAvailable =
      sensorMap.grid_power && this._numericPowerState(sensorMap.grid_power) !== null;
    const signedGridTibberAvailable =
      this._numericPowerState(TIBBER_LIVE_GRID_SENSOR) !== null;
    const signedGridAvailable = Boolean(
      signedGridConfiguredAvailable || signedGridTibberAvailable
    );
    const hasBatteryDual = Boolean(
      sensorMap.battery_charge_power || sensorMap.battery_discharge_power
    );
    const hasBatterySigned = Boolean(
      sensorMap.battery_inverter_power || sensorMap.battery_power
    );
    const useSignedBattery = flowOpts.useSignedBatteryPower;
    const gridDualAvailable = Boolean(
      (sensorMap.grid_import_power && this._numericPowerState(sensorMap.grid_import_power) !== null) ||
        (sensorMap.grid_export_power && this._numericPowerState(sensorMap.grid_export_power) !== null)
    );
    const batterySignedAvailable = Boolean(
      (sensorMap.battery_inverter_power &&
        this._numericPowerState(sensorMap.battery_inverter_power) !== null) ||
        (sensorMap.battery_power && this._numericPowerState(sensorMap.battery_power) !== null)
    );
    const batteryDualAvailable = Boolean(
      (sensorMap.battery_charge_power && this._numericPowerState(sensorMap.battery_charge_power) !== null) ||
        (sensorMap.battery_discharge_power && this._numericPowerState(sensorMap.battery_discharge_power) !== null)
    );
    const solarAvailable = Boolean(
      sensorMap.solar_power && this._numericPowerState(sensorMap.solar_power) !== null
    );
    const canDeriveLoad =
      solarAvailable &&
      (signedGridAvailable || gridDualAvailable) &&
      (batterySignedAvailable || batteryDualAvailable);

    const missing = Object.entries(sensorMap)
      .filter(([key]) => {
        if (key === "load_power" && canDeriveLoad) {
          return false;
        }
        if (gridMode === "dual" && key === "grid_power") {
          return false;
        }
        if (key === "grid_power" && signedGridTibberAvailable) {
          return false;
        }
        if (
          gridMode === "signed" &&
          (key === "grid_import_power" || key === "grid_export_power")
        ) {
          return false;
        }

        if (batteryMode === "signed" && (key === "battery_charge_power" || key === "battery_discharge_power")) {
          return false;
        }
        if (batteryMode === "signed" && batterySignedAvailable) {
          if (key === "battery_inverter_power" || key === "battery_power") {
            return false;
          }
        }
        if (batteryMode === "dual" && (key === "battery_power" || key === "battery_inverter_power")) {
          return false;
        }

        if (
          gridMode === "auto" &&
          signedGridAvailable &&
          (key === "grid_import_power" || key === "grid_export_power")
        ) {
          return false;
        }
        if (gridMode === "auto" && !signedGridAvailable && hasGridDual && key === "grid_power") {
          return false;
        }
        if (
          batteryMode === "auto" &&
          !useSignedBattery &&
          hasBatteryDual &&
          (key === "battery_power" || key === "battery_inverter_power")
        ) {
          return false;
        }
        if (
          batteryMode === "auto" &&
          useSignedBattery &&
          (key === "battery_charge_power" || key === "battery_discharge_power")
        ) {
          return false;
        }
        if (
          batteryMode === "auto" &&
          useSignedBattery &&
          hasBatterySigned &&
          batterySignedAvailable &&
          (key === "battery_power" || key === "battery_inverter_power")
        ) {
          return false;
        }
        return true;
      })
      .filter(([, entityId]) => entityId && !this._stateObj(entityId))
      .map(([key, entityId]) => `${key}: ${entityId}`);

    extraChips.forEach((chip) => {
      if (chip?.entity && !this._stateObj(chip.entity)) {
        missing.push(`extra.${chip.key}: ${chip.entity}`);
      }
    });

    return missing;
  }

  _cableCurve(fromPos, toPos) {
    const x1 = this._clamp(fromPos?.x ?? 0, 0, 100);
    const y1 = this._clamp(fromPos?.y ?? 0, 0, 100);
    const x2 = this._clamp(toPos?.x ?? 0, 0, 100);
    const y2 = this._clamp(toPos?.y ?? 0, 0, 100);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const bend = Math.max(8, Math.min(28, Math.abs(dx) * 0.5 + Math.abs(dy) * 0.16));
    const c1x = x1 + (dx >= 0 ? bend : -bend);
    const c2x = x2 - (dx >= 0 ? bend : -bend);
    const lift = Math.max(-8, Math.min(8, dy * 0.18));
    return {
      x1,
      y1,
      c1x,
      c1y: y1 + lift,
      c2x,
      c2y: y2 - lift,
      x2,
      y2,
    };
  }

  _bezierPoint(curve, t) {
    const n = this._clamp(Number(t) || 0, 0, 1);
    const inv = 1 - n;
    const x =
      inv * inv * inv * curve.x1 +
      3 * inv * inv * n * curve.c1x +
      3 * inv * n * n * curve.c2x +
      n * n * n * curve.x2;
    const y =
      inv * inv * inv * curve.y1 +
      3 * inv * inv * n * curve.c1y +
      3 * inv * n * n * curve.c2y +
      n * n * n * curve.y2;
    return { x, y };
  }

  _bezierTangent(curve, t) {
    const n = this._clamp(Number(t) || 0, 0, 1);
    const inv = 1 - n;
    const x =
      3 * inv * inv * (curve.c1x - curve.x1) +
      6 * inv * n * (curve.c2x - curve.c1x) +
      3 * n * n * (curve.x2 - curve.c2x);
    const y =
      3 * inv * inv * (curve.c1y - curve.y1) +
      6 * inv * n * (curve.c2y - curve.c1y) +
      3 * n * n * (curve.y2 - curve.c2y);
    return { x, y };
  }

  _estimateCurveLength(curve, steps = 20) {
    if (!curve) {
      return 0;
    }
    const count = Math.max(8, Number(steps) || 20);
    let prev = this._bezierPoint(curve, 0);
    let len = 0;
    for (let i = 1; i <= count; i += 1) {
      const p = this._bezierPoint(curve, i / count);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    return len;
  }

  _cableIntensity(linkKey, power) {
    const prev = Number(this._cableIntensityState[linkKey] ?? 0);
    const p = Math.max(0, Number(power) || 0);

    let target = 0;
    if (prev > 0) {
      if (p >= CABLE_EXIT_ACTIVE_W) {
        target = (p - CABLE_EXIT_ACTIVE_W) / (CABLE_MAX_ACTIVE_W - CABLE_EXIT_ACTIVE_W);
      }
    } else if (p >= CABLE_ENTER_ACTIVE_W) {
      target = (p - CABLE_ENTER_ACTIVE_W) / (CABLE_MAX_ACTIVE_W - CABLE_ENTER_ACTIVE_W);
    }

    target = this._clamp(target, 0, 1);
    let next = target <= 0 ? 0 : this._clamp(prev + (target - prev) * 0.42, 0, 1);
    if (next < 0.02) {
      next = 0;
    }
    this._cableIntensityState[linkKey] = next;
    return next;
  }

  _buildSceneCables({ houseSources, chargeSource, gridExport, extraConsumers = [] }) {
    const links = [
      {
        key: "solar-house",
        from: "solar_power",
        to: "load_power",
        power: houseSources?.solarToHouse ?? 0,
        color: "#2cc6a5",
      },
      {
        key: "solar-battery",
        from: "solar_power",
        to: "battery_power",
        power: chargeSource?.solarPart ?? 0,
        color: "#34d399",
      },
      {
        key: "grid-house",
        from: "grid_power",
        to: "load_power",
        power: houseSources?.gridToHouse ?? 0,
        color: "#92a0b5",
      },
      {
        key: "grid-battery",
        from: "grid_power",
        to: "battery_power",
        power: chargeSource?.gridPart ?? 0,
        color: "#9db3ff",
      },
      {
        key: "battery-house",
        from: "battery_power",
        to: "load_power",
        power: houseSources?.batteryToHouse ?? 0,
        color: "#4f8dff",
      },
      {
        key: "house-grid-export",
        from: "load_power",
        to: "grid_power",
        power: gridExport ?? 0,
        color: "#7cc3f8",
      },
    ];

    extraConsumers.forEach((consumer) => {
      if (!consumer?.key) {
        return;
      }
      links.push({
        key: `load-extra-${consumer.key}`,
        from: "load_power",
        to: consumer.key,
        power: consumer.power ?? 0,
        color: consumer.color || "#9b7de3",
      });
    });

    const activeLinkKeys = new Set(links.map((link) => link.key));
    Object.keys(this._cableIntensityState).forEach((key) => {
      if (!activeLinkKeys.has(key)) {
        delete this._cableIntensityState[key];
      }
    });

    return links
      .map((link) => {
        const fromPos = this._positions?.[link.from];
        const toPos = this._positions?.[link.to];
        if (!fromPos || !toPos) {
          return null;
        }
        const intensity = this._cableIntensity(link.key, link.power);
        if (intensity <= 0) {
          return null;
        }
        const curve = this._cableCurve(fromPos, toPos);
        const bandWidth = CABLE_WIDTH_MIN + intensity * (CABLE_WIDTH_MAX - CABLE_WIDTH_MIN);
        const opacity = 0.36 + intensity * 0.58;
        const flowSpeed = 0.85 + (1 - intensity) * 1.1;
        const length = this._estimateCurveLength(curve);
        const arrowCount = Math.max(
          1,
          Math.min(5, Math.round((length / 22) * (0.55 + intensity)))
        );
        return {
          key: link.key,
          curve,
          color: link.color,
          power: Math.max(0, Number(link.power) || 0),
          label: this._formatPower(link.power),
          bandWidth,
          opacity: this._clamp(opacity, 0.2, 0.98),
          intensity,
          flowSpeed,
          arrowCount,
        };
      })
      .filter(Boolean);
  }

  _flowCurvePath(ctx, curve, width, height) {
    const x1 = (curve.x1 / 100) * width;
    const y1 = (curve.y1 / 100) * height;
    const c1x = (curve.c1x / 100) * width;
    const c1y = (curve.c1y / 100) * height;
    const c2x = (curve.c2x / 100) * width;
    const c2y = (curve.c2y / 100) * height;
    const x2 = (curve.x2 / 100) * width;
    const y2 = (curve.y2 / 100) * height;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
  }

  _drawRoundedRect(ctx, x, y, w, h, radius) {
    const r = this._clamp(radius, 0, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _drawFlowArrowHead(ctx, x, y, dx, dy, size) {
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const spread = size * 0.55;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - ux * size + nx * spread, y - uy * size + ny * spread);
    ctx.lineTo(x - ux * size - nx * spread, y - uy * size - ny * spread);
    ctx.closePath();
    ctx.fill();
  }

  _drawFlowBand(ctx, cable, width, height, scale) {
    const bandWidth = Math.max(1.1, cable.bandWidth * scale);
    this._flowCurvePath(ctx, cable.curve, width, height);
    ctx.save();
    ctx.strokeStyle = "#bfd0e0";
    ctx.globalAlpha = 0.18 + cable.intensity * 0.12;
    ctx.lineWidth = bandWidth + 1.25;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ctx.restore();

    this._flowCurvePath(ctx, cable.curve, width, height);
    ctx.save();
    ctx.strokeStyle = cable.color || "#7cc3f8";
    ctx.globalAlpha = cable.opacity;
    ctx.lineWidth = bandWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = Math.min(16, bandWidth * 2.1);
    ctx.shadowColor = cable.color || "#7cc3f8";
    ctx.stroke();
    ctx.restore();
  }

  _drawFlowLabel(ctx, cable, width, height, scale) {
    if ((cable.power ?? 0) < FLOW_LABEL_MIN_POWER_W) {
      return;
    }
    const t = 0.53;
    const p = this._bezierPoint(cable.curve, t);
    const tan = this._bezierTangent(cable.curve, t);
    const tx = (tan.x / 100) * width;
    const ty = (tan.y / 100) * height;
    const norm = Math.hypot(tx, ty) || 1;
    const nx = -ty / norm;
    const ny = tx / norm;
    const offset = Math.max(9, Math.min(20, 7 + cable.bandWidth * scale * 2.4));
    const cx = (p.x / 100) * width + nx * offset;
    const cy = (p.y / 100) * height + ny * offset;
    const text = cable.label || this._formatPower(cable.power);
    const fontSize = this._clamp(9.5 + cable.intensity * 2.4, 9.5, 13.5);

    ctx.save();
    ctx.font = `700 ${fontSize}px "Sora", "Avenir Next", "Segoe UI", sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const padX = 7;
    const padY = 4;
    const boxW = textWidth + padX * 2;
    const boxH = fontSize + padY * 2 - 1;
    const boxX = this._clamp(cx - boxW / 2, 4, width - boxW - 4);
    const boxY = this._clamp(cy - boxH / 2, 4, height - boxH - 4);

    this._drawRoundedRect(ctx, boxX, boxY, boxW, boxH, boxH / 2);
    ctx.fillStyle = "rgba(13, 28, 43, 0.63)";
    ctx.fill();

    this._drawRoundedRect(ctx, boxX, boxY, boxW, boxH, boxH / 2);
    ctx.strokeStyle = cable.color || "#7cc3f8";
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#f4fbff";
    ctx.textBaseline = "middle";
    ctx.fillText(text, boxX + padX, boxY + boxH / 2 + 0.5);
    ctx.restore();
  }

  _drawFlowArrows(ctx, cable, width, height, scale) {
    if (!cable.curve) {
      return false;
    }
    const count = Math.max(1, Number(cable.arrowCount) || 1);
    const speed = Math.max(0.35, Number(cable.flowSpeed) || 1);
    const phase = this._flowReducedMotion ? 0.42 : (this._flowPhase / speed) % 1;
    const arrowSize = this._clamp((0.7 + cable.intensity * 1.8) * scale, 3, 9);

    ctx.save();
    ctx.fillStyle = cable.color || "#7cc3f8";
    ctx.globalAlpha = this._flowReducedMotion ? 0.72 : Math.max(0.45, cable.opacity);
    for (let i = 0; i < count; i += 1) {
      const offset = (i + 1) / (count + 1);
      const t = this._flowReducedMotion ? offset : (offset + phase) % 1;
      const p = this._bezierPoint(cable.curve, t);
      const tan = this._bezierTangent(cable.curve, t);
      this._drawFlowArrowHead(
        ctx,
        (p.x / 100) * width,
        (p.y / 100) * height,
        (tan.x / 100) * width,
        (tan.y / 100) * height,
        arrowSize
      );
    }
    ctx.restore();
    return !this._flowReducedMotion && cable.intensity > 0.02;
  }

  _resizeFlowCanvas() {
    if (!this._flowCanvas || !this._flowCtx) {
      return { width: 0, height: 0 };
    }
    const rect = this._flowCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return { width: 0, height: 0 };
    }
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const targetW = Math.max(1, Math.round(rect.width * dpr));
    const targetH = Math.max(1, Math.round(rect.height * dpr));
    if (this._flowCanvas.width !== targetW || this._flowCanvas.height !== targetH) {
      this._flowCanvas.width = targetW;
      this._flowCanvas.height = targetH;
    }
    this._flowCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  _drawFlowFrame(ts) {
    if (!this._flowCanvas || !this._flowCtx) {
      return false;
    }
    const { width, height } = this._resizeFlowCanvas();
    if (!width || !height) {
      return false;
    }

    const cables = Array.isArray(this._flowModel) ? this._flowModel : [];
    this._flowCtx.clearRect(0, 0, width, height);
    if (cables.length === 0) {
      return false;
    }

    const dt = this._flowLastTs ? this._clamp(ts - this._flowLastTs, 8, 80) : 16;
    this._flowLastTs = ts;
    if (!this._flowReducedMotion) {
      this._flowPhase = (this._flowPhase + dt * 0.001) % 1024;
    }

    const scale = Math.min(width, height) / 100;
    let animateNext = false;
    cables.forEach((cable) => {
      this._drawFlowBand(this._flowCtx, cable, width, height, scale);
      this._drawFlowLabel(this._flowCtx, cable, width, height, scale);
      animateNext = this._drawFlowArrows(this._flowCtx, cable, width, height, scale) || animateNext;
    });

    return animateNext;
  }

  _runFlowFrame(ts) {
    this._flowFrame = 0;
    const keepRunning = this._drawFlowFrame(ts);
    if (keepRunning) {
      this._flowFrame = window.requestAnimationFrame((nextTs) => this._runFlowFrame(nextTs));
    }
  }

  _startFlowLoop(force = false) {
    if (!this._flowCanvas || !this._flowCtx) {
      return;
    }
    if (force) {
      this._flowLastTs = 0;
    }
    if (this._flowFrame) {
      return;
    }
    this._flowFrame = window.requestAnimationFrame((ts) => this._runFlowFrame(ts));
  }

  _syncFlowCanvas(sceneCables) {
    const canvas = this.shadowRoot?.querySelector("#scene-flow-canvas");
    if (!canvas) {
      if (this._flowFrame) {
        window.cancelAnimationFrame(this._flowFrame);
        this._flowFrame = 0;
      }
      this._flowCanvas = null;
      this._flowCtx = null;
      this._flowModel = [];
      return;
    }
    if (canvas !== this._flowCanvas) {
      if (this._flowResizeObserver) {
        this._flowResizeObserver.disconnect();
        this._flowResizeObserver = null;
      }
      this._flowCanvas = canvas;
      this._flowCtx = canvas.getContext("2d");
      if (!this._flowCtx) {
        this._flowModel = [];
        return;
      }
      if (typeof ResizeObserver !== "undefined") {
        this._flowResizeObserver = new ResizeObserver(() => this._startFlowLoop(true));
        this._flowResizeObserver.observe(canvas);
      }
    }
    this._flowModel = Array.isArray(sceneCables) ? sceneCables : [];
    this._startFlowLoop(true);
  }

  _chipHTML(
    key,
    label,
    value,
    pos,
    accent = "aqua",
    metaValue = null,
    metaLabel = "",
    inlineMeta = false
  ) {
    const hasMeta = !(metaValue === null || metaValue === undefined);
    const meta = hasMeta
      ? `<div class="meta"><span class="meta-v" data-bind="chip-${key}-meta-v">${metaValue}</span>${
          metaLabel ? `<span class="meta-l">${metaLabel}</span>` : ""
        }</div>`
      : "";
    const compactMain = hasMeta && inlineMeta
      ? `<div class="main-inline">
          <span class="value" data-bind="chip-${key}-value">${value}</span>
          <span class="meta-inline">
            <span class="meta-v" data-bind="chip-${key}-meta-v">${metaValue}</span>
            ${metaLabel ? `<span class="meta-l">${metaLabel}</span>` : ""}
          </span>
        </div>`
      : `<div class="value" data-bind="chip-${key}-value">${value}</div>${meta}`;
    const compactClass = inlineMeta ? "compact" : "";
    return `
      <div
        class="chip ${accent} ${compactClass} ${this._editMode ? "editable" : "clickable"}"
        data-key="${key}"
        style="left:${pos.x}%; top:${pos.y}%;"
      >
        ${compactMain}
        <div class="label">${label}</div>
      </div>
    `;
  }

  _setBoundText(bindKey, value) {
    const el = this.shadowRoot?.querySelector(`[data-bind="${bindKey}"]`);
    if (!el) {
      return;
    }
    const text = value === null || value === undefined ? "--" : String(value);
    if (el.textContent !== text) {
      el.textContent = text;
    }
  }

  _setBoundWidth(bindKey, pct) {
    const el = this.shadowRoot?.querySelector(`[data-bind="${bindKey}"]`);
    if (!el) {
      return;
    }
    const width = `${this._clamp(Number(pct) || 0, 0, 100).toFixed(1)}%`;
    if (el.style.width !== width) {
      el.style.width = width;
    }
  }

  _setBoundIcon(bindKey, icon) {
    const el = this.shadowRoot?.querySelector(`[data-bind="${bindKey}"]`);
    if (!el || !icon) {
      return;
    }
    if (el.getAttribute("icon") !== icon) {
      el.setAttribute("icon", icon);
    }
  }

  _updateChipValue(key, value, metaValue = null) {
    this._setBoundText(`chip-${key}-value`, value);
    if (metaValue !== null && metaValue !== undefined) {
      this._setBoundText(`chip-${key}-meta-v`, metaValue);
    }
  }

  _updateLiveView(model) {
    const {
      weather,
      solar,
      grid,
      battery,
      soc,
      houseLoad,
      extraChips,
      sceneCables,
      gridImport,
      gridExport,
      autarky,
      loadTotal,
      loadToBattery,
      batteryDischarge,
      houseSources,
      chargeSource,
      gridProjection,
      batteryRuntime,
      batteryChargeEta,
      priceInfo,
      balanceError,
      balanceQuality,
      backfillPendingText,
    } = model;

    this._setBoundIcon("weather-icon", weather.icon);
    this._setBoundText("weather-temp", weather.temp);
    this._setBoundText("weather-cond", weather.condition);

    this._updateChipValue("solar_power", this._formatPower(solar));
    this._updateChipValue("grid_power", this._formatPower(grid));
    this._updateChipValue("battery_power", this._formatPower(battery), this._formatPercent(soc));
    this._updateChipValue("load_power", this._formatPower(houseLoad));
    extraChips.forEach((chip) => {
      this._updateChipValue(chip.key, this._formatPower(chip.power));
    });

    this._syncFlowCanvas(sceneCables);

    this._setBoundText("grid-status", this._gridStatus(grid));
    this._setBoundText("grid-proj-main", gridProjection.main);
    this._setBoundText("grid-proj-detail", gridProjection.detail);
    this._setBoundText("battery-status", this._batteryStatus(battery));
    this._setBoundText("battery-runtime", batteryRuntime.label);
    this._setBoundText("battery-runtime-detail", batteryRuntime.detail);
    this._setBoundText("charge-label", chargeSource.label);
    this._setBoundText("charge-detail", chargeSource.detail);
    this._setBoundText("charge-runtime", batteryChargeEta.label);
    this._setBoundText("charge-runtime-detail", batteryChargeEta.detail);

    this._setBoundText("stat-grid-import", this._formatPower(gridImport));
    this._setBoundText("stat-grid-export", this._formatPower(gridExport));
    this._setBoundText("stat-autarky", this._formatPercent(autarky));
    this._setBoundText("stat-load-total", this._formatPower(loadTotal));
    this._setBoundText(
      "stat-load-battery",
      this._formatBatteryTwoWay(loadToBattery, batteryDischarge)
    );
    this._setBoundText("stat-house-net", this._formatPower(houseLoad));

    this._setBoundWidth("source-solar-width", houseSources.solarPct);
    this._setBoundWidth("source-battery-width", houseSources.batteryPct);
    this._setBoundWidth("source-grid-width", houseSources.gridPct);
    this._setBoundText("source-solar-value", this._formatPower(houseSources.solarToHouse));
    this._setBoundText("source-battery-value", this._formatPower(houseSources.batteryToHouse));
    this._setBoundText("source-grid-value", this._formatPower(houseSources.gridToHouse));
    this._setBoundText("diag-balance-error", this._formatPower(balanceError));
    this._setBoundText("diag-balance-quality", this._formatPercent(balanceQuality));
    this._setBoundText("diag-backfill-pending", backfillPendingText);
    this._setBoundText("kpi-backfill-pending", backfillPendingText);

    const priceBadge = this.shadowRoot?.querySelector("[data-bind='price-badge']");
    if (priceBadge) {
      priceBadge.className = `price-badge ${
        priceInfo.mode === "cheap" ? "cheap" : priceInfo.mode === "expensive" ? "expensive" : ""
      }`;
      priceBadge.textContent = priceInfo.available ? priceInfo.action : "Nicht verfügbar";
    }
    this._setBoundText(
      "price-main",
      priceInfo.available ? this._formatPrice(priceInfo.nowPrice, priceInfo.unit) : "Kein Preis verfügbar"
    );
    this._setBoundText("price-source", priceInfo.available ? priceInfo.sourceText : "--");
    const trendMix = this._trendMixSummary(this._trendData);
    this._setBoundText(
      "trend-mix-solar",
      trendMix.available
        ? `${this._formatEnergyKwh(trendMix.solarKwh)} · ${trendMix.solarPct.toFixed(0)} %`
        : "--"
    );
    this._setBoundText(
      "trend-mix-battery",
      trendMix.available
        ? `${this._formatEnergyKwh(trendMix.batteryKwh)} · ${trendMix.batteryPct.toFixed(0)} %`
        : "--"
    );
    this._setBoundText(
      "trend-mix-grid",
      trendMix.available
        ? `${this._formatEnergyKwh(trendMix.gridKwh)} · ${trendMix.gridPct.toFixed(0)} %`
        : "--"
    );
    this._setBoundText("trend-mix-autarky", trendMix.available ? this._formatPercent(trendMix.autarkyPct) : "--");
    this._setBoundText(
      "trend-mix-produced",
      trendMix.available ? this._formatEnergyKwh(trendMix.solarProducedKwh) : "--"
    );
    this._setBoundText(
      "trend-mix-grid-total",
      trendMix.available ? this._formatEnergyKwh(trendMix.gridImportAccountedKwh) : "--"
    );
    this._setBoundText(
      "trend-mix-grid-battery",
      trendMix.available ? this._formatEnergyKwh(trendMix.gridToBatteryKwh) : "--"
    );
    this._setBoundText(
      "trend-mix-grid-sensor",
      trendMix.available ? this._formatEnergyKwh(trendMix.gridImportTotalKwh) : "--"
    );
    this._setBoundText(
      "trend-mix-grid-diff",
      trendMix.available ? `${trendMix.gridImportDiffKwh >= 0 ? "+" : "-"}${this._formatEnergyKwh(Math.abs(trendMix.gridImportDiffKwh))}` : "--"
    );
    this._drawTrendMixChart();
    this._drawPriceChart();
    if (this._detailOpen) {
      this._drawDetailChart();
    }
  }

  _bindInteractions() {
    const toggleBtn = this.shadowRoot.querySelector("[data-action='toggle-edit']");
    const resetBtn = this.shadowRoot.querySelector("[data-action='reset-layout']");
    const themeToggle = this.shadowRoot.querySelector("[data-action='toggle-theme']");
    const openSettingsBtn = this.shadowRoot.querySelector("[data-action='open-settings']");
    const openReportBtn = this.shadowRoot.querySelector("[data-action='open-report']");
    const settingsOverlay = this.shadowRoot.querySelector("[data-action='close-settings-overlay']");
    const closeSettingsBtns = this.shadowRoot.querySelectorAll("[data-action='close-settings']");
    const saveSettingsBtn = this.shadowRoot.querySelector("[data-action='save-settings']");
    const resetSettingsBtn = this.shadowRoot.querySelector("[data-action='reset-settings-yaml']");
    const reportOverlay = this.shadowRoot.querySelector("[data-action='close-report-overlay']");
    const closeReportBtns = this.shadowRoot.querySelectorAll("[data-action='close-report']");
    const reportRefreshBtn = this.shadowRoot.querySelector("[data-action='report-refresh']");
    const reportExportCsvBtn = this.shadowRoot.querySelector("[data-action='report-export-csv']");
    const reportExportPdfBtn = this.shadowRoot.querySelector("[data-action='report-export-pdf']");
    const detailOverlay = this.shadowRoot.querySelector("[data-action='close-detail-overlay']");
    const closeDetailBtns = this.shadowRoot.querySelectorAll("[data-action='close-detail']");

    toggleBtn?.addEventListener("click", () => {
      this._editMode = !this._editMode;
      if (!this._editMode) {
        this._savePositions();
      }
      this._requestRender({ immediate: true, full: true });
    });

    resetBtn?.addEventListener("click", () => {
      this._resetPositions();
    });

    themeToggle?.addEventListener("change", (ev) => {
      this._setThemeDark(Boolean(ev?.target?.checked));
    });

    openSettingsBtn?.addEventListener("click", () => {
      this._openSettingsEditor();
    });
    openReportBtn?.addEventListener("click", () => {
      this._openReportDialog();
    });
    settingsOverlay?.addEventListener("click", (ev) => {
      if (ev.target === settingsOverlay) {
        this._closeSettingsEditor();
      }
    });
    closeSettingsBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        this._closeSettingsEditor();
      })
    );
    saveSettingsBtn?.addEventListener("click", () => {
      void this._saveSettingsFromForm();
    });
    resetSettingsBtn?.addEventListener("click", () => {
      void this._resetSettingsToYamlFallback();
    });
    reportOverlay?.addEventListener("click", (ev) => {
      if (ev.target === reportOverlay) {
        this._closeReportDialog();
      }
    });
    closeReportBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        this._closeReportDialog();
      })
    );
    this.shadowRoot.querySelectorAll("[data-action='report-period']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const period = btn.getAttribute("data-period");
        if (period) {
          this._setReportPeriod(period);
        }
      });
    });
    reportRefreshBtn?.addEventListener("click", () => {
      void this._loadReportData(this._reportPeriod, true);
    });
    reportExportCsvBtn?.addEventListener("click", () => {
      this._exportReportCsv();
    });
    reportExportPdfBtn?.addEventListener("click", () => {
      this._exportReportPdf();
    });
    detailOverlay?.addEventListener("click", (ev) => {
      if (ev.target === detailOverlay) {
        this._closeDetailView();
      }
    });
    closeDetailBtns.forEach((btn) =>
      btn.addEventListener("click", () => {
        this._closeDetailView();
      })
    );

    this.shadowRoot.querySelectorAll("[data-action='trend-range']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const range = btn.getAttribute("data-range");
        if (range) {
          this._setTrendRange(range);
        }
      });
    });

    this.shadowRoot.querySelectorAll("[data-action='trend-mode']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-mode");
        if (mode) {
          this._setTrendChartMode(mode);
        }
      });
    });

    this.shadowRoot.querySelectorAll("[data-action='trend-value-mode']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const mode = btn.getAttribute("data-value-mode");
        if (mode) {
          this._setTrendValueMode(mode);
        }
      });
    });

    this.shadowRoot.querySelectorAll(".chip[data-key]").forEach((chip) => {
      const key = chip.dataset.key;
      if (!key) {
        return;
      }
      if (this._editMode) {
        chip.addEventListener("pointerdown", (ev) => {
          ev.preventDefault();
          this._drag = { key };
          chip.setPointerCapture?.(ev.pointerId);
        });
        return;
      }
      chip.addEventListener("click", (ev) => {
        ev.preventDefault();
        this._openDetailView(key);
      });
    });
  }

  _updateDraggedChipPosition(key, x, y) {
    const chip = this.shadowRoot.querySelector(`.chip[data-key="${key}"]`);
    if (!chip) {
      return;
    }
    chip.style.left = `${x}%`;
    chip.style.top = `${y}%`;
  }

  _handlePointerMove(ev) {
    if (!this._editMode || !this._drag || !this.shadowRoot) {
      return;
    }
    const stage = this.shadowRoot.querySelector("#scene-stage");
    if (!stage) {
      return;
    }
    ev.preventDefault();
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }
    const x = this._clamp(((ev.clientX - rect.left) / rect.width) * 100, 4, 96);
    const y = this._clamp(((ev.clientY - rect.top) / rect.height) * 100, 6, 94);
    this._positions[this._drag.key] = { x, y };
    this._updateDraggedChipPosition(this._drag.key, x, y);
  }

  _handlePointerUp() {
    if (!this._drag) {
      return;
    }
    this._drag = null;
    this._savePositions();
    this._requestRender({ immediate: true });
  }

  _render(fullRender = false) {
    if (!this.shadowRoot) {
      return;
    }
    if (!this._hass) {
      this._hasRenderedTemplate = false;
      this.shadowRoot.innerHTML = `
        <style>
          .loading {
            padding: 24px;
            color: var(--secondary-text-color);
            font: 600 16px/1.5 "Sora", "Segoe UI", sans-serif;
          }
        </style>
        <div class="loading">Panel wird geladen...</div>
      `;
      return;
    }

    this._ensurePositions();
    this._ensureThemePreference();
    this._ensureTrendChartMode();
    this._ensureTrendValueMode();

    const cfg = this._panelConfig();
    const standardChipColors = this._normalizeStandardChipColors(
      cfg.standard_chip_colors
    );
    const sensors = this._sensors();
    const priceSensors = this._priceSensors();
    const weather = this._weatherData();
    const bgImage = cfg.background_image || "";
    const flowOpts = this._flowOptions();

    const solar = this._numericPowerState(sensors.solar_power);
    const gridFlow = this._resolveGridFlow(sensors);
    const batteryFlow = this._resolveBatteryFlow(sensors, flowOpts);
    const batteryDcFlow = this._resolveBatteryDcFlow(sensors, flowOpts);
    const loadTotal = this._resolveLoadPower(sensors.load_power, flowOpts, {
      solarPower: solar,
      gridSignedPower: gridFlow.signed,
      batteryDischargePower: batteryFlow.dischargePower,
    });
    const grid = gridFlow.signed;
    const battery = batteryFlow.signed;
    const soc = this._numericState(sensors.battery_soc);
    const gridImport = gridFlow.importPower;
    const gridExport = gridFlow.exportPower;
    const batteryCharge = batteryFlow.chargePower;
    const batteryDischarge = batteryFlow.dischargePower;
    const batteryRuntime = this._batteryRuntimeEstimate({
      sensors,
      soc,
      batteryDischarge:
        batteryDcFlow.dischargePower !== null ? batteryDcFlow.dischargePower : batteryDischarge,
    });
    const batteryChargeEta = this._batteryChargeEstimate({
      sensors,
      soc,
      batteryCharge: batteryDcFlow.chargePower !== null ? batteryDcFlow.chargePower : batteryCharge,
    });
    const extraChips = this._extraChips().map((chip) => {
      const raw = this._numericPowerState(chip.entity);
      const power = raw === null ? null : Math.max(0, raw);
      return {
        ...chip,
        power,
        cableColor: CHIP_CABLE_COLORS[chip.accent] || "#9b7de3",
      };
    });
    const extraConsumers = extraChips
      .filter((chip) => chip.power !== null && chip.power > 0)
      .map((chip) => ({
        key: chip.key,
        power: chip.power,
        color: chip.cableColor,
      }));
    if (this._detailOpen && this._detailKey && !this._detailConfigForKey(this._detailKey, extraChips)) {
      this._detailOpen = false;
      this._detailKey = null;
      this._detailHoverIndex = null;
    }
    const loadToBattery = batteryCharge;
    const houseLoad =
      loadTotal === null ? null : Math.max(0, loadTotal - (loadToBattery ?? 0));
    const autarky = this._autarky(houseLoad, grid);
    const chargeSource = this._batteryChargeSource({
      solarPower: solar,
      houseLoad,
      batteryCharge,
      gridImport,
    });
    const houseSources = this._houseSourceBreakdown({
      houseLoad,
      solarPower: solar,
      batteryDischarge,
      gridImport,
    });
    const gridProjection = this._gridProjectionSummary({
      houseLoad,
      gridImport,
      houseSources,
    });
    const sceneCables = this._buildSceneCables({
      houseSources,
      chargeSource,
      gridExport,
      extraConsumers,
    });
    const priceInfo = this._priceInsight();
    const missing = this._missingEntities(sensors, extraChips);

    const layoutClass = this._narrow ? "narrow" : "wide";
    const trendRenewDay = this._trendData?.renewableShareDay ?? null;
    const trendAutarkyDay = this._trendData?.avgAutarkyDay ?? null;
    const trendSavedSolar = this._trendData?.savedSolarDirectEur ?? null;
    const trendSavedNonGrid = this._trendData?.savedNonGridEur ?? null;
    const trendBatteryArbitrage = this._trendData?.batteryArbitrageEur ?? null;
    const trendSmartSavings = this._trendData?.smartSavingsEur ?? null;
    const trendBatteryArbitrageKwh = this._trendData?.batteryArbitrageKwh ?? null;
    const lifeSmart = this._numericState(LIFETIME_SENSORS.smart);
    const lifeSolar = this._numericState(LIFETIME_SENSORS.solar);
    const lifeNonGrid = this._numericState(LIFETIME_SENSORS.non_grid);
    const lifeArbitrage = this._numericState(LIFETIME_SENSORS.arbitrage);
    const lifeShiftKwh = this._numericState(LIFETIME_SENSORS.shift_kwh);
    const balanceError = this._numericState(DIAG_SENSORS.balance_error);
    const balanceQuality = this._numericState(DIAG_SENSORS.balance_quality);
    const backfillPending = this._numericState(DIAG_SENSORS.backfill_pending);
    const backfillPendingText =
      backfillPending === null ? "--" : `${Math.max(0, Math.round(backfillPending))} h`;
    const trendLabel = this._trendData?.rangeLabel || this._trendWindow().label;
    const rangeToday = this._trendRange === TREND_RANGES.today.key;
    const range24h = this._trendRange === TREND_RANGES.day24.key;
    const range7d = this._trendRange === TREND_RANGES.week7.key;
    const rangeMonth = this._trendRange === TREND_RANGES.month.key;
    const rangeTotal = this._trendRange === TREND_RANGES.total.key;
    const trendModeLine = this._trendChartMode === TREND_CHART_MODES.line;
    const trendModeBars = this._trendChartMode === TREND_CHART_MODES.bars;
    const trendValueKw = this._trendValueMode === TREND_VALUE_MODES.kw;
    const trendValueKwh = this._trendValueMode === TREND_VALUE_MODES.kwh;
    const compactLabels = this._narrow;
    const rangeLabelToday = compactLabels ? "H" : "Heute";
    const rangeLabel24h = "24h";
    const rangeLabel7d = compactLabels ? "7T" : "7 Tage";
    const rangeLabelMonth = compactLabels ? "Mon" : "Monat";
    const rangeLabelTotal = compactLabels ? "Ges" : "Gesamt";
    const modeLabelLine = compactLabels ? "Lin" : "Linie";
    const modeLabelBars = compactLabels ? "Bar" : "Balken";
    const legendLabelLoad = compactLabels ? "L" : "Last";
    const legendLabelRenew = compactLabels ? "PV" : "Solar";
    const legendLabelBattery = compactLabels ? "Bat" : "Akku";
    const legendLabelAutarky = compactLabels ? "Aut" : "Aut.";
    const trendMix = this._trendMixSummary(this._trendData);
    const themeDark = this._themeDark;
    const settingsDraft = this._settingsDraft || this._settingsDraftFromConfig(cfg);
    const settingsOptions = this._settingsOpen
      ? {
          sensorOptions: this._entityDatalistOptions("sensor."),
          weatherOptions: this._entityDatalistOptions("weather."),
          entityOptions: this._entityDatalistOptions(""),
        }
      : { sensorOptions: "", weatherOptions: "", entityOptions: "" };

    const liveModel = {
      weather,
      solar,
      grid,
      battery,
      soc,
      houseLoad,
      extraChips,
      sceneCables,
      gridImport,
      gridExport,
      autarky,
      loadTotal,
      loadToBattery,
      batteryDischarge,
      houseSources,
      chargeSource,
      gridProjection,
      batteryRuntime,
      batteryChargeEta,
      priceInfo,
      balanceError,
      balanceQuality,
      backfillPendingText,
    };

    this._fetchTrendIfNeeded(sensors);
    if (this._hasRenderedTemplate && !fullRender) {
      this._updateLiveView(liveModel);
      return;
    }

    const sceneImageUrl = bgImage ? String(bgImage).replace(/'/g, "\\'") : "";
    const sceneBackground = bgImage
      ? themeDark
        ? `linear-gradient(180deg, rgba(3, 9, 17, 0.46), rgba(3, 9, 17, 0.68)), url('${sceneImageUrl}') center/cover no-repeat, linear-gradient(165deg, #162131 0%, #121c2a 55%, #0d1723 100%)`
        : `linear-gradient(180deg, rgba(13, 27, 44, 0.08), rgba(13, 27, 44, 0.22)), url('${sceneImageUrl}') center/cover no-repeat, linear-gradient(165deg, #edf7ff 0%, #dfeaf5 55%, #d3dde7 100%)`
      : themeDark
        ? "linear-gradient(165deg, #162131 0%, #121c2a 55%, #0d1723 100%)"
        : "linear-gradient(165deg, #edf7ff 0%, #dfeaf5 55%, #d3dde7 100%)";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          max-width: none;
          height: 100%;
          --ed-bg:
            radial-gradient(circle at 10% -6%, rgba(245, 252, 255, 0.9) 0 32%, rgba(245, 252, 255, 0) 33%),
            linear-gradient(180deg, #e8f3fc 0%, #dfebf5 52%, #d4e0ea 100%);
          --ed-text: #172330;
          --ed-muted: #5e7286;
          --ed-card: rgba(255, 255, 255, 0.76);
          --ed-border: rgba(23, 44, 62, 0.14);
          --ed-shadow: 0 16px 36px rgba(18, 42, 60, 0.14);
          --ed-chip-shadow: 0 12px 28px rgba(14, 34, 48, 0.28);
          --ed-action: #27bca4;
        }

        * { box-sizing: border-box; }

        .panel {
          min-height: 100%;
          width: 100%;
          margin: 0;
          padding: 14px;
          background: var(--ed-bg);
          color: var(--ed-text);
          font-family: "Sora", "Avenir Next", "Segoe UI", sans-serif;
          position: relative;
          isolation: isolate;
          display: block;
        }

        .panel.theme-dark {
          --ed-bg:
            radial-gradient(circle at 14% -8%, rgba(76, 98, 120, 0.24) 0 26%, rgba(10, 18, 29, 0) 27%),
            linear-gradient(180deg, #162232 0%, #121c2a 55%, #0d1621 100%);
          --ed-text: #e7f1fa;
          --ed-muted: #9eb4c8;
          --ed-card: rgba(19, 29, 43, 0.76);
          --ed-border: rgba(149, 171, 193, 0.22);
          --ed-shadow: 0 16px 36px rgba(0, 0, 0, 0.38);
          --ed-chip-shadow: 0 14px 30px rgba(0, 0, 0, 0.45);
          --ed-action: #27bca4;
        }

        .panel.theme-dark .weather {
          background: linear-gradient(180deg, rgba(24, 36, 52, 0.92), rgba(17, 27, 40, 0.84));
          border-color: rgba(152, 174, 196, 0.26);
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.33);
        }

        .panel.theme-dark .scene-wrap,
        .panel.theme-dark .card,
        .panel.theme-dark .stats,
        .panel.theme-dark .trend-wrap,
        .panel.theme-dark .source-wrap,
        .panel.theme-dark .price-wrap,
        .panel.theme-dark details.map {
          border-color: rgba(149, 171, 193, 0.22);
          background: linear-gradient(180deg, rgba(21, 31, 46, 0.86), rgba(15, 24, 36, 0.78));
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.34);
        }

        .panel.theme-dark .stats .s {
          border-right-color: rgba(151, 173, 195, 0.14);
        }

        .panel.theme-dark .card .k.icon-label ha-icon,
        .panel.theme-dark .kpi-strip .k ha-icon,
        .panel.theme-dark .stats .k ha-icon {
          border-color: rgba(149, 171, 193, 0.3);
          background: rgba(24, 37, 52, 0.76);
          color: #9eb4c8;
        }

        .panel.theme-dark .btn {
          border-color: rgba(147, 169, 189, 0.26);
          background: rgba(26, 38, 53, 0.9);
          color: #dceaf7;
        }

        .panel.theme-dark .btn.primary {
          border-color: rgba(27, 178, 149, 0.42);
          background: linear-gradient(180deg, rgba(24, 109, 97, 0.78), rgba(17, 84, 76, 0.82));
          color: #d8fff8;
        }

        .panel.theme-dark .btn.ghost {
          background: rgba(26, 38, 53, 0.72);
        }

        .panel.theme-dark .trend-controls {
          background: rgba(24, 37, 52, 0.9);
          border-color: rgba(149, 171, 193, 0.24);
        }

        .panel.theme-dark .trend-mix-panel,
        .panel.theme-dark .trend-energy-main,
        .panel.theme-dark .savings-main {
          border-color: rgba(149, 171, 193, 0.24);
          background: rgba(21, 33, 48, 0.58);
        }

        .panel.theme-dark .range-btn {
          color: #9eb4c8;
        }

        .panel.theme-dark .price-badge {
          border-color: rgba(151, 173, 194, 0.24);
          background: rgba(24, 37, 52, 0.9);
          color: #a8bdd1;
        }

        .panel.theme-dark .price-chart-wrap {
          border-color: rgba(149, 171, 193, 0.24);
          background: rgba(21, 33, 48, 0.78);
        }

        .panel.theme-dark .source-track {
          background: rgba(149, 171, 193, 0.2);
        }

        .panel.theme-dark .scene {
          border-color: rgba(149, 171, 193, 0.26);
        }

        .panel.theme-dark .scene::before {
          background:
            radial-gradient(circle at 18% 10%, rgba(255,255,255,0.16) 0 36px, transparent 37px),
            radial-gradient(circle at 30% 9%, rgba(255,255,255,0.1) 0 28px, transparent 29px);
        }

        .panel.theme-dark .warning {
          border-color: rgba(242, 155, 56, 0.34);
          background: linear-gradient(180deg, rgba(102, 58, 22, 0.46), rgba(89, 47, 16, 0.36));
          color: #ffd9bf;
        }

        .panel.wide {
          display: grid;
          grid-template-columns: minmax(0, 1fr) clamp(360px, 33.333vw, 760px);
          gap: 10px;
          align-items: start;
          grid-auto-flow: dense;
        }

        .panel.wide > .topbar {
          grid-column: 1 / -1;
          margin-bottom: 0;
        }

        .panel.wide > .block-scene {
          grid-column: 2;
          grid-row: 2 / span 4;
        }

        .panel.wide > .block-status { grid-column: 1; grid-row: 2; }
        .panel.wide > .block-grid { grid-column: 1; grid-row: 3; }
        .panel.wide > .block-load { grid-column: 1; grid-row: 4; }
        .panel.wide > .block-diag { grid-column: 1; grid-row: 5; }

        .panel.wide > .block-sources,
        .panel.wide > .block-price,
        .panel.wide > .block-day-kpi,
        .panel.wide > .block-savings-kpi,
        .panel.wide > .block-savings-kpi-2,
        .panel.wide > .block-lifetime-kpi,
        .panel.wide > .block-lifetime-kpi-2,
        .panel.wide > .block-trend-energy,
        .panel.wide > .block-trend-savings,
        .panel.wide > .block-warning,
        .panel.wide > .block-map {
          grid-column: 1 / -1;
        }

        .panel.wide > section,
        .panel.wide > details,
        .panel.wide > .warning {
          margin-bottom: 0;
        }

        .panel.wide .scene {
          aspect-ratio: 16 / 9;
          height: auto;
        }

        .panel.wide .chip {
          min-width: 92px;
          padding: 6px 7px;
        }

        .panel.wide .chip.compact {
          min-width: 108px;
          padding: 5px 7px;
        }

        .panel.wide .chip .value {
          font-size: 0.84rem;
        }

        .panel.wide .chip .meta,
        .panel.wide .chip .meta-inline {
          font-size: 0.62rem;
        }

        .panel.wide .chip .label {
          font-size: 0.54rem;
        }

        .topbar {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .weather {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border-radius: 12px;
          padding: 7px 10px;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(246, 252, 255, 0.72));
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 8px 20px rgba(18, 40, 57, 0.12);
          backdrop-filter: blur(6px);
        }

        .weather ha-icon {
          color: #ffb54a;
          --mdc-icon-size: 20px;
        }

        .weather .temp {
          font-size: 0.9rem;
          font-weight: 700;
          line-height: 1.1;
        }

        .weather .cond {
          font-size: 0.68rem;
          color: var(--ed-muted);
          text-transform: capitalize;
          line-height: 1.1;
        }

        .scene-wrap {
          border-radius: 22px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(246, 250, 255, 0.74));
          box-shadow: var(--ed-shadow);
          padding: 10px;
          margin-bottom: 10px;
          backdrop-filter: blur(8px);
        }

        .scene-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .scene-title {
          font-size: 0.73rem;
          color: var(--ed-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        .actions {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .theme-switch {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          border-radius: 999px;
          padding: 4px 8px;
          border: 1px solid rgba(21, 40, 57, 0.12);
          background: rgba(255, 255, 255, 0.78);
          color: #4d6274;
          font-size: 0.64rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          user-select: none;
          cursor: pointer;
        }

        .theme-switch input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .theme-switch .track {
          width: 34px;
          height: 18px;
          border-radius: 999px;
          background: rgba(133, 151, 168, 0.55);
          position: relative;
          transition: background 120ms ease;
          flex-shrink: 0;
        }

        .theme-switch .thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          transition: transform 120ms ease;
        }

        .theme-switch input:checked + .track {
          background: rgba(31, 180, 150, 0.92);
        }

        .theme-switch input:checked + .track .thumb {
          transform: translateX(16px);
        }

        .panel.theme-dark .theme-switch {
          border-color: rgba(149, 171, 193, 0.24);
          background: rgba(24, 37, 52, 0.9);
          color: #b3c7da;
        }

        .btn {
          border: 1px solid rgba(21, 40, 57, 0.12);
          border-radius: 999px;
          background: white;
          color: #1f2f3e;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 6px 10px;
          cursor: pointer;
        }

        .btn.primary {
          border-color: rgba(27, 178, 149, 0.35);
          background: linear-gradient(180deg, #d6fff6 0%, #c4f3e8 100%);
          color: #127665;
        }

        .btn.ghost {
          background: rgba(255, 255, 255, 0.74);
        }

        .btn.warn {
          border-color: rgba(227, 152, 56, 0.4);
          background: linear-gradient(180deg, #fff3df 0%, #ffe6c7 100%);
          color: #8e5414;
        }

        .btn:active {
          transform: translateY(1px);
        }

        .settings-overlay {
          position: fixed;
          inset: 0;
          z-index: 50;
          background: rgba(8, 14, 22, 0.56);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 16px;
          overflow: auto;
        }

        .settings-dialog {
          width: min(1040px, 100%);
          max-height: calc(100vh - 32px);
          overflow: auto;
          border-radius: 16px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(245, 250, 255, 0.93));
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
          padding: 12px;
        }

        .panel.theme-dark .settings-dialog {
          background: linear-gradient(180deg, rgba(19, 29, 43, 0.97), rgba(15, 24, 36, 0.95));
          border-color: rgba(149, 171, 193, 0.3);
        }

        .settings-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .settings-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--ed-text);
        }

        .settings-error {
          margin-bottom: 8px;
          border-radius: 10px;
          border: 1px solid rgba(203, 81, 81, 0.42);
          background: rgba(232, 87, 87, 0.14);
          padding: 8px 10px;
          font-size: 0.78rem;
          color: #c63737;
          font-weight: 600;
        }

        .settings-form {
          display: grid;
          gap: 10px;
        }

        .settings-block {
          border-radius: 12px;
          border: 1px solid var(--ed-border);
          background: rgba(255, 255, 255, 0.72);
          padding: 10px;
        }

        .panel.theme-dark .settings-block {
          background: rgba(21, 33, 47, 0.72);
        }

        .settings-block h4 {
          margin: 0 0 8px 0;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ed-muted);
        }

        .settings-note {
          margin: 0 0 8px 0;
          font-size: 0.72rem;
          color: var(--ed-muted);
        }

        .settings-subtitle {
          margin: 8px 0 6px 0;
          font-weight: 600;
        }

        .settings-subtitle:first-of-type {
          margin-top: 0;
        }

        .settings-note code {
          font-size: 0.7rem;
          border-radius: 6px;
          padding: 1px 5px;
          border: 1px solid rgba(80, 102, 123, 0.22);
          background: rgba(229, 238, 246, 0.68);
          color: var(--ed-text);
        }

        .settings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 8px;
        }

        .settings-grid-tight {
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        .settings-row {
          display: grid;
          gap: 5px;
          font-size: 0.72rem;
          color: var(--ed-muted);
        }

        .settings-row span {
          font-weight: 600;
        }

        .settings-row input,
        .settings-row select,
        .settings-row textarea {
          border-radius: 10px;
          border: 1px solid rgba(24, 40, 57, 0.18);
          background: rgba(255, 255, 255, 0.9);
          color: #1a2c3b;
          font-size: 0.77rem;
          padding: 7px 8px;
          font-family: inherit;
        }

        .panel.theme-dark .settings-row input,
        .panel.theme-dark .settings-row select,
        .panel.theme-dark .settings-row textarea {
          border-color: rgba(149, 171, 193, 0.28);
          background: rgba(17, 27, 40, 0.9);
          color: #e4eef8;
        }

        .settings-row textarea {
          min-height: 104px;
          resize: vertical;
        }

        .settings-check {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 0.74rem;
          color: var(--ed-text);
          min-height: 34px;
        }

        .settings-check input {
          width: 16px;
          height: 16px;
        }

        .settings-actions {
          margin-top: 10px;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          flex-wrap: wrap;
        }

        .report-overlay {
          position: fixed;
          inset: 0;
          z-index: 52;
          background: rgba(8, 14, 22, 0.56);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 16px;
          overflow: auto;
        }

        .report-dialog {
          width: min(920px, 100%);
          max-height: calc(100vh - 32px);
          overflow: auto;
          border-radius: 16px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(245, 250, 255, 0.93));
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
          padding: 12px;
        }

        .panel.theme-dark .report-dialog {
          background: linear-gradient(180deg, rgba(19, 29, 43, 0.97), rgba(15, 24, 36, 0.95));
          border-color: rgba(149, 171, 193, 0.3);
        }

        .detail-overlay {
          position: fixed;
          inset: 0;
          z-index: 53;
          background: rgba(8, 14, 22, 0.58);
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 16px;
          overflow: auto;
        }

        .detail-dialog {
          width: min(980px, 100%);
          max-height: calc(100vh - 32px);
          overflow: auto;
          border-radius: 16px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(245, 250, 255, 0.93));
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
          padding: 12px;
        }

        .panel.theme-dark .detail-dialog {
          background: linear-gradient(180deg, rgba(19, 29, 43, 0.97), rgba(15, 24, 36, 0.95));
          border-color: rgba(149, 171, 193, 0.3);
        }

        .detail-meta {
          margin-bottom: 10px;
          color: var(--ed-muted);
          font-size: 0.78rem;
          display: grid;
          gap: 2px;
        }

        .detail-chart-wrap {
          border-radius: 12px;
          border: 1px solid var(--ed-border);
          background: rgba(255, 255, 255, 0.74);
          padding: 8px;
          margin-bottom: 10px;
        }

        .panel.theme-dark .detail-chart-wrap {
          background: rgba(21, 33, 47, 0.74);
        }

        .detail-chart-wrap canvas {
          width: 100%;
          height: 236px;
          display: block;
        }

        .detail-kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .detail-kpis .card {
          margin-bottom: 0;
          padding: 10px;
          min-height: 58px;
        }

        .detail-kpis .card .k {
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--ed-muted);
        }

        .report-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }

        .report-loading {
          border-radius: 12px;
          border: 1px solid var(--ed-border);
          background: rgba(255, 255, 255, 0.72);
          padding: 12px;
          color: var(--ed-muted);
          font-size: 0.86rem;
        }

        .panel.theme-dark .report-loading {
          background: rgba(21, 33, 47, 0.72);
        }

        .report-meta {
          margin-bottom: 10px;
          color: var(--ed-muted);
          font-size: 0.78rem;
        }

        .report-kpis {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
        }

        .report-kpis .card {
          margin-bottom: 0;
        }

        .btn[disabled] {
          opacity: 0.55;
          cursor: not-allowed;
          pointer-events: none;
        }

        .scene {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border-radius: 18px;
          border: 1px solid rgba(18, 34, 49, 0.16);
          overflow: hidden;
          background: ${sceneBackground};
          background-origin: border-box;
        }

        .scene::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 18% 10%, rgba(255,255,255,0.35) 0 36px, transparent 37px),
            radial-gradient(circle at 30% 9%, rgba(255,255,255,0.22) 0 28px, transparent 29px);
          pointer-events: none;
          z-index: 0;
        }

        .scene.editing {
          outline: 2px dashed rgba(39, 188, 164, 0.6);
          outline-offset: -8px;
        }

        .scene-flow-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          pointer-events: none;
          display: block;
        }

        .edit-hint {
          position: absolute;
          left: 50%;
          top: 8px;
          transform: translateX(-50%);
          background: rgba(17, 39, 57, 0.68);
          color: #f0f7ff;
          font-size: 0.66rem;
          padding: 5px 8px;
          border-radius: 999px;
          z-index: 4;
          pointer-events: none;
        }

        .chip {
          position: absolute;
          transform: translate(-50%, -50%);
          min-width: 110px;
          padding: 7px 8px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.72);
          color: #f9feff;
          text-shadow: 0 1px 0 rgba(0,0,0,0.22);
          box-shadow: var(--ed-chip-shadow);
          z-index: 3;
          user-select: none;
          text-align: center;
        }

        .chip .value {
          font-size: 0.95rem;
          font-weight: 700;
          line-height: 1.1;
          white-space: nowrap;
        }

        .chip .meta {
          margin-top: 2px;
          display: inline-flex;
          align-items: baseline;
          gap: 5px;
          font-size: 0.72rem;
          line-height: 1.05;
          white-space: nowrap;
          opacity: 0.95;
        }

        .chip .meta-v {
          font-weight: 700;
        }

        .chip .meta-l {
          font-size: 0.57rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.9;
        }

        .chip .label {
          margin-top: 2px;
          font-size: 0.62rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          opacity: 0.93;
        }

        .chip.compact {
          min-width: 126px;
          padding: 5px 9px 6px;
        }

        .chip .main-inline {
          display: inline-flex;
          align-items: baseline;
          justify-content: center;
          gap: 8px;
          line-height: 1.08;
          white-space: nowrap;
        }

        .chip .meta-inline {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          font-size: 0.7rem;
          opacity: 0.95;
        }

        .chip.compact .label {
          margin-top: 1px;
        }

        .chip.aqua { background: linear-gradient(180deg, rgba(18, 156, 140, 0.9), rgba(14, 122, 110, 0.88)); }
        .chip.blue { background: linear-gradient(180deg, rgba(27, 126, 214, 0.9), rgba(24, 100, 170, 0.88)); }
        .chip.orange { background: linear-gradient(180deg, rgba(209, 139, 39, 0.92), rgba(170, 108, 24, 0.9)); }
        .chip.gray { background: linear-gradient(180deg, rgba(70, 86, 102, 0.9), rgba(53, 66, 79, 0.9)); }
        .chip.purple { background: linear-gradient(180deg, rgba(117, 84, 191, 0.9), rgba(90, 59, 156, 0.9)); }

        .chip.editable {
          cursor: grab;
          outline: 2px solid rgba(255, 255, 255, 0.35);
        }

        .chip.editable:active {
          cursor: grabbing;
        }

        .chip.clickable {
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
        }

        .chip.clickable:hover {
          transform: translate(-50%, -50%) scale(1.03);
          filter: saturate(1.08) brightness(1.04);
          box-shadow: 0 14px 30px rgba(0, 0, 0, 0.34);
        }

        .chip.clickable:active {
          transform: translate(-50%, -50%) scale(0.99);
        }


        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 8px;
          margin-bottom: 10px;
        }

        .card,
        .kpi-strip .s,
        .stats .s {
          position: relative;
          padding: 10px 10px 10px 64px;
          min-height: 62px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .card .k.icon-label,
        .kpi-strip .k,
        .stats .k {
          color: var(--ed-muted);
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          line-height: 1.05;
          min-width: 0;
        }

        .card .k.icon-label span,
        .kpi-strip .k span,
        .stats .k span {
          display: block;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card .k.icon-label ha-icon,
        .kpi-strip .k ha-icon,
        .stats .k ha-icon {
          position: absolute;
          left: 11px;
          top: 50%;
          transform: translateY(-50%);
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          border: 1px solid rgba(23, 44, 62, 0.18);
          background: rgba(233, 242, 249, 0.9);
          color: #5b7387;
          opacity: 0.98;
          --mdc-icon-size: 21px;
        }

        .card .v,
        .kpi-strip .v,
        .stats .v {
          margin-top: 4px;
          white-space: nowrap;
          font-size: 0.96rem;
          font-weight: 700;
        }

        .card {
          border-radius: 15px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(246, 251, 255, 0.7));
          box-shadow: 0 9px 22px rgba(20, 44, 61, 0.1);
          backdrop-filter: blur(6px);
        }

        .card .k {
          color: var(--ed-muted);
          font-size: 0.67rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .card .v { font-size: 1.02rem; }

        .block-status .card {
          min-height: 112px;
          justify-content: flex-start;
          padding-top: 10px;
          padding-bottom: 10px;
        }

        .block-status .card .k.icon-label ha-icon {
          top: 12px;
          transform: none;
          width: 32px;
          height: 32px;
          --mdc-icon-size: 20px;
        }

        .block-status .card .v {
          margin-top: 2px;
          font-size: 1.15rem;
          line-height: 1.15;
        }

        .block-status .card .status-detail {
          margin-top: 4px;
          color: var(--ed-muted);
          font-size: 0.72rem;
          line-height: 1.25;
          text-transform: none;
          letter-spacing: 0;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .block-status .card .status-detail.lead {
          margin-top: 6px;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          border-radius: 15px;
          overflow: hidden;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(246, 251, 255, 0.7));
          box-shadow: 0 9px 22px rgba(20, 44, 61, 0.1);
          margin-bottom: 10px;
          backdrop-filter: blur(6px);
        }

        .stats .s { border-right: 1px solid rgba(21, 40, 57, 0.08); }

        .stats .s:last-child { border-right: 0; }

        .stats .v-two-way {
          font-size: 0.82rem;
          line-height: 1.2;
        }

        .trend-wrap {
          border-radius: 15px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(245, 250, 255, 0.74));
          box-shadow: 0 9px 22px rgba(20, 44, 61, 0.1);
          padding: 9px;
          margin-bottom: 10px;
          backdrop-filter: blur(6px);
        }

        .trend-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .trend-head-right {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .trend-title {
          font-size: 0.68rem;
          color: var(--ed-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        .trend-state {
          font-size: 0.66rem;
          color: var(--ed-muted);
        }

        .trend-controls {
          display: inline-flex;
          gap: 4px;
          background: rgba(233, 242, 249, 0.94);
          border: 1px solid rgba(21, 40, 57, 0.1);
          border-radius: 999px;
          padding: 3px;
        }

        .trend-mode-controls .range-btn {
          padding-inline: 10px;
        }

        .trend-unit-controls .range-btn {
          min-width: 44px;
          text-align: center;
        }

        .range-btn {
          border: 0;
          background: transparent;
          color: #4d6274;
          border-radius: 999px;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 4px 8px;
          cursor: pointer;
        }

        .range-btn.active {
          background: #1fb496;
          color: white;
        }

        #trend-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .savings-layout {
          display: grid;
          grid-template-columns: minmax(0, 4fr) clamp(240px, 18vw, 320px);
          gap: 8px;
          align-items: stretch;
        }

        .trend-energy-main {
          border-radius: 12px;
          border: 1px solid rgba(21, 40, 57, 0.12);
          background: rgba(248, 252, 255, 0.72);
          padding: 6px;
          min-width: 0;
          min-height: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          gap: 5px;
        }

        .trend-canvas-wrap {
          flex: 1 1 0;
          min-height: 210px;
          min-width: 0;
          display: flex;
          align-items: stretch;
        }

        .trend-canvas-wrap #trend-canvas {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          width: 100%;
          height: 100%;
          display: block;
        }

        .trend-mix-panel {
          border-radius: 12px;
          border: 1px solid rgba(21, 40, 57, 0.12);
          background: rgba(248, 252, 255, 0.72);
          padding: 6px;
          min-height: 0;
          height: auto;
          display: grid;
          grid-template-rows: auto auto auto auto;
          gap: 5px;
          align-content: start;
        }

        .trend-mix-title {
          font-size: 0.66rem;
          color: var(--ed-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        #trend-mix-canvas {
          width: 100%;
          min-height: 0;
          height: 210px;
          display: block;
        }

        .trend-mix-rows {
          display: grid;
          gap: 3px;
          font-size: 0.66rem;
          color: var(--ed-muted);
        }

        .trend-mix-row {
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 6px;
        }

        .trend-mix-row .v {
          color: var(--ed-text);
          font-weight: 700;
          font-size: 0.72rem;
          white-space: nowrap;
        }

        .trend-mix-autarky {
          font-size: 0.68rem;
          color: var(--ed-muted);
        }

        .trend-mix-autarky b {
          color: var(--ed-text);
        }

        .trend-mix-note {
          font-size: 0.63rem;
          color: var(--ed-muted);
          line-height: 1.3;
        }

        .trend-mix-note b {
          color: var(--ed-text);
        }

        .trend-energy-main .trend-legend {
          margin-top: 0;
          font-size: 0.62rem;
          flex-wrap: nowrap;
          gap: 6px;
          justify-content: space-between;
          white-space: nowrap;
        }

        #savings-canvas {
          width: 100%;
          height: 100%;
          display: block;
        }

        .savings-main {
          border-radius: 12px;
          border: 1px solid rgba(21, 40, 57, 0.12);
          background: rgba(248, 252, 255, 0.72);
          padding: 6px;
          min-width: 0;
          min-height: 0;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          justify-content: flex-start;
          gap: 5px;
        }

        .savings-canvas-wrap {
          flex: 1 1 0;
          min-height: 210px;
          min-width: 0;
          display: flex;
          align-items: stretch;
        }

        .savings-canvas-wrap #savings-canvas {
          flex: 1 1 auto;
          min-width: 0;
          min-height: 0;
          width: 100%;
          height: 100%;
          display: block;
        }

        .trend-legend {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          font-size: 0.68rem;
          color: var(--ed-muted);
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          display: inline-block;
        }

        .dot.load { background: #f29b38; }
        .dot.grid { background: #f29b38; }
        .dot.renew { background: #25b788; }
        .dot.batt { background: #7c5cff; }
        .dot.aut { background: #2b78d7; }
        .dot.save-solar { background: #25b788; }
        .dot.save-arb { background: #d1782e; }
        .dot.save-cum { background: #2b78d7; }

        .source-wrap {
          border-radius: 15px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.83), rgba(245, 250, 255, 0.72));
          box-shadow: 0 9px 22px rgba(20, 44, 61, 0.1);
          padding: 9px;
          margin-bottom: 10px;
          backdrop-filter: blur(6px);
        }

        .source-head {
          font-size: 0.68rem;
          color: var(--ed-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .source-bars {
          display: grid;
          gap: 8px;
        }

        .source-row {
          display: grid;
          grid-template-columns: 92px 1fr auto;
          align-items: center;
          gap: 8px;
          font-size: 0.7rem;
          color: var(--ed-muted);
        }

        .source-track {
          position: relative;
          height: 8px;
          border-radius: 999px;
          background: rgba(50, 78, 102, 0.14);
          overflow: hidden;
        }

        .source-fill {
          position: absolute;
          inset: 0 auto 0 0;
          border-radius: 999px;
          width: 0%;
        }

        .source-fill.solar { background: #25b788; }
        .source-fill.battery { background: #2b78d7; }
        .source-fill.grid { background: #f29b38; }

        .price-wrap {
          border-radius: 15px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(245, 250, 255, 0.74));
          box-shadow: 0 9px 22px rgba(20, 44, 61, 0.1);
          padding: 9px;
          margin-bottom: 10px;
          backdrop-filter: blur(6px);
        }

        .price-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }

        .price-title {
          font-size: 0.68rem;
          color: var(--ed-muted);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        .price-badge {
          font-size: 0.66rem;
          font-weight: 700;
          border-radius: 999px;
          padding: 4px 8px;
          border: 1px solid rgba(21, 40, 57, 0.12);
          background: rgba(239, 245, 250, 0.9);
          color: #4a6174;
        }

        .price-badge.cheap {
          background: rgba(37, 183, 136, 0.16);
          color: #12755b;
          border-color: rgba(37, 183, 136, 0.35);
        }

        .price-badge.expensive {
          background: rgba(242, 155, 56, 0.18);
          color: #8b5116;
          border-color: rgba(242, 155, 56, 0.36);
        }

        .price-main {
          font-size: 1.05rem;
          font-weight: 800;
          margin: 0 0 4px;
        }

        .price-chart-wrap {
          border: 1px solid rgba(21, 40, 57, 0.12);
          border-radius: 12px;
          background: rgba(245, 250, 255, 0.88);
          padding: 6px 6px 4px;
        }

        #price-canvas {
          width: 100%;
          height: 164px;
          display: block;
        }

        .price-info {
          font-size: 0.72rem;
          color: var(--ed-muted);
          display: grid;
          gap: 2px;
          margin-bottom: 6px;
        }

        .warning {
          border-radius: 12px;
          border: 1px solid rgba(192, 65, 50, 0.26);
          background: linear-gradient(180deg, rgba(192, 65, 50, 0.14), rgba(192, 65, 50, 0.08));
          color: #70251d;
          padding: 9px;
          font-size: 0.79rem;
          line-height: 1.35;
          margin-bottom: 8px;
        }

        details.map {
          border-radius: 12px;
          border: 1px solid var(--ed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(246, 251, 255, 0.68));
          padding: 8px 10px;
          backdrop-filter: blur(6px);
        }

        details.map summary {
          cursor: pointer;
          list-style: none;
          color: var(--ed-muted);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
        }

        details.map summary::-webkit-details-marker { display: none; }

        .map-grid {
          margin-top: 8px;
          display: grid;
          grid-template-columns: 130px 1fr;
          gap: 5px 8px;
          font-size: 0.72rem;
        }

        .map-grid .k {
          color: var(--ed-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .map-grid .v {
          overflow-wrap: anywhere;
        }

        .icon-label {
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .icon-label ha-icon {
          --mdc-icon-size: 12px;
          color: var(--ed-muted);
          opacity: 0.9;
        }

        .source-head.icon-label ha-icon,
        .price-title.icon-label ha-icon,
        .trend-title.icon-label ha-icon {
          --mdc-icon-size: 14px;
        }

        .narrow .topbar {
          flex-direction: column;
          align-items: stretch;
        }

        .narrow .weather {
          width: 100%;
          justify-content: center;
        }

        .narrow .scene {
          aspect-ratio: auto;
          height: clamp(190px, 34vh, 280px);
        }

        .narrow .cards {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 6px;
        }

        .narrow .block-status {
          grid-template-columns: 1fr;
        }

        .narrow .block-diag {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .narrow .stats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .narrow .kpi-strip {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .narrow .trend-head {
          flex-direction: column;
          align-items: flex-start;
        }

        .narrow .trend-head-right {
          width: 100%;
          justify-content: flex-start;
          gap: 5px;
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .narrow .trend-head-right::-webkit-scrollbar {
          display: none;
        }

        .narrow .trend-state {
          display: none;
        }

        .narrow .trend-controls {
          flex-shrink: 0;
          gap: 2px;
          padding: 2px;
        }

        .narrow .range-btn {
          font-size: 0.54rem;
          padding: 3px 6px;
        }

        .narrow .savings-layout {
          grid-template-columns: minmax(0, 2fr) minmax(130px, 1fr);
          gap: 6px;
        }

        .narrow .trend-energy-main,
        .narrow .savings-main,
        .narrow .trend-mix-panel {
          padding: 6px;
          gap: 5px;
          min-height: 0;
        }

        .narrow .trend-mix-panel {
          aspect-ratio: auto;
        }

        .narrow .trend-energy-main #trend-canvas {
          min-height: 0;
          height: 100%;
          flex: 1 1 auto;
        }

        .narrow .trend-canvas-wrap {
          min-height: 170px;
        }

        .narrow #trend-mix-canvas {
          min-height: 130px;
          height: 130px;
        }

        .narrow .trend-mix-rows {
          font-size: 0.62rem;
        }

        .narrow .trend-mix-row .v {
          font-size: 0.68rem;
        }

        .narrow .trend-mix-autarky {
          font-size: 0.64rem;
        }

        .narrow .trend-mix-note {
          font-size: 0.57rem;
          line-height: 1.25;
        }

        .narrow .trend-energy-main .trend-legend {
          font-size: 0.52rem;
          gap: 4px;
          flex-wrap: nowrap;
          white-space: nowrap;
          justify-content: space-between;
        }

        .narrow .trend-energy-main .legend-item {
          gap: 3px;
        }

        .narrow .trend-energy-main .dot {
          width: 6px;
          height: 6px;
        }

        .narrow .source-row {
          grid-template-columns: 72px 1fr auto;
          gap: 6px;
        }

        .narrow .price-top {
          flex-wrap: wrap;
          align-items: flex-start;
          gap: 6px;
        }

        .narrow .price-main {
          font-size: 0.98rem;
        }

        .narrow .price-info {
          font-size: 0.68rem;
        }

        .narrow #price-canvas {
          height: 134px;
        }

        .narrow .savings-canvas-wrap {
          min-height: 170px;
        }

        .narrow .chip {
          min-width: 88px;
          padding: 6px 7px;
        }

        .narrow .chip.compact {
          min-width: 104px;
          padding: 5px 7px;
        }

        .narrow .chip .value { font-size: 0.82rem; }
        .narrow .chip .meta { font-size: 0.63rem; }
        .narrow .chip .meta-inline { font-size: 0.62rem; }
        .narrow .chip .label { font-size: 0.56rem; }
        .narrow .card,
        .narrow .stats .s,
        .narrow .kpi-strip .s {
          padding: 8px 7px 8px 56px;
          min-height: 54px;
        }
        .narrow .block-status .card {
          min-height: 102px;
          padding-top: 8px;
          padding-bottom: 8px;
        }
        .narrow .card .k.icon-label,
        .narrow .stats .k,
        .narrow .kpi-strip .k { font-size: 0.58rem; }
        .narrow .card .k.icon-label ha-icon,
        .narrow .stats .k ha-icon,
        .narrow .kpi-strip .k ha-icon {
          left: 8px;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          --mdc-icon-size: 17px;
        }
        .narrow .card .v,
        .narrow .stats .v,
        .narrow .kpi-strip .v { font-size: 0.78rem; }
        .narrow .block-status .card .v { font-size: 1rem; }
        .narrow .block-status .card .status-detail { font-size: 0.68rem; }
        .narrow .stats .v-two-way { font-size: 0.72rem; }
        .narrow .icon-label { gap: 4px; }
        .narrow .source-head.icon-label ha-icon,
        .narrow .price-title.icon-label ha-icon,
        .narrow .trend-title.icon-label ha-icon,
        .narrow .source-row .icon-label ha-icon { --mdc-icon-size: 11px; }
        .narrow .report-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .narrow .detail-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }

        @media (max-width: 390px) {
          .narrow .block-status,
          .narrow .block-diag,
          .narrow .stats,
          .narrow .kpi-strip,
          .narrow .report-kpis,
          .narrow .detail-kpis {
            grid-template-columns: 1fr;
          }
        }

      </style>

      <div class="panel ${layoutClass} ${themeDark ? "theme-dark" : "theme-light"}">
        <header class="topbar">
          <div class="weather">
            <ha-icon data-bind="weather-icon" icon="${weather.icon}"></ha-icon>
            <div>
              <div class="temp" data-bind="weather-temp">${weather.temp}</div>
              <div class="cond" data-bind="weather-cond">${weather.condition}</div>
            </div>
          </div>
        </header>

        <section class="scene-wrap block-scene">
          <div class="scene-toolbar">
            <div class="scene-title">${this._escapeHtml((cfg.title || "Visual Layer"))}</div>
            <div class="actions">
              <label class="theme-switch" title="Dark Mode">
                <input type="checkbox" data-action="toggle-theme" ${themeDark ? "checked" : ""}>
                <span class="track"><span class="thumb"></span></span>
                <span>Dark</span>
              </label>
              <button class="btn ghost" data-action="open-report">Bericht</button>
              <button class="btn ghost" data-action="open-settings">Einstellungen</button>
              <button class="btn ${this._editMode ? "primary" : "ghost"}" data-action="toggle-edit">
                ${this._editMode ? "Fertig" : "Layout bearbeiten"}
              </button>
              ${
                this._editMode
                  ? '<button class="btn ghost" data-action="reset-layout">Zurücksetzen</button>'
                  : ""
              }
            </div>
          </div>

          <div id="scene-stage" class="scene ${this._editMode ? "editing" : ""}">
            <canvas id="scene-flow-canvas" class="scene-flow-canvas" aria-hidden="true"></canvas>
            ${this._editMode ? '<div class="edit-hint">Drag & Drop: Werte an die passende Position ziehen</div>' : ""}
            ${this._chipHTML(
              "solar_power",
              "Solar",
              this._formatPower(solar),
              this._positions.solar_power,
              standardChipColors.solar_power
            )}
            ${this._chipHTML(
              "grid_power",
              "Netz",
              this._formatPower(grid),
              this._positions.grid_power,
              standardChipColors.grid_power
            )}
            ${this._chipHTML(
              "battery_power",
              "Batterie",
              this._formatPower(battery),
              this._positions.battery_power,
              standardChipColors.battery_power,
              this._formatPercent(soc),
              "SOC",
              true
            )}
            ${this._chipHTML(
              "load_power",
              "Hauslast netto",
              this._formatPower(houseLoad),
              this._positions.load_power,
              standardChipColors.load_power
            )}
            ${extraChips
              .map((chip, idx) =>
                this._chipHTML(
                  chip.key,
                  chip.label,
                  this._formatPower(chip.power),
                  this._positions[chip.key] || this._extraChipDefaultPosition(idx),
                  chip.accent
                )
              )
              .join("")}
          </div>
        </section>

        <section class="cards block-status">
          <article class="card">
            <div class="k icon-label"><ha-icon icon="mdi:transmission-tower"></ha-icon><span>Netzstatus</span></div>
            <div class="v" data-bind="grid-status">${this._gridStatus(grid)}</div>
            <div class="status-detail lead" data-bind="grid-proj-main">${gridProjection.main}</div>
            <div class="status-detail" data-bind="grid-proj-detail">${gridProjection.detail}</div>
          </article>
          <article class="card">
            <div class="k icon-label"><ha-icon icon="mdi:battery"></ha-icon><span>Batteriestatus</span></div>
            <div class="v" data-bind="battery-status">${this._batteryStatus(battery)}</div>
            <div class="status-detail">Restlaufzeit (Prognose)</div>
            <div class="v" data-bind="battery-runtime">${batteryRuntime.label}</div>
            <div class="status-detail" data-bind="battery-runtime-detail">${batteryRuntime.detail}</div>
          </article>
          <article class="card">
            <div class="k icon-label"><ha-icon icon="mdi:battery-charging-medium"></ha-icon><span>Akkuladung Quelle</span></div>
            <div class="v" data-bind="charge-label">${chargeSource.label}</div>
            <div class="status-detail" data-bind="charge-detail">${chargeSource.detail}</div>
            <div class="status-detail lead">Ladezeit bis ${Math.round(batteryChargeEta.targetSoc ?? 100)}% (Prognose)</div>
            <div class="v" data-bind="charge-runtime">${batteryChargeEta.label}</div>
            <div class="status-detail" data-bind="charge-runtime-detail">${batteryChargeEta.detail}</div>
          </article>
        </section>

        <section class="stats block-grid">
          <div class="s">
            <div class="k icon-label"><ha-icon icon="mdi:transmission-tower-import"></ha-icon><span>Bezug</span></div>
            <div class="v" data-bind="stat-grid-import">${this._formatPower(gridImport)}</div>
          </div>
          <div class="s">
            <div class="k icon-label"><ha-icon icon="mdi:transmission-tower-export"></ha-icon><span>Einspeisung</span></div>
            <div class="v" data-bind="stat-grid-export">${this._formatPower(gridExport)}</div>
          </div>
          <div class="s">
            <div class="k icon-label"><ha-icon icon="mdi:shield-home"></ha-icon><span>Autarkie</span></div>
            <div class="v" data-bind="stat-autarky">${this._formatPercent(autarky)}</div>
          </div>
        </section>

        <section class="stats block-load">
          <div class="s">
            <div class="k icon-label"><ha-icon icon="mdi:gauge"></ha-icon><span>Gesamtlast</span></div>
            <div class="v" data-bind="stat-load-total">${this._formatPower(loadTotal)}</div>
          </div>
          <div class="s">
            <div class="k icon-label"><ha-icon icon="mdi:battery-sync"></ha-icon><span>Akku 2-Wege</span></div>
            <div class="v v-two-way" data-bind="stat-load-battery">${this._formatBatteryTwoWay(
              loadToBattery,
              batteryDischarge
            )}</div>
          </div>
          <div class="s">
            <div class="k icon-label"><ha-icon icon="mdi:home-lightning-bolt-outline"></ha-icon><span>Hauslast netto</span></div>
            <div class="v" data-bind="stat-house-net">${this._formatPower(houseLoad)}</div>
          </div>
        </section>

        <section class="cards block-diag">
          <article class="card">
            <div class="k icon-label"><ha-icon icon="mdi:scale-unbalanced"></ha-icon><span>Bilanzfehler</span></div>
            <div class="v" data-bind="diag-balance-error">${this._formatPower(balanceError)}</div>
          </article>
          <article class="card">
            <div class="k icon-label"><ha-icon icon="mdi:check-decagram"></ha-icon><span>Bilanzqualität</span></div>
            <div class="v" data-bind="diag-balance-quality">${this._formatPercent(balanceQuality)}</div>
          </article>
          <article class="card">
            <div class="k icon-label"><ha-icon icon="mdi:database-clock"></ha-icon><span>Backfill Pending</span></div>
            <div class="v" data-bind="diag-backfill-pending">${backfillPendingText}</div>
          </article>
        </section>

        <section class="source-wrap block-sources">
          <div class="source-head icon-label"><ha-icon icon="mdi:source-branch"></ha-icon><span>Hauslast Quellen</span></div>
          <div class="source-bars">
            <div class="source-row">
              <div class="icon-label"><ha-icon icon="mdi:white-balance-sunny"></ha-icon><span>Solar</span></div>
              <div class="source-track">
                <span class="source-fill solar" data-bind="source-solar-width" style="width:${houseSources.solarPct.toFixed(1)}%"></span>
              </div>
              <div data-bind="source-solar-value">${this._formatPower(houseSources.solarToHouse)}</div>
            </div>
            <div class="source-row">
              <div class="icon-label"><ha-icon icon="mdi:battery"></ha-icon><span>Batterie</span></div>
              <div class="source-track">
                <span class="source-fill battery" data-bind="source-battery-width" style="width:${houseSources.batteryPct.toFixed(1)}%"></span>
              </div>
              <div data-bind="source-battery-value">${this._formatPower(houseSources.batteryToHouse)}</div>
            </div>
            <div class="source-row">
              <div class="icon-label"><ha-icon icon="mdi:transmission-tower"></ha-icon><span>Netz</span></div>
              <div class="source-track">
                <span class="source-fill grid" data-bind="source-grid-width" style="width:${houseSources.gridPct.toFixed(1)}%"></span>
              </div>
              <div data-bind="source-grid-value">${this._formatPower(houseSources.gridToHouse)}</div>
            </div>
          </div>
        </section>

        <section class="price-wrap block-price">
          <div class="price-top">
            <div class="price-title icon-label"><ha-icon icon="mdi:cash-multiple"></ha-icon><span>Preislogik (Tibber)</span></div>
            <div data-bind="price-badge" class="price-badge ${
              priceInfo.mode === "cheap" ? "cheap" : priceInfo.mode === "expensive" ? "expensive" : ""
            }">
              ${priceInfo.available ? priceInfo.action : "Nicht verfügbar"}
            </div>
          </div>
          <div class="price-main" data-bind="price-main">${
            priceInfo.available ? this._formatPrice(priceInfo.nowPrice, priceInfo.unit) : "Kein Preis verfügbar"
          }</div>
          <div class="price-info">
            <div>Datenquelle: <span data-bind="price-source">${priceInfo.available ? priceInfo.sourceText : "--"}</span></div>
          </div>
          <div class="price-chart-wrap">
            <canvas id="price-canvas"></canvas>
          </div>
        </section>

        <section class="stats kpi-strip block-day-kpi">
          <div class="s">
            <div class="k"><ha-icon icon="mdi:leaf"></ha-icon><span>Erneuerbar</span></div>
            <div class="v">${this._formatPercent(trendRenewDay)}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:home-percent"></ha-icon><span>Autarkie Ø</span></div>
            <div class="v">${this._formatPercent(trendAutarkyDay)}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:cash-plus"></ha-icon><span>Smart</span></div>
            <div class="v">${this._formatMoneyWithCent(trendSmartSavings)}</div>
          </div>
        </section>

        <section class="stats kpi-strip block-savings-kpi">
          <div class="s">
            <div class="k"><ha-icon icon="mdi:cash-plus"></ha-icon><span>Smart (${trendLabel})</span></div>
            <div class="v">${this._formatMoneyWithCent(trendSmartSavings)}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:white-balance-sunny"></ha-icon><span>Solar (${trendLabel})</span></div>
            <div class="v">${this._formatMoneyWithCent(trendSavedSolar)}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:transmission-tower-off"></ha-icon><span>Nichtbezug (${trendLabel})</span></div>
            <div class="v">${this._formatMoneyWithCent(trendSavedNonGrid)}</div>
          </div>
        </section>

        <section class="stats kpi-strip block-savings-kpi-2">
          <div class="s">
            <div class="k"><ha-icon icon="mdi:battery-sync"></ha-icon><span>Akku (${trendLabel})</span></div>
            <div class="v">${this._formatMoneyWithCent(trendBatteryArbitrage)}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:battery-clock"></ha-icon><span>Shift</span></div>
            <div class="v">${
              trendBatteryArbitrageKwh === null ? "--" : `${trendBatteryArbitrageKwh.toFixed(2)} kWh`
            }</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:clock-outline"></ha-icon><span>Zeitraum</span></div>
            <div class="v">${trendLabel}</div>
          </div>
        </section>

        <section class="stats kpi-strip block-lifetime-kpi">
          <div class="s">
            <div class="k"><ha-icon icon="mdi:cash-multiple"></ha-icon><span>Life Smart</span></div>
            <div class="v">${this._formatMoneyWithCent(lifeSmart)}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:white-balance-sunny"></ha-icon><span>Life Solar</span></div>
            <div class="v">${this._formatMoneyWithCent(lifeSolar)}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:transmission-tower-off"></ha-icon><span>Life Nichtbezug</span></div>
            <div class="v">${this._formatMoneyWithCent(lifeNonGrid)}</div>
          </div>
        </section>

        <section class="stats kpi-strip block-lifetime-kpi-2">
          <div class="s">
            <div class="k"><ha-icon icon="mdi:battery-sync"></ha-icon><span>Life Akku</span></div>
            <div class="v">${this._formatMoneyWithCent(lifeArbitrage)}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:battery-clock"></ha-icon><span>Life Shift</span></div>
            <div class="v">${lifeShiftKwh === null ? "--" : `${lifeShiftKwh.toFixed(2)} kWh`}</div>
          </div>
          <div class="s">
            <div class="k"><ha-icon icon="mdi:database-clock"></ha-icon><span>Backfill</span></div>
            <div class="v" data-bind="kpi-backfill-pending">${backfillPendingText}</div>
          </div>
        </section>

        <section class="trend-wrap block-trend-energy">
          <div class="trend-head">
            <div class="trend-title icon-label"><ha-icon icon="mdi:chart-line"></ha-icon><span>Tagesverlauf</span></div>
            <div class="trend-head-right">
              <div class="trend-controls">
                <button class="range-btn ${rangeToday ? "active" : ""}" data-action="trend-range" data-range="today">${rangeLabelToday}</button>
                <button class="range-btn ${range24h ? "active" : ""}" data-action="trend-range" data-range="day24">${rangeLabel24h}</button>
                <button class="range-btn ${range7d ? "active" : ""}" data-action="trend-range" data-range="week7">${rangeLabel7d}</button>
                <button class="range-btn ${rangeMonth ? "active" : ""}" data-action="trend-range" data-range="month">${rangeLabelMonth}</button>
                <button class="range-btn ${rangeTotal ? "active" : ""}" data-action="trend-range" data-range="total">${rangeLabelTotal}</button>
              </div>
              <div class="trend-controls trend-mode-controls">
                <button class="range-btn ${trendModeLine ? "active" : ""}" data-action="trend-mode" data-mode="line">${modeLabelLine}</button>
                <button class="range-btn ${trendModeBars ? "active" : ""}" data-action="trend-mode" data-mode="bars">${modeLabelBars}</button>
              </div>
              <div class="trend-controls trend-unit-controls">
                <button class="range-btn ${trendValueKw ? "active" : ""}" data-action="trend-value-mode" data-value-mode="kw">kW</button>
                <button class="range-btn ${trendValueKwh ? "active" : ""}" data-action="trend-value-mode" data-value-mode="kwh">kWh</button>
              </div>
              <div class="trend-state">${this._trendLoading ? "Lädt..." : trendLabel}</div>
            </div>
          </div>
          <div class="trend-energy-main">
            <div class="trend-canvas-wrap">
              <canvas id="trend-canvas"></canvas>
            </div>
            <div class="trend-legend">
              ${
                trendModeBars
                  ? `
              <span class="legend-item"><span class="dot load"></span>${legendLabelLoad}</span>
              <span class="legend-item"><span class="dot renew"></span>${legendLabelRenew}</span>
              <span class="legend-item"><span class="dot batt"></span>${legendLabelBattery}</span>
              <span class="legend-item"><span class="dot aut"></span>${legendLabelAutarky}</span>
              `
                  : `
              <span class="legend-item"><span class="dot load"></span>${legendLabelLoad}</span>
              <span class="legend-item"><span class="dot renew"></span>${legendLabelRenew}</span>
              <span class="legend-item"><span class="dot aut"></span>${legendLabelAutarky}</span>
              `
              }
            </div>
          </div>
        </section>

        <section class="trend-wrap block-trend-savings">
          <div class="trend-head">
            <div class="trend-title icon-label"><ha-icon icon="mdi:chart-areaspline"></ha-icon><span>Sparverlauf</span></div>
            <div class="trend-state">${this._trendLoading ? "Lädt..." : trendLabel}</div>
          </div>
          <div class="savings-layout">
            <div class="savings-main">
              <div class="savings-canvas-wrap">
                <canvas id="savings-canvas"></canvas>
              </div>
              <div class="trend-legend">
                <span class="legend-item"><span class="dot save-solar"></span>Solar-Ersparnis je Intervall</span>
                <span class="legend-item"><span class="dot save-arb"></span>Akku-Preisvorteil je Intervall</span>
                <span class="legend-item"><span class="dot save-cum"></span>Kumulierte Smart-Summe</span>
              </div>
            </div>
            <aside class="trend-mix-panel">
              <div class="trend-mix-title icon-label"><ha-icon icon="mdi:chart-donut"></ha-icon><span>Hauslast-Mix (${trendLabel})</span></div>
              <div class="trend-mix-rows">
                <div class="trend-mix-row">
                  <span class="dot renew"></span>
                  <span>Solar (Haus)</span>
                  <span class="v" data-bind="trend-mix-solar">${
                    trendMix.available
                      ? `${this._formatEnergyKwh(trendMix.solarKwh)} · ${trendMix.solarPct.toFixed(0)} %`
                      : "--"
                  }</span>
                </div>
                <div class="trend-mix-row">
                  <span class="dot batt"></span>
                  <span>Akku (Haus)</span>
                  <span class="v" data-bind="trend-mix-battery">${
                    trendMix.available
                      ? `${this._formatEnergyKwh(trendMix.batteryKwh)} · ${trendMix.batteryPct.toFixed(0)} %`
                      : "--"
                  }</span>
                </div>
                <div class="trend-mix-row">
                  <span class="dot grid"></span>
                  <span>Netz (Haus)</span>
                  <span class="v" data-bind="trend-mix-grid">${
                    trendMix.available
                      ? `${this._formatEnergyKwh(trendMix.gridKwh)} · ${trendMix.gridPct.toFixed(0)} %`
                      : "--"
                  }</span>
                </div>
              </div>
              <div class="trend-mix-note">
                Mix zeigt nur die Deckung der Hauslast.
              </div>
              <div class="trend-mix-note">
                Solar-Erzeugung gesamt: <b data-bind="trend-mix-produced">${
                  trendMix.available ? this._formatEnergyKwh(trendMix.solarProducedKwh) : "--"
                }</b> · Netzbezug gesamt (Haus+Akku): <b data-bind="trend-mix-grid-total">${
                  trendMix.available ? this._formatEnergyKwh(trendMix.gridImportAccountedKwh) : "--"
                }</b>
              </div>
              <div class="trend-mix-note">
                Davon in den Akku geladen (Netz): <b data-bind="trend-mix-grid-battery">${
                  trendMix.available ? this._formatEnergyKwh(trendMix.gridToBatteryKwh) : "--"
                }</b>
              </div>
              <div class="trend-mix-note">
                Roh-Zähler Netzbezug: <b data-bind="trend-mix-grid-sensor">${
                  trendMix.available ? this._formatEnergyKwh(trendMix.gridImportTotalKwh) : "--"
                }</b> · Differenz: <b data-bind="trend-mix-grid-diff">${
                  trendMix.available
                    ? `${trendMix.gridImportDiffKwh >= 0 ? "+" : "-"}${this._formatEnergyKwh(Math.abs(trendMix.gridImportDiffKwh))}`
                    : "--"
                }</b>
              </div>
              <div class="trend-mix-autarky">Autarkiegrad: <b data-bind="trend-mix-autarky">${
                trendMix.available ? this._formatPercent(trendMix.autarkyPct) : "--"
              }</b></div>
              <canvas id="trend-mix-canvas"></canvas>
            </aside>
          </div>
        </section>

        ${
          missing.length > 0
            ? `<div class="warning block-warning"><b>Sensoren fehlen:</b><br>${missing.join("<br>")}</div>`
            : ""
        }

        <details class="map block-map">
          <summary>Sensor Mapping</summary>
          <div class="map-grid">
            <div class="k">solar_power</div><div class="v">${sensors.solar_power}</div>
            <div class="k">solar_energy</div><div class="v">${sensors.solar_energy || "-"}</div>
            <div class="k">grid_power</div><div class="v">${sensors.grid_power}</div>
            <div class="k">grid_power_tibber_fallback</div><div class="v">${TIBBER_LIVE_GRID_SENSOR}</div>
            <div class="k">grid_power_effektiv</div><div class="v">${gridFlow.signedEntityId || "-"}</div>
            <div class="k">grid_import</div><div class="v">${sensors.grid_import_power || "-"}</div>
            <div class="k">grid_export</div><div class="v">${sensors.grid_export_power || "-"}</div>
            <div class="k">grid_import_energy</div><div class="v">${sensors.grid_import_energy || "-"}</div>
            <div class="k">grid_export_energy</div><div class="v">${sensors.grid_export_energy || "-"}</div>
            <div class="k">battery_power</div><div class="v">${sensors.battery_power}</div>
            <div class="k">battery_inverter_power</div><div class="v">${sensors.battery_inverter_power || "-"}</div>
            <div class="k">battery_charge</div><div class="v">${sensors.battery_charge_power || "-"}</div>
            <div class="k">battery_discharge</div><div class="v">${sensors.battery_discharge_power || "-"}</div>
            <div class="k">load_power</div><div class="v">${sensors.load_power}</div>
            <div class="k">load_energy</div><div class="v">${sensors.load_energy || "-"}</div>
            <div class="k">battery_charge_energy</div><div class="v">${sensors.battery_charge_energy || "-"}</div>
            <div class="k">battery_discharge_energy</div><div class="v">${sensors.battery_discharge_energy || "-"}</div>
            <div class="k">battery_soc</div><div class="v">${sensors.battery_soc}</div>
            <div class="k">extra_chips</div><div class="v">${
              extraChips.length
                ? extraChips.map((chip) => `${chip.label}: ${chip.entity}`).join(" | ")
                : "-"
            }</div>
            <div class="k">calc_gesamtlast</div><div class="v">${this._formatPower(loadTotal)}</div>
            <div class="k">calc_in_akku</div><div class="v">${this._formatPower(loadToBattery)}</div>
            <div class="k">calc_haus_netto</div><div class="v">${this._formatPower(houseLoad)}</div>
            <div class="k">calc_bat_discharge</div><div class="v">${this._formatPower(batteryDischarge)}</div>
            <div class="k">charge_mode</div><div class="v">${chargeSource.mode}</div>
            <div class="k">charge_solar</div><div class="v">${this._formatPower(chargeSource.solarPart)}</div>
            <div class="k">charge_grid</div><div class="v">${this._formatPower(chargeSource.gridPart)}</div>
            <div class="k">grid_source</div><div class="v">${gridFlow.mode}</div>
            <div class="k">grid_signed_source</div><div class="v">${gridFlow.signedSource || "-"}</div>
            <div class="k">battery_source</div><div class="v">${batteryFlow.mode}</div>
            <div class="k">battery_signed_source</div><div class="v">${batteryFlow.signedSource || "-"}</div>
            <div class="k">cfg_use_signed_battery</div><div class="v">${flowOpts.useSignedBatteryPower ? "ja" : "nein"}</div>
            <div class="k">cfg_grid_mode</div><div class="v">${flowOpts.gridSensorMode}</div>
            <div class="k">cfg_battery_mode</div><div class="v">${flowOpts.batterySensorMode}</div>
            <div class="k">cfg_invert_battery_sign</div><div class="v">${flowOpts.invertBatteryPowerSign ? "ja" : "nein"}</div>
            <div class="k">cfg_invert_load_sign</div><div class="v">${flowOpts.invertLoadPowerSign ? "ja" : "nein"}</div>
            <div class="k">cfg_chip_colors</div><div class="v">${Object.entries(standardChipColors).map(([k, v]) => `${k}:${v}`).join(" | ")}</div>
            <div class="k">house_solar</div><div class="v">${this._formatPower(houseSources.solarToHouse)}</div>
            <div class="k">house_battery</div><div class="v">${this._formatPower(houseSources.batteryToHouse)}</div>
            <div class="k">house_grid</div><div class="v">${this._formatPower(houseSources.gridToHouse)}</div>
            <div class="k">price_entity</div><div class="v">${priceInfo.entityId || "-"}</div>
            <div class="k">price_current_sensor</div><div class="v">${priceSensors.current || "-"}</div>
            <div class="k">price_next_1h</div><div class="v">${priceSensors.next_1h || "-"}</div>
            <div class="k">price_next_2h</div><div class="v">${priceSensors.next_2h || "-"}</div>
            <div class="k">price_next_3h</div><div class="v">${priceSensors.next_3h || "-"}</div>
            <div class="k">price_next_4h</div><div class="v">${priceSensors.next_4h || "-"}</div>
            <div class="k">price_next_5h</div><div class="v">${priceSensors.next_5h || "-"}</div>
            <div class="k">price_min_today</div><div class="v">${priceSensors.min_today || "-"}</div>
            <div class="k">price_max_today</div><div class="v">${priceSensors.max_today || "-"}</div>
            <div class="k">price_level_sensor</div><div class="v">${priceSensors.level || "-"}</div>
            <div class="k">price_now</div><div class="v">${priceInfo.available ? this._formatPrice(priceInfo.nowPrice, priceInfo.unit) : "--"}</div>
            <div class="k">savings_solar_direct</div><div class="v">${this._formatMoneyEur(trendSavedSolar)}</div>
            <div class="k">savings_non_grid</div><div class="v">${this._formatMoneyEur(trendSavedNonGrid)}</div>
            <div class="k">battery_arbitrage</div><div class="v">${this._formatMoneyEur(trendBatteryArbitrage)}</div>
            <div class="k">smart_savings</div><div class="v">${this._formatMoneyEur(trendSmartSavings)}</div>
            <div class="k">battery_shift_kwh</div><div class="v">${
              trendBatteryArbitrageKwh === null ? "--" : `${trendBatteryArbitrageKwh.toFixed(3)}`
            }</div>
            <div class="k">lifetime_entity_smart</div><div class="v">${LIFETIME_SENSORS.smart}</div>
            <div class="k">lifetime_entity_solar</div><div class="v">${LIFETIME_SENSORS.solar}</div>
            <div class="k">lifetime_entity_non_grid</div><div class="v">${LIFETIME_SENSORS.non_grid}</div>
            <div class="k">lifetime_entity_arbitrage</div><div class="v">${LIFETIME_SENSORS.arbitrage}</div>
            <div class="k">lifetime_entity_shift</div><div class="v">${LIFETIME_SENSORS.shift_kwh}</div>
            <div class="k">lifetime_smart</div><div class="v">${this._formatMoneyEur(lifeSmart)}</div>
            <div class="k">lifetime_solar</div><div class="v">${this._formatMoneyEur(lifeSolar)}</div>
            <div class="k">lifetime_non_grid</div><div class="v">${this._formatMoneyEur(lifeNonGrid)}</div>
            <div class="k">lifetime_arbitrage</div><div class="v">${this._formatMoneyEur(lifeArbitrage)}</div>
            <div class="k">lifetime_shift_kwh</div><div class="v">${
              lifeShiftKwh === null ? "--" : `${lifeShiftKwh.toFixed(3)}`
            }</div>
            <div class="k">diag_balance_error_sensor</div><div class="v">${DIAG_SENSORS.balance_error}</div>
            <div class="k">diag_balance_quality_sensor</div><div class="v">${DIAG_SENSORS.balance_quality}</div>
            <div class="k">diag_backfill_pending_sensor</div><div class="v">${DIAG_SENSORS.backfill_pending}</div>
            <div class="k">diag_balance_error</div><div class="v">${this._formatPower(balanceError)}</div>
            <div class="k">diag_balance_quality</div><div class="v">${this._formatPercent(balanceQuality)}</div>
            <div class="k">diag_backfill_pending</div><div class="v">${backfillPendingText}</div>
            <div class="k">background</div><div class="v">${bgImage || "nicht gesetzt"}</div>
          </div>
        </details>
        ${this._detailOpen ? this._detailModalHTML(liveModel, extraChips) : ""}
        ${this._reportOpen ? this._reportModalHTML() : ""}
        ${this._settingsOpen ? this._settingsModalHTML(settingsDraft, settingsOptions) : ""}
      </div>
    `;

    this._hasRenderedTemplate = true;
    this._bindInteractions();
    this._syncFlowCanvas(sceneCables);
    this._bindChartResizeObserver();
    this._bindChartHoverHandlers();
    requestAnimationFrame(() => {
      try {
        this._drawTrendChart();
        this._drawTrendMixChart();
        this._drawSavingsChart();
        this._drawPriceChart();
        this._drawDetailChart();
      } catch (error) {
        this._renderFatalError(error);
      }
    });
  }
}

if (!customElements.get("ha-energy-dashboard-panel")) {
  customElements.define("ha-energy-dashboard-panel", HaEnergyDashboardPanel);
}
