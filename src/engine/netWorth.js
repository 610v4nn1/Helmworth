/**
 * @fileoverview Net worth aggregation across all assets.
 * @module src/engine/netWorth
 */

import { assetNetValue } from '../model/assets.js';

/**
 * Computes total net worth as the sum of per-asset net values.
 *
 * @pure
 * @param {Array} assets - List of assets
 * @returns {number} Net worth (positive assets − debts − mortgages)
 *
 * @formula
 *   netWorth = Σ assetNetValue(a)   for a in assets
 *
 *   Per-class assetNetValue:
 *     stocks/bonds/crypto: Σ lot.value
 *     cash:                value
 *     realEstate:          value − mortgageBalance
 *     privateBusiness:     value
 *     pension:             0
 *     personalDebt:        −balance
 *
 * Cross-reference: see "Net worth" in
 *   [engine.md](../../docs/engine.md#net-worth-definition).
 *
 * @example
 *   const stocks = createStocks({ value: 100000 });
 *   const cash   = createCash({ value: 5000 });
 *   const debt   = createPersonalDebt({ balance: 10000 });
 *   const re     = createRealEstate({ value: 300000, mortgageBalance: 100000 });
 *   computeNetWorth([stocks, cash, debt, re]) // 100000 + 5000 − 10000 + 200000 = 295000
 */
export function computeNetWorth(assets) {
  return assets.reduce((sum, a) => sum + assetNetValue(a), 0);
}

/**
 * Computes net worth broken down by asset class.
 *
 * @pure
 * @param {Array} assets - List of assets
 * @returns {Object<string, number>} { stocks: ..., bonds: ..., ... }
 */
export function computeNetWorthByClass(assets) {
  const byClass = {};
  for (const a of assets) {
    byClass[a.class] = (byClass[a.class] || 0) + assetNetValue(a);
  }
  return byClass;
}
