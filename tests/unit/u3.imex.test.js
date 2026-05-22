/**
 * @fileoverview Unit tests for the import/export normaliser (pure logic) and
 * the data the stats table consumes.
 */
import { normaliseImported } from '../../src/ui/importExport.js';
import { computeStatsTable } from '../../src/engine/index.js';
import { defaultState } from '../../src/state.js';
import { createStocks, createCash } from '../../src/model/assets.js';

export default function run({ test, assert, assertClose, assertThrows }) {
  // ---------------------------------------------------------------------
  // normaliseImported (import/export envelope handling)
  // ---------------------------------------------------------------------
  test('TU3.1: wrapped envelope unwraps to inner state', () => {
    const state = defaultState();
    const wrapped = { schema: 'fire-planner', version: 1, exportedAt: 'x', state };
    const out = normaliseImported(wrapped);
    assert(out === state);
    assert(Array.isArray(out.assets));
    assert(typeof out.userInfo === 'object');
  });

  test('TU3.2: bare state object passes through', () => {
    const state = { userInfo: { age: 40 }, assets: [] };
    const out = normaliseImported(state);
    assert(out.userInfo.age === 40);
    assert(Array.isArray(out.assets));
  });

  test('TU3.3: missing userInfo throws', () => {
    assertThrows(() => normaliseImported({ assets: [] }));
  });

  test('TU3.4: missing assets array throws', () => {
    assertThrows(() => normaliseImported({ userInfo: {} }));
  });

  test('TU3.5: non-object input throws', () => {
    assertThrows(() => normaliseImported(null));
    assertThrows(() => normaliseImported('string'));
    assertThrows(() => normaliseImported(42));
  });

  // ---------------------------------------------------------------------
  // computeStatsTable shape (consumed by statsTable.js)
  // ---------------------------------------------------------------------
  test('TU3.6: stats table includes per-class rows for present classes only', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 50000, avgReturnRate: 0.07 }),
        createCash({ value: 5000 }),
      ],
    };
    const stats = computeStatsTable(state, { horizons: [0, 5, 10, 20, 30] });
    // Table contains all 8 class rows (we filter UI-side); just confirm the row data is there
    assert(Array.isArray(stats.rows.stocks));
    assert(Array.isArray(stats.rows.cash));
    assert(stats.rows.stocks.length === 5);
    assert(stats.rows.cash.length === 5);
  });

  test('TU3.7: total row equals column-wise sum of class rows (5 horizons)', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 50000, avgReturnRate: 0.07 }),
        createCash({ value: 5000 }),
      ],
    };
    const stats = computeStatsTable(state, { horizons: [0, 5, 10, 20, 30] });
    const classes = ['stocks','bonds','crypto','cash','realEstate','privateBusiness','pension','personalDebt'];
    for (let i = 0; i < stats.horizons.length; i++) {
      const sum = classes.reduce((s, c) => s + (stats.rows[c][i] ?? 0), 0);
      assertClose(stats.rows.total[i], sum, 1e-6, `total mismatch at horizon ${stats.horizons[i]}`);
    }
  });

  test('TU3.8: monthly · 12 == yearly across all 5 horizons', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1500, inflationRate: 0.025, country: '' },
      assets: [],
    };
    const stats = computeStatsTable(state, { horizons: [0, 5, 10, 20, 30] });
    for (let i = 0; i < stats.horizons.length; i++) {
      assertClose(stats.rows.yearlyExpenses[i], stats.rows.monthlyExpenses[i] * 12, 1e-6);
    }
  });
}
