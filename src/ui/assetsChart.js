/**
 * @fileoverview Renders a multi-line chart showing the projected value of
 * each asset class over time (Standard scenario), displayed below the
 * stats table.
 *
 * X-axis: years from now (0 .. 30, matching the stats table horizon).
 * Y-axis: value in currency. Each asset class is its own line.
 *
 * Engine usage: only via `src/engine/index.js` (the frozen public API).
 *
 * @module src/ui/assetsChart
 */

import { setChildren, h } from './dom.js';
import { formatCurrency, formatCurrencyCompact } from './format.js';
import { simulateStandard } from '../engine/index.js';
import { CLASSES } from './classDefs.js';
import { mountYearRangeControl } from './yearRangeControl.js';

const HORIZON_YEARS = 30;

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

// Colors mirror the per-class palette in styles.css (--class-*).
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

const COLOR_GRID  = 'rgba(0, 0, 0, 0.08)';
const COLOR_TICKS = 'rgba(0, 0, 0, 0.62)';
const COLOR_RETIRE = '#5b6573'; // neutral slate — same as projections chart

// Match font size used for the per-marker label on the projections chart.
const FONT_SIZE_MARKER_LABEL = 12;

/**
 * Mounts the per-asset-class projection chart and wires it to the store.
 * @param {HTMLCanvasElement} canvasEl - <canvas> for Chart.js
 * @param {HTMLElement} legendEl - container for the textual legend
 * @param {Object} store
 * @param {HTMLElement} [rangeEl] - container for the year-range zoom control
 */
export function mountAssetsChart(canvasEl, legendEl, store, rangeEl) {
  /** @type {any} Chart.js instance */
  let chart = null;

  /** @type {import('./yearRangeControl.js').YearRangeControl|null} */
  let rangeCtrl = null;
  let lastAbsMinYear = null;
  let lastAbsMaxYear = null;

  function whenChartReady(cb) {
    if (typeof window !== 'undefined' && window.Chart) return cb();
    let tries = 0;
    const tick = () => {
      if (window.Chart) return cb();
      if (tries++ < 100) return setTimeout(tick, 50);
    };
    tick();
  }

  function buildDatasets(state) {
    const startAge = state.userInfo.age;
    const traj = simulateStandard(state, { horizonAge: startAge + HORIZON_YEARS });

    const labels = traj.map((r) => r.year); // 0 .. HORIZON_YEARS

    // Only include classes the user actually has assets in (keeps the chart legible).
    const presentClasses = CLASSES.filter((c) =>
      state.assets.some((a) => a.class === c.key),
    );

    const datasets = presentClasses.map((cls) => {
      const color = CLASS_COLORS[cls.key] || '#666';
      return {
        label: cls.label,
        data: traj.map((r) => r.byClass[cls.key] ?? 0),
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.15,
        fill: false,
      };
    });

    return { labels, datasets, presentClasses };
  }

  function renderLegend(presentClasses, retirementInfo) {
    const items = presentClasses.map((cls) =>
      h('span', {
        className: 'marker',
        attrs: { style: `color:${CLASS_COLORS[cls.key] || '#666'}` },
        children: cls.label,
      }),
    );
    if (retirementInfo) {
      items.push(
        h('span', {
          className: 'marker',
          attrs: { style: `color:${COLOR_RETIRE}` },
          children: `Retirement at age ${retirementInfo.retirementAge}`,
        }),
      );
    }
    setChildren(legendEl, items);
  }

  /**
   * Vertical-line plugin that draws a marker on the "years from now" x-axis
   * at the user's retirement age, converted to years-from-now via
   * `yearsFromNow = retirementAge - currentAge`. Skipped when the retirement
   * age is in the past (≤ currentAge — already retired) or beyond the
   * chart's horizon, since neither case yields a meaningful future marker.
   */
  function retirementVlinePlugin(yearsFromNow, retirementAge) {
    return {
      id: 'retirementMarker',
      afterDraw(chartInst) {
        if (yearsFromNow == null) return;
        const { ctx, chartArea, scales } = chartInst;
        if (!scales.x) return;
        const x = scales.x.getPixelForValue(yearsFromNow);
        if (x < chartArea.left || x > chartArea.right) return;
        ctx.save();
        ctx.strokeStyle = COLOR_RETIRE;
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, chartArea.top);
        ctx.lineTo(x, chartArea.bottom);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLOR_RETIRE;
        ctx.font = `${FONT_SIZE_MARKER_LABEL}px ${FONT_FAMILY}`;
        ctx.textAlign = 'left';
        ctx.fillText(`Retirement (${retirementAge})`, x + 4, chartArea.top + 12);
        ctx.restore();
      },
    };
  }

  function render() {
    if (typeof window === 'undefined' || !window.Chart) return;
    const state = store.getState();
    const wrap = canvasEl.parentElement;

    if (!state.assets || state.assets.length === 0) {
      if (chart) {
        chart.destroy();
        chart = null;
      }
      if (wrap) wrap.classList.add('empty');
      setChildren(legendEl, []);
      if (rangeEl) setChildren(rangeEl, []);
      rangeCtrl = null;
      lastAbsMinYear = null;
      lastAbsMaxYear = null;
      return;
    }
    if (wrap) wrap.classList.remove('empty');

    const { labels, datasets, presentClasses } = buildDatasets(state);

    // Retirement marker: convert userInfo.retirementAge -> yearsFromNow.
    // Skip if it falls outside the chart's [0, HORIZON_YEARS] window.
    const retirementAge = state.userInfo.retirementAge;
    const retirementYearsFromNow = retirementAge - state.userInfo.age;
    const retirementInfo =
      retirementYearsFromNow >= 0 && retirementYearsFromNow <= HORIZON_YEARS
        ? { retirementAge, yearsFromNow: retirementYearsFromNow }
        : null;

    renderLegend(presentClasses, retirementInfo);

    // Year-range zoom control. The chart's x-axis is "years from now"
    // (0..HORIZON_YEARS); we surface it to the user as calendar years.
    const currentCalendarYear = new Date().getFullYear();
    const absMinYear = currentCalendarYear;
    const absMaxYear = currentCalendarYear + HORIZON_YEARS;

    if (rangeEl) {
      if (
        !rangeCtrl ||
        absMinYear !== lastAbsMinYear ||
        absMaxYear !== lastAbsMaxYear
      ) {
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

    const sel = rangeCtrl ? rangeCtrl.getRange() : { min: absMinYear, max: absMaxYear };
    const xMin = sel.min - currentCalendarYear; // years-from-now
    const xMax = sel.max - currentCalendarYear;

    if (chart) {
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
              title: (items) => {
                const yr = Number(items[0].label);
                return yr === 0 ? 'Now' : `+${yr}y`;
              },
              label: (item) =>
                `${item.dataset.label}: ${formatCurrency(item.parsed.y, { digits: 0 })}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: xMin,
            max: xMax,
            ticks: {
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_TICKS },
              callback: (v) => (v === 0 ? 'Now' : `+${v}y`),
            },
            grid: { color: COLOR_GRID, drawTicks: false },
            title: {
              display: true,
              text: 'Years from now',
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
              text: 'Value',
              color: COLOR_TICKS,
              font: { family: FONT_FAMILY, size: FONT_SIZE_AXIS_TITLE },
            },
          },
        },
      },
      plugins: retirementInfo
        ? [retirementVlinePlugin(retirementInfo.yearsFromNow, retirementInfo.retirementAge)]
        : [],
    });
  }

  whenChartReady(() => {
    render();
    store.subscribe(render);
  });
}
