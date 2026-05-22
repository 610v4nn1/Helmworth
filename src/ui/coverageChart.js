/**
 * @fileoverview Renders a stacked-bar "coverage" chart showing how each
 * year's expenses + debt payments are covered, decomposed by source:
 *
 *   - Passive income, per asset class (pension, bonds yield, real-estate
 *     cash flow, private-business dividends).
 *   - Drawdown, per liquid asset class (cash drained, plus stocks/bonds/
 *     crypto sold via HIFO).
 *
 * A black line overlay shows the corresponding expenses + debt payments for
 * each year.
 *
 * Two instances are mounted on the home page:
 *   - FIRE coverage:        startAge = findFireAge(state)
 *   - Retirement coverage:  startAge = userInfo.retirementAge
 *
 * STYLE ISOLATION RULE
 * --------------------
 * This module deliberately uses brand-new CSS class names only
 * (coverage-card / coverage-canvas / coverage-legend / coverage-status /
 * cov-*). It MUST NOT add or expect any class shared with the existing
 * home-page cards (.card-section, .chart-wrap, .chart-annotations …),
 * so its styles cannot leak.
 *
 * Engine usage: only via `src/engine/index.js` (the frozen public API).
 *
 * @module src/ui/coverageChart
 */

import { setChildren, h } from './dom.js';
import { formatCurrency, formatCurrencyCompact } from './format.js';
import { simulateFire, findFireAge } from '../engine/index.js';

const HORIZON_AGE = 100;

const FONT_FAMILY =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const FONT_SIZE_TICKS = 13;
const FONT_SIZE_AXIS_TITLE = 14;
const FONT_SIZE_TOOLTIP_TITLE = 14;
const FONT_SIZE_TOOLTIP_BODY = 13;

const COLOR_GRID = 'rgba(0, 0, 0, 0.08)';
const COLOR_TICKS = 'rgba(0, 0, 0, 0.62)';
const COLOR_EXPENSES = '#000000';

// Mirror the existing per-class palette in styles.css.
const CLASS_COLORS = {
  stocks:          '#0a66c2',
  bonds:           '#378fe9',
  crypto:          '#b24020',
  cash:            '#057642',
  realEstate:      '#915907',
  privateBusiness: '#7a3e9d',
  pension:         '#0073b1',
  personalDebt:    '#cc1016',
};

// Stacking order: passive sources at the bottom (what comes in for free),
// drawdown on top (what we had to sell).
const PASSIVE_CLASSES = ['pension', 'bonds', 'realEstate', 'privateBusiness'];
const DRAWDOWN_CLASSES = ['cash', 'bonds', 'stocks', 'crypto'];

const PASSIVE_LABEL = {
  pension:         'Pension income',
  bonds:           'Bonds yield',
  realEstate:      'Real-estate cash flow',
  privateBusiness: 'Business dividends',
};

const DRAWDOWN_LABEL = {
  cash:   'Cash drained',
  bonds:  'Bonds sold',
  stocks: 'Stocks sold',
  crypto: 'Crypto sold',
};

function whenChartReady(cb) {
  if (typeof window !== 'undefined' && window.Chart) return cb();
  let tries = 0;
  const tick = () => {
    if (window.Chart) return cb();
    if (tries++ < 100) return setTimeout(tick, 50);
  };
  tick();
}

