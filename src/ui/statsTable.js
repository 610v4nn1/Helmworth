/**
 * @fileoverview Renders the time-horizon stats table from the engine's
 * `computeStatsTable`. Reactive: re-renders on every store change.
 *
 * Columns: Now, +5y, +10y, +20y, +30y.
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

const HORIZONS = [0, 5, 10, 20, 30];

/**
 * @param {HTMLElement} mountEl
 * @param {Object} store
 */
export function mountStatsTable(mountEl, store) {
  function render() {
    const state = store.getState();
    const stats = computeStatsTable(state, { horizons: HORIZONS });
    const presentClasses = state.assets.length > 0
      ? CLASSES.filter((c) => state.assets.some((a) => a.class === c.key))
      : [];

    const headerRow = h('tr', { children: [
      h('th', { children: 'Asset class' }),
      ...HORIZONS.map((y) => h('th', { children: y === 0 ? 'Now' : `+${y}y` })),
    ]});

    // Per-class rows (only classes that exist in state)
    const classRows = presentClasses.map((cls) =>
      h('tr', { children: [
        h('td', { children: cls.label }),
        ...HORIZONS.map((_, i) =>
          h('td', { children: formatCurrency(stats.rows[cls.key][i] ?? 0, { digits: 0 }) })
        ),
      ]})
    );

    const totalRow = h('tr', { className: 'total-row', children: [
      h('td', { children: 'Total net worth' }),
      ...HORIZONS.map((_, i) =>
        h('td', { children: formatCurrency(stats.rows.total[i], { digits: 0 }) })
      ),
    ]});

    const monthlyRow = h('tr', { children: [
      h('td', { children: 'Monthly expenses' }),
      ...HORIZONS.map((_, i) =>
        h('td', { children: formatCurrency(stats.rows.monthlyExpenses[i], { digits: 0 }) })
      ),
    ]});

    const yearlyRow = h('tr', { children: [
      h('td', { children: 'Yearly expenses' }),
      ...HORIZONS.map((_, i) =>
        h('td', { children: formatCurrency(stats.rows.yearlyExpenses[i], { digits: 0 }) })
      ),
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
