/**
 * @fileoverview Renders the projections chart (Standard, Coast FIRE, FIRE)
 * using Chart.js loaded from CDN. Subscribes to the store and re-renders
 * reactively. Also writes the "Coast FIRE achievable at age X" / "FIRE
 * achievable at age Y" annotations to the chart-annotations container.
 *
 * Engine usage: only goes through `src/engine/index.js` (the frozen public API).
 *
 * @module src/ui/chart
 */

import { setChildren, h } from './dom.js';
import { formatCurrency, formatCurrencyCompact } from './format.js';
import {
  simulateStandard,
  simulateCoastFire,
  findCoastFireAge,
  simulateFire,
  findFireAge,
} from '../engine/index.js';
import { mountYearRangeControl } from './yearRangeControl.js';

const HORIZON_AGE = 85;

// Match the page's body font (--font-body in styles.css) so the chart's
// typography is consistent with the rest of the UI.
const FONT_FAMILY =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

// Font sizes — bumped up from Chart.js defaults so they match the surrounding
// UI body copy (~14–16px).
const FONT_SIZE_TICKS = 13;
const FONT_SIZE_AXIS_TITLE = 14;
const FONT_SIZE_TOOLTIP_TITLE = 14;
const FONT_SIZE_TOOLTIP_BODY = 13;
const FONT_SIZE_MARKER_LABEL = 12;

// Per-scenario colors — aligned with the LinkedIn-inspired theme in styles.css
// (--li-blue / --li-sky / --accent-magenta, on the light cream/white surface).
const COLOR_STANDARD = '#0a66c2'; // --li-blue (primary brand)
const COLOR_COAST    = '#378fe9'; // --li-sky  (secondary brand)
const COLOR_FIRE     = '#c11574'; // --accent-magenta (highlight)
const COLOR_GRID     = 'rgba(0, 0, 0, 0.08)';
const COLOR_TICKS    = 'rgba(0, 0, 0, 0.62)'; // matches --fg-dim

/**
 * Mounts the projections chart and wires it to the store.
 * @param {HTMLCanvasElement} canvasEl - <canvas> for Chart.js
 * @param {HTMLElement} annotationsEl - container for textual age markers
 * @param {Object} store
 * @param {HTMLElement} [rangeEl] - container for the year-range zoom control
 */