function resolveStartAge(state, startAgeMode) {
  if (startAgeMode === 'fire') {
    return findFireAge(state, { horizonAge: HORIZON_AGE });
  }
  if (startAgeMode === 'retirement') {
    return state.userInfo.retirementAge ?? null;
  }
  return null;
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildDatasets(trajectory, startAge) {
  const startIdx = trajectory.findIndex((r) => r.age >= startAge);
  if (startIdx < 0) return null;
  const slice = trajectory.slice(startIdx);
  const labels = slice.map((r) => r.age);

  const passiveCol = (cls) => slice.map((r) => (r.passiveByClass?.[cls] ?? 0));
  const drawCol    = (cls) => slice.map((r) => (r.drawnByClass?.[cls]    ?? 0));

  const datasets = [];

  for (const cls of PASSIVE_CLASSES) {
    const data = passiveCol(cls);
    if (data.every((v) => v === 0)) continue;
    datasets.push({
      type: 'bar',
      label: PASSIVE_LABEL[cls],
      data,
      backgroundColor: CLASS_COLORS[cls],
      borderColor: 'rgba(255,255,255,0.6)',
      borderWidth: 0.5,
      stack: 'cov',
      _kind: 'passive',
      _class: cls,
    });
  }

  for (const cls of DRAWDOWN_CLASSES) {
    const data = drawCol(cls);
    if (data.every((v) => v === 0)) continue;
    datasets.push({
      type: 'bar',
      label: DRAWDOWN_LABEL[cls],
      data,
      backgroundColor: hexToRgba(CLASS_COLORS[cls], 0.55),
      borderColor: CLASS_COLORS[cls],
      borderWidth: 1.2,
      borderDash: [3, 3],
      stack: 'cov',
      _kind: 'drawdown',
      _class: cls,
    });
  }

  const expensesLine = slice.map((r) => (r.expenses ?? 0) + (r.debtPayments ?? 0));
  datasets.push({
    type: 'line',
    label: 'Expenses + debt',
    data: expensesLine,
    borderColor: COLOR_EXPENSES,
    backgroundColor: 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.1,
    stack: 'expenses',
    yAxisID: 'y',
    order: 0,
  });

  return { labels, datasets, slice };
}

function legendItemsFromDatasets(datasets) {
  const items = [];
  const passive = datasets.filter((d) => d._kind === 'passive');
  if (passive.length) {
    items.push(h('span', { className: 'cov-legend-group', children: 'Passive income:' }));
    for (const d of passive) {
      items.push(
        h('span', {
          className: 'cov-marker',
          children: [
            h('span', {
              className: 'cov-swatch',
              attrs: { style: `background:${d.backgroundColor}` },
            }),
            d.label,
          ],
        }),
      );
    }
  }
  const drawdown = datasets.filter((d) => d._kind === 'drawdown');
  if (drawdown.length) {
    items.push(h('span', { className: 'cov-legend-group', children: 'From drawdown:' }));
    for (const d of drawdown) {
      items.push(
        h('span', {
          className: 'cov-marker',
          children: [
            h('span', {
              className: 'cov-swatch cov-swatch-drawn',
              attrs: { style: `background:${d.backgroundColor};border-color:${d.borderColor}` },
            }),
            d.label,
          ],
        }),
      );
    }
  }
  items.push(
    h('span', {
      className: 'cov-marker',
      children: [
        h('span', {
          className: 'cov-swatch cov-swatch-line',
          attrs: { style: `background:${COLOR_EXPENSES}` },
        }),
        'Expenses + debt',
      ],
    }),
  );
  return items;
}

/**
 * Mounts a coverage chart for one of two scenarios.
 *
 * @param {HTMLCanvasElement} canvasEl
 * @param {HTMLElement} legendEl
 * @param {HTMLElement} statusEl - small text element shown above the chart
 * @param {Object} store
 * @param {Object} opts
 * @param {'fire'|'retirement'} opts.startAgeMode
 */
export function mountCoverageChart(canvasEl, legendEl, statusEl, store, opts) {
  let chart = null;
  const startAgeMode = opts.startAgeMode;
  // Wrapper element holding the canvas — used to toggle the empty-state
  // indicator class (.coverage-canvas-empty). Intentionally not the generic
  // .empty class so we don't collide with the existing chart cards.
  const wrap = canvasEl.parentElement;

  function setStatus(text, tone = 'info') {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.dataset.tone = tone;
  }

  function clearChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    if (legendEl) setChildren(legendEl, []);
  }

  function showEmpty(message) {
    clearChart();
    if (wrap) wrap.classList.add('coverage-canvas-empty');
    setStatus(message, 'muted');
  }

  function render() {
    if (typeof window === 'undefined' || !window.Chart) return;
    const state = store.getState();

    if (!state.assets || state.assets.length === 0) {
      showEmpty('Add assets to see how your expenses would be covered.');
      return;
    }

    const startAge = resolveStartAge(state, startAgeMode);
    if (startAge == null) {
      showEmpty(
        startAgeMode === 'fire'
          ? 'FIRE is not achievable within the simulation horizon, so there is nothing to draw down yet.'
          : 'Set your retirement age in the profile to see this chart.',
      );
      return;
    }

    const { trajectory, failedAtAge } = simulateFire(state, {
      startAge,
      horizonAge: HORIZON_AGE,
    });

    const built = buildDatasets(trajectory, startAge);
    if (!built || built.labels.length === 0) {
      showEmpty('Nothing to plot for this scenario yet.');
      return;
    }

    if (wrap) wrap.classList.remove('coverage-canvas-empty');

    const prefix =
      startAgeMode === 'fire'
        ? `FIRE achievable at age ${startAge}.`
        : `Retirement at age ${startAge}.`;
    const suffix =
      failedAtAge != null
        ? ` Drawdown fails at age ${failedAtAge} — projection truncated.`
        : '';
    setStatus(prefix + suffix, failedAtAge != null ? 'warn' : 'info');

    if (legendEl) setChildren(legendEl, legendItemsFromDatasets(built.datasets));

    if (chart) {
      chart.destroy();
      chart = null;
    }

    chart = new window.Chart(canvasEl, {
      data: { labels: built.labels, datasets: built.datasets },
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
            titleFont: {
              family: FONT_FAMILY,
              size: FONT_SIZE_TOOLTIP_TITLE,
              weight: '600',
            },
            bodyFont: { family: FONT_FAMILY, size: FONT_SIZE_TOOLTIP_BODY },
            callbacks: {
              title: (items) => `Age ${items[0].label}`,
              label: (item) =>
                `${item.dataset.label}: ${formatCurrency(item.parsed.y, { digits: 0 })}`,
              footer: (items) => {
                let total = 0;
                for (const it of items) {
                  if (it.dataset.type === 'bar') total += it.parsed.y;
                }
                return `Total coverage: ${formatCurrency(total, { digits: 0 })}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'category',
            stacked: true,
            ticks: {
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_TICKS },
              maxRotation: 0,
              autoSkipPadding: 16,
            },
            grid: { color: COLOR_GRID, drawTicks: false },
            title: {
              display: true,
              text: 'Age',
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_AXIS_TITLE },
            },
          },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_TICKS },
              callback: (v) => formatCurrencyCompact(v),
            },
            grid: { color: COLOR_GRID },
            title: {
              display: true,
              text: 'Yearly amount',
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_AXIS_TITLE },
            },
          },
        },
      },
    });
  }

  whenChartReady(() => {
    render();
    store.subscribe(render);
  });
}
