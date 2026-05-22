/**
 * @fileoverview Stats table — projects the Standard scenario across multiple
 * time horizons.
 * @module src/engine/stats
 */

import { simulateStandard } from './simulate.js';

const ASSET_CLASSES = [
  'stocks', 'bonds', 'crypto', 'cash',
  'realEstate', 'privateBusiness', 'pension', 'personalDebt',
];

/**
 * Computes a stats table for the Standard scenario.
 *
 * Rows: one per asset class (sum across all assets of that class), plus
 *   `total` (net worth), `monthlyExpenses`, `yearlyExpenses`, and
 *   `pensionIncome` (yearly pension payout — pensions are an income stream,
 *   not stored capital, so they don't have a meaningful net-worth column).
 * Columns: each entry of `horizons` (in years from now).
 *
 * @pure
 *
 * @param {Object} state
 * @param {Object} [opts]
 * @param {number[]} [opts.horizons=[0,5,10,20]] - Year offsets
 * @returns {{
 *   horizons: number[],
 *   rows: Object<string, number[]>,
 * }}
 *
 * @formula
 *   Run simulateStandard(state, { horizonAge: max(horizons) + age }).
 *   For each year h in horizons:
 *     For each class c (≠ pension): rows[c][i] = trajectory[h].byClass[c] ?? 0
 *     rows.pension[i]          = trajectory[h].pensionIncome ?? 0
 *     rows.pensionIncome[i]    = trajectory[h].pensionIncome ?? 0  (alias)
 *     rows.total[i]            = trajectory[h].netWorth
 *     rows.monthlyExpenses[i]  = inflateExpenses(monthlyExpenses, rate, h)
 *     rows.yearlyExpenses[i]   = monthlyExpenses[i] · 12
 *
 * Cross-reference: see "Stats table semantics" in
 *   [engine.md](../../docs/engine.md#stats-table-semantics).
 */
export function computeStatsTable(state, opts = {}) {
  const horizons = opts.horizons ?? [0, 5, 10, 20];
  const startAge = state.userInfo.age;
  const horizonAge = startAge + Math.max(...horizons);

  const traj = simulateStandard(state, { horizonAge });

  const rows = {};
  for (const cls of ASSET_CLASSES) rows[cls] = [];
  rows.total = [];
  rows.monthlyExpenses = [];
  rows.yearlyExpenses = [];
  rows.pensionIncome = [];

  for (const h of horizons) {
    const yr = traj[h] ?? traj[traj.length - 1];
    for (const cls of ASSET_CLASSES) {
      if (cls === 'pension') {
        // Pension has no net-worth contribution; show its yearly income instead.
        rows[cls].push(yr.pensionIncome ?? 0);
      } else {
        rows[cls].push(yr.byClass[cls] ?? 0);
      }
    }
    rows.pensionIncome.push(yr.pensionIncome ?? 0);
    rows.total.push(yr.netWorth);
    // Use the simulator's `expenses` (= inflated baseline + residence costs)
    // and back-derive monthly = yearly / 12 so the two rows stay consistent.
    const yearly = yr.expenses;
    rows.yearlyExpenses.push(yearly);
    rows.monthlyExpenses.push(yearly / 12);
  }

  return { horizons, rows };
}
