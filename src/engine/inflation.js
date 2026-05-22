/**
 * @fileoverview Inflation helpers — pure, no side effects.
 * @module src/engine/inflation
 */

/**
 * Inflates a present-day expense to its value `years` from now.
 *
 * @pure
 * @param {number} monthly - Today's monthly expense (currency)
 * @param {number} rate - Yearly inflation as a decimal (0.02 = 2%)
 * @param {number} years - Whole-year horizon (0 = today)
 * @returns {number} Inflated monthly expense
 *
 * @formula
 *   inflated = monthly · (1 + rate)^years
 *
 * Cross-reference: see "Inflation" in [engine.md](../../docs/engine.md#inflation).
 *
 * @example
 *   inflateExpenses(1000, 0.02, 0)  // 1000
 *   inflateExpenses(1000, 0.02, 10) // ≈ 1218.99
 *   inflateExpenses(1000, 0,    50) // 1000
 */
export function inflateExpenses(monthly, rate, years) {
  return monthly * Math.pow(1 + rate, years);
}
