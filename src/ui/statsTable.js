/**
 * @fileoverview Renders the time-horizon stats table from the engine's
 * `computeStatsTable`. Reactive: re-renders on every store change.
 *
 * Columns: Now, +5y, +10y, +20y, +30y, plus a dynamically-inserted
 *   **Retirement** column (the user's `retirementAge` converted to
 *   years-from-now), highlighted with a subtle background tint and a
 *   "Retirement" badge in the header.
 * Rows: one per asset class (only those present in the state), Total,
 *       Monthly expenses, Yearly expenses.
 *
 * Engine usage: only via src/engine/index.js (frozen public API).
 *
 * @module src/ui/statsTable
 */

import { h, setChildren } from './dom.js';
import { formatCurrency } from './format.js';
import { computeStatsTable } from '../engine/index.js';
import { CLASSES } from './classDefs.js';

const BASE_HORIZONS = [0, 5, 10, 20, 30];

/**
 * @param {HTMLElement} mountEl
 * @param {Object} store
 */
export function mountStatsTable(mountEl, store) {
  function render() {
    const state = store.getState();

    // Build the column list. Start from the base horizons and conditionally
    // insert a column for the retirement age (if it falls strictly inside
    // (0, 30] years from now and isn't already a base horizon — otherwise
    // we'd just tag the existing column as "retirement").
    const yearsToRetirement = state.userInfo.retirementAge - state.userInfo.age;
    const retirementInRange = yearsToRetirement > 0 && yearsToRetirement <= 30;
    const retirementAlreadyAColumn = BASE_HORIZONS.includes(yearsToRetirement);

    const horizons = [...BASE_HORIZONS];
    if (retirementInRange && !retirementAlreadyAColumn) {
      horizons.push(yearsToRetirement);
      horizons.sort((a, b) => a - b);
    }

    // Index of the column that represents retirement (for highlighting). null
    // if retirement is out of range (already retired or beyond +30y).
    const retirementColIdx = retirementInRange
      ? horizons.indexOf(yearsToRetirement)
      : -1;

    const stats = computeStatsTable(state, { horizons });
    const presentClasses = state.assets.length > 0
      ? CLASSES.filter((c) => state.assets.some((a) => a.class === c.key))
      : [];

    /** Header label for column index `i`. */
    const colLabel = (i) => {
      const y = horizons[i];
      if (y === 0) return 'Now';
      return `+${y}y`;
    };

    const headerCells = horizons.map((_, i) => {
      const isRetire = i === retirementColIdx;
      return h('th', {
        className: isRetire ? 'retirement-col' : '',
        children: isRetire
          ? [
              h('div', { className: 'th-line', children: colLabel(i) }),
              h('div', {
                className: 'retirement-badge',
                children: `Retirement (age ${state.userInfo.retirementAge})`,
              }),
            ]
          : colLabel(i),
      });
    });

    const headerRow = h('tr', { children: [
      h('th', { children: 'Asset class' }),
      ...headerCells,
    ]});

    /** Build a row of <td>s, marking the retirement column. */
    const dataCells = (values, formatter = (v) => formatCurrency(v ?? 0, { digits: 0 })) =>
      values.map((v, i) => h('td', {
        className: i === retirementColIdx ? 'retirement-col' : '',
        children: formatter(v),
      }));

    // Per-class rows (only classes that exist in state). Pension is a
    // special case: it has no stored value; we show its yearly income
    // instead, and label the row to make that clear.
    const classRows = presentClasses.map((cls) => {
      const label = cls.key === 'pension' ? 'Pension (yearly income)' : cls.label;
      return h('tr', { children: [
        h('td', { children: label }),
        ...dataCells(stats.rows[cls.key]),
      ]});
    });

    const totalRow = h('tr', { className: 'total-row', children: [
      h('td', { children: 'Total net worth' }),
      ...dataCells(stats.rows.total),
    ]});

    const monthlyRow = h('tr', { children: [
      h('td', { children: 'Monthly expenses' }),
      ...dataCells(stats.rows.monthlyExpenses),
    ]});

    const yearlyRow = h('tr', { children: [
      h('td', { children: 'Yearly expenses' }),
      ...dataCells(stats.rows.yearlyExpenses),
    ]});

    const empty = state.assets.length === 0;

    if (empty) {
      setChildren(mountEl, [
        h('p', { className: 'stats-empty', children: 'Add assets to see projections over time.' }),
      ]);
      return;
    }

    const table = h('table', { children: [
      h('thead', { children: headerRow }),
      h('tbody', { children: [
        ...classRows,
        totalRow,
        monthlyRow,
        yearlyRow,
      ]}),
    ]});
    setChildren(mountEl, [table]);
  }

  render();
  store.subscribe(render);
}
