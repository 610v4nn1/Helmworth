/**
 * @fileoverview Yearly step for Private Business — pure.
 * @module src/engine/steps/privateBusiness
 */

/**
 * Advances a Private Business asset by one year.
 *
 * @pure
 * @param {Object} asset - Private business asset
 * @param {Object} _ctx - Step context (ignored)
 * @returns {{asset: Object, passiveIncome: number}}
 *
 * @formula
 *   value'          = value · (1 + valueGrowthRate)
 *   yearlyDividend' = yearlyDividend · (1 + dividendGrowthRate)
 *   passiveIncome   = yearlyDividend · (1 − dividendTaxRate)
 *
 *   Note: passiveIncome uses the OLD (pre-growth) dividend, paid for the year
 *   that just ended. The new dividend will be used next year.
 *
 * @assumptions
 *   - Dividend grows after being paid (so the next year's dividend is higher).
 *   - Valuation growth and dividend growth are independent.
 *
 * Cross-reference: see "Private business" in
 *   [engine.md](../../../docs/engine.md#private-business).
 *
 * @example
 *   const pb = createPrivateBusiness({
 *     value: 200000, valueGrowthRate: 0.05,
 *     yearlyDividend: 10000, dividendGrowthRate: 0.03, dividendTaxRate: 0.26,
 *   });
 *   const { asset: a1, passiveIncome: pi1 } = stepPrivateBusiness(pb, {});
 *   // pi1 = 10000 · (1 − 0.26) = 7400
 *   // a1.value = 210000, a1.yearlyDividend = 10300
 */
export function stepPrivateBusiness(asset, _ctx) {
  const passiveIncome = asset.yearlyDividend * (1 - asset.dividendTaxRate);
  const newValue = asset.value * (1 + asset.valueGrowthRate);
  const newDividend = asset.yearlyDividend * (1 + asset.dividendGrowthRate);

  return {
    asset: { ...asset, value: newValue, yearlyDividend: newDividend },
    passiveIncome,
  };
}