export function mountChart(canvasEl, annotationsEl, store, rangeEl) {
  /** @type {any} Chart.js instance */
  let chart = null;

  /** @type {import('./yearRangeControl.js').YearRangeControl|null} */
  let rangeCtrl = null;
  // Last-seen absolute year band, so we can detect when bounds change.
  let lastAbsMinYear = null;
  let lastAbsMaxYear = null;

  /**
   * Wait until window.Chart is loaded (CDN script is `defer`ed) before first
   * render. Polls every 50ms with a 5s ceiling.
   */
  function whenChartReady(cb) {
    if (typeof window !== 'undefined' && window.Chart) return cb();
    let tries = 0;
    const tick = () => {
      if (window.Chart) return cb();
      if (tries++ < 100) return setTimeout(tick, 50);
      // Give up: show a friendly message.
      annotationsEl.textContent = 'Chart.js failed to load. Check your network.';
    };
    tick();
  }

  function buildDatasets(state) {
    const startAge = state.userInfo.age;

    // Standard scenario
    const stdTraj = simulateStandard(state, { horizonAge: HORIZON_AGE });
    // Coast FIRE feasibility age (earliest age at which the user can stop contributing)
    const coastAge = findCoastFireAge(state, { horizonAge: HORIZON_AGE });
    // Coast FIRE trajectory: contribute up to coastAge, then stop. If not
    // feasible at all (coastAge null), fall back to the legacy "stop now"
    // trajectory so the line is still informative.
    const coastTraj = simulateCoastFire(state, {
      horizonAge: HORIZON_AGE,
      coastAge: coastAge ?? state.userInfo.age,
    });
    // FIRE — pick the earliest feasible age; otherwise null (don't render the line).
    const fireAge = findFireAge(state, { horizonAge: HORIZON_AGE });
    const fireTraj =
      fireAge !== null
        ? simulateFire(state, { startAge: fireAge, horizonAge: HORIZON_AGE }).trajectory
        : null;

    // X-axis labels = ages (year 0 == startAge, ..., HORIZON_AGE)
    const labels = stdTraj.map((r) => r.age);

    const datasets = [
      {
        label: 'Standard',
        data: stdTraj.map((r) => r.netWorth),
        borderColor: COLOR_STANDARD,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
      },
      {
        label: 'Coast FIRE',
        data: coastTraj.map((r) => r.netWorth),
        borderColor: COLOR_COAST,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
      },
    ];

    if (fireTraj) {
      // Pad/align so its labels line up with the start-age axis. simulateFire
      // returns a trajectory of length (horizonAge − startAge + 1) starting
      // at the user's current age. Same length as stdTraj — direct map.
      datasets.push({
        label: `FIRE (from ${fireAge})`,
        data: fireTraj.map((r) => r.netWorth),
        borderColor: COLOR_FIRE,
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [2, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
      });
    }

    return { labels, datasets, coastAge, fireAge, startAge };
  }

  function renderAnnotations({ coastAge, fireAge }) {
    setChildren(annotationsEl, [
      h('span', { className: 'marker', attrs: { style: `color:${COLOR_STANDARD}` }, children: 'Standard' }),
      h('span', { className: 'marker', attrs: { style: `color:${COLOR_COAST}` },
        children: coastAge != null
          ? `Coast FIRE: stop contributing at age ${coastAge}`
          : 'Coast FIRE not achievable by 85',
      }),
      h('span', { className: 'marker', attrs: { style: `color:${COLOR_FIRE}` },
        children: fireAge != null
          ? `FIRE achievable at age ${fireAge}`
          : 'FIRE not achievable by 85',
      }),
    ]);
  }

  function vlinePlugin(coastAge, fireAge, startAge) {
    return {
      id: 'ageMarkers',
      afterDraw(chartInst) {
        const { ctx, chartArea, scales } = chartInst;
        if (!scales.x) return;
        const drawLine = (age, color) => {
          if (age == null) return;
          const x = scales.x.getPixelForValue(age);
          if (x < chartArea.left || x > chartArea.right) return;
          ctx.save();
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.7;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
          // Label
          ctx.setLineDash([]);
          ctx.fillStyle = color;
          ctx.font = `${FONT_SIZE_MARKER_LABEL}px ${FONT_FAMILY}`;
          ctx.textAlign = 'left';
          ctx.fillText(`age ${age}`, x + 4, chartArea.top + 12);
          ctx.restore();
        };
        drawLine(coastAge, COLOR_COAST);
        drawLine(fireAge, COLOR_FIRE);
      },
    };
  }

  function render() {
    if (typeof window === 'undefined' || !window.Chart) return;
    const state = store.getState();
    const wrap = canvasEl.parentElement;

    // Empty state — no assets means no meaningful chart.
    if (!state.assets || state.assets.length === 0) {
      if (chart) {
        chart.destroy();
        chart = null;
      }
      if (wrap) wrap.classList.add('empty');
      setChildren(annotationsEl, []);
      if (rangeEl) setChildren(rangeEl, []);
      rangeCtrl = null;
      lastAbsMinYear = null;
      lastAbsMaxYear = null;
      return;
    }
    if (wrap) wrap.classList.remove('empty');

    const { labels, datasets, coastAge, fireAge, startAge } = buildDatasets(state);

    renderAnnotations({ coastAge, fireAge });

    // Year-range zoom control. Translate ages to calendar years for the UI:
    // year = currentCalendarYear + (age - startAge).
    const currentCalendarYear = new Date().getFullYear();
    const absMinYear = currentCalendarYear; // == startAge
    const absMaxYear = currentCalendarYear + (HORIZON_AGE - startAge);

    if (rangeEl) {
      if (
        !rangeCtrl ||
        absMinYear !== lastAbsMinYear ||
        absMaxYear !== lastAbsMaxYear
      ) {
        // (Re-)mount the control whenever the absolute band changes.
        if (!rangeCtrl) {
          rangeCtrl = mountYearRangeControl(rangeEl, {
            min: absMinYear,
            max: absMaxYear,
            onChange: () => render(),
          });
        } else {
          rangeCtrl.setBounds(absMinYear, absMaxYear);
        }
        lastAbsMinYear = absMinYear;
        lastAbsMaxYear = absMaxYear;
      }
    }

    // Translate selected year window back to ages for the x-axis.
    const sel = rangeCtrl ? rangeCtrl.getRange() : { min: absMinYear, max: absMaxYear };
    const xMinAge = startAge + (sel.min - currentCalendarYear);
    const xMaxAge = startAge + (sel.max - currentCalendarYear);

    if (chart) {
      // Reuse the chart for smooth updates. We need to refresh both the data
      // and the marker plugin (Chart.js v4 caches plugins from construction
      // time, so we destroy and recreate the chart when ages change).
      chart.destroy();
      chart = null;
    }

    chart = new window.Chart(canvasEl, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            borderColor: '#dfdcd6',
            borderWidth: 1,
            titleColor: '#000000',
            bodyColor: 'rgba(0, 0, 0, 0.92)',
            titleFont: { family: FONT_FAMILY, size: FONT_SIZE_TOOLTIP_TITLE, weight: '600' },
            bodyFont:  { family: FONT_FAMILY, size: FONT_SIZE_TOOLTIP_BODY },
            callbacks: {
              title: (items) => `Age ${items[0].label}`,
              label: (item) => `${item.dataset.label}: ${formatCurrency(item.parsed.y, { digits: 0 })}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: xMinAge,
            max: xMaxAge,
            ticks: { color: COLOR_TICKS, font: { family: FONT_FAMILY, size: FONT_SIZE_TICKS } },
            grid: { color: COLOR_GRID, drawTicks: false },
            title: {
              display: true,
              text: 'Age',
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_AXIS_TITLE },
            },
          },
          y: {
            ticks: {
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_TICKS },
              callback: (v) => formatCurrencyCompact(v),
            },
            grid: { color: COLOR_GRID },
            title: {
              display: true,
              text: 'Net worth',
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_AXIS_TITLE },
            },
          },
        },
      },
      plugins: [vlinePlugin(coastAge, fireAge, startAge)],
    });
  }

  whenChartReady(() => {
    render();
    store.subscribe(render);
  });
}
