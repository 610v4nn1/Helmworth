/**
 * @fileoverview Unit tests for Milestone C4 — Stats table.
 * Covers TC4.26–TC4.28.
 */
import { computeStatsTable } from '../../src/engine/stats.js';
import { createStocks } from '../../src/model/assets.js';

export default function run({ test, assert, assertClose }) {
  test('TC4.26: stocks 100k @ 7% → row [100000, 140255.17, 196715.14, 386968.45]', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 2000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 100000, avgReturnRate: 0.07, yearlyContribution: 0 })],
    };
    const stats = computeStatsTable(state, { horizons: [0, 5, 10, 20] });
    assertClose(stats.rows.stocks[0], 100000, 0.5);
    assertClose(stats.rows.stocks[1], 140255.17, 0.5);
    assertClose(stats.rows.stocks[2], 196715.14, 0.5);
    assertClose(stats.rows.stocks[3], 386968.45, 0.5);
  });

  test('TC4.27: monthly expenses [2000, 2208.16, 2437.99, 2971.89]; yearly = monthly · 12', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 2000, inflationRate: 0.02, country: '' },
      assets: [],
    };
    const stats = computeStatsTable(state, { horizons: [0, 5, 10, 20] });
    assertClose(stats.rows.monthlyExpenses[0], 2000, 0.01);
    assertClose(stats.rows.monthlyExpenses[1], 2208.16, 0.05);
    assertClose(stats.rows.monthlyExpenses[2], 2437.99, 0.05);
    assertClose(stats.rows.monthlyExpenses[3], 2971.89, 0.05);
    for (let i = 0; i < 4; i++) {
      assertClose(stats.rows.yearlyExpenses[i], stats.rows.monthlyExpenses[i] * 12, 1e-6);
    }
  });

  test('TC4.28: total row = column-wise sum of class rows', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 50000, avgReturnRate: 0.07, yearlyContribution: 1000 }),
        createStocks({ value: 30000, avgReturnRate: 0.05, yearlyContribution: 500 }),
      ],
    };
    const stats = computeStatsTable(state, { horizons: [0, 5, 10] });
    const classes = ['stocks','bonds','crypto','cash','realEstate','privateBusiness','pension','personalDebt'];
    for (let i = 0; i < stats.horizons.length; i++) {
      const sum = classes.reduce((s, c) => s + (stats.rows[c][i] ?? 0), 0);
      assertClose(stats.rows.total[i], sum, 1e-6, `total at horizon ${stats.horizons[i]}`);
    }
  });
}
