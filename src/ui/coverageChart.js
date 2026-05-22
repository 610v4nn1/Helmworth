/**
 * @fileoverview Renders a stacked-bar "coverage" chart showing how each
 * year's expenses + debt payments are covered, decomposed by source:
 *
 *   - Passive income, per asset class (bonds yield, real-estate cash flow,
 *     private-business dividends, pension).
 *   - Drawdown, per liquid asset class (cash drained, stocks/bonds/crypto
 *     sold via HIFO).
 *
 * A black line overlay shows the corresponding expenses + debt payments for
 * the year, so the user can see at a glance how each contribution slice
 * combines to cover the bar.
 *
 * Two instances are mounted on the home page, both using `simulateFire`:
 *   - FIRE coverage:        startAge = findFireAge(state)
 *   - Retirement coverage:  startAge = userInfo.retirementAge
 *
 * Engine usage: only via `src/engine/index.js` (the frozen public API).
 *
 * @module src/ui/coverageChart
 */

import { setChildren, h } from './dom.js';
import { formatCurrency, formatCurrencyCompact } from './format.js';
import { simulateFire, findFireAge } from '../engine/index.js';
import { CLASSES } from './classDefs.js';

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

// Mirrors --class-* tokens in styles.css so this chart visually rhymes with
// the asset-list chips and the per-class assets chart.
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

/**
 * Source kinds shown in the stacked bar. The order here is also the rendering
 * order: passive-income slices stack first (closest to the x-axis), drawdown
 * slices stack on top — so the user reads "what comes in for free" before
 * "what we had to sell".
 */
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

/**
 * Wait until window.Chart (CDN, deferred) is available before first render.
 * Polls every 50ms with a 5s ceiling.
 */
function whenChartReady(cb) {
  if (typeof window !== 'undefined' && window.Chart) return cb();
  let tries = 0;
  const tick = () => {
    if (window.Chart) return cb();
    if (tries++ < 100) return setTimeout(tick, 50);
  };
  tick();
}

/**
 * Resolve the start age for the chart's filter window, given a `startAgeMode`.
 * Returns null if the user can't ever start (e.g. FIRE not feasible).
 */
function resolveStartAge(state, startAgeMode) {
  if (startAgeMode === 'fire') {
    return findFireAge(state, { horizonAge: HORIZON_AGE });
  }
  if (startAgeMode === 'retirement') {
    return state.userInfo.retirementAge ?? null;
  }
  return null;
}

/**
 * Build datasets for Chart.js from a FIRE trajectory.
 *
 * Each "passive" class becomes one stacked dataset on `stackId='cov'`; each
 * "drawdown" class becomes another. We always include the same set of
 * datasets (in the same order) so legend / colors are stable across renders;
 * datasets that are zero everywhere render an empty bar contribution and are
 * filtered from the legend.
 *
 * Years: index by absolute age (e.g. 50, 51, 52 …) starting at `startAge`
 * and going to HORIZON_AGE (or to `failedAtAge`, exclusive of one extra
 * year so the truncation is honest).
 */
function buildDatasets(trajectory, startAge) {
  // Slice trajectory to years where the chart is meaningful: from startAge
  // onwards (the bar at year=startAge is the first year of decumulation —
  // but in simulateFire, decumulation begins when currentAge >= startAge,
  // i.e. the year following y where age == startAge).
  // Practically: find the first index i with traj[i].age >= startAge.
  const startIdx = trajectory.findIndex((r) => r.age >= startAge);
  if (startIdx < 0) return null;
  const slice = trajectory.slice(startIdx);

  const labels = slice.map((r) => r.age);

  // Helpers: extract a per-year column for a (kind, class) pair.
  const passiveCol = (cls) => slice.map((r) => (r.passiveByClass?.[cls] ?? 0));
  const drawCol    = (cls) => slice.map((r) => (r.drawnByClass?.[cls]    ?? 0));

  const datasets = [];

  // Passive datasets first (bottom of the stack).
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

  // Drawdown datasets (top of the stack). Use a hatched feel via reduced
  // opacity so the user can visually tell "income" vs "selling".
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
      // Diagonal "sold" pattern in the legend swatch via dashed border:
      borderDash: [3, 3],
      stack: 'cov',
      _kind: 'drawdown',
      _class: cls,
    });
  }

  // Expenses overlay line (expenses + debt payments — i.e. the actual
  // shortfall target the engine tries to cover).
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
    // line shouldn't affect the bar stack
    stack: 'expenses',
    yAxisID: 'y',
    order: 0, // draw on top
  });

  return { labels, datasets, slice };
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function legendItemsFromDatasets(datasets) {
  const items = [];
  // Passive group
  const passive = datasets.filter((d) => d._kind === 'passive');
  if (passive.length) {
    items.push(h('span', { className: 'cov-legend-group', children: 'Passive income:' }));
    for (const d of passive) {
      items.push(
        h('span', {
          className: 'marker cov-marker',
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
  // Drawdown group
  const drawdown = datasets.filter((d) => d._kind === 'drawdown');
  if (drawdown.length) {
    items.push(h('span', { className: 'cov-legend-group', children: 'From drawdown:' }));
    for (const d of drawdown) {
      items.push(
        h('span', {
          className: 'marker cov-marker',
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
  // Expenses
  items.push(
    h('span', {
      className: 'marker cov-marker',
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
 *   ("FIRE achievable at age X" / "Retirement at age X" / empty-state hint)
 * @param {Object} store
 * @param {Object} opts
 * @param {'fire'|'retirement'} opts.startAgeMode
 */
export function mountCoverageChart(canvasEl, legendEl, statusEl, store, opts) {
  let chart = null;
  const startAgeMode = opts.startAgeMode;

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
    const wrap = canvasEl.parentElement;
    if (wrap) wrap.classList.add('empty');
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

    // Always simulate FIRE — for the retirement chart, "FIRE startAge" is
    // simply the user's retirement age, which makes simulateFire emit the
    // exact decumulation arithmetic we want.
    const { trajectory, failedAtAge } = simulateFire(state, {
      startAge,
      horizonAge: HORIZON_AGE,
    });

    const built = buildDatasets(trajectory, startAge);
    if (!built || built.labels.length === 0) {
      showEmpty('Nothing to plot for this scenario yet.');
      return;
    }

    const wrap = canvasEl.parentElement;
    if (wrap) wrap.classList.remove('empty');

    // Status line: prefix depends on the mode; suffix surfaces failure.
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
                // Show the stacked total of "coverage" datasets (passive + drawdown)
                // so the user can compare it against the expenses line at a glance.
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
