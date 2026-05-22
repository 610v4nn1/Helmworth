/**
 * @fileoverview Yearly step for Crypto — pure.
 * @module src/engine/steps/crypto
 */

/**
 * Advances a Crypto asset by one year. Mathematically identical to stocks,
 * kept as a separate function for clarity and class-specific extension later.
 *
 * @pure
 * @param {Object} asset - Crypto asset
 * @param {Object} ctx - Step context
 * @param {number} ctx.year - Current simulation year
 * @param {boolean} [ctx.applyContribution=true]
 * @returns {{asset: Object, passiveIncome: number}}
 *
 * @formula
 *   For each lot: lot.value' = lot.value · (1 + avgReturnRate)
 *   If applyContribution and yearlyContribution > 0:
 *     newLot = { value: yearlyContribution, costBasis: yearlyContribution, year: ctx.year }
 *   passiveIncome = 0
 *
 * @assumptions Crypto pays no income in v1 (no staking rewards modelled).
 *
 * Cross-reference: see "Crypto" in [engine.md](../../../docs/engine.md#crypto).
 */
export function stepCrypto(asset, ctx) {
  const applyContribution = ctx.applyContribution !== false;
  const grownLots = asset.lots.map((lot) => ({
    value: lot.value * (1 + asset.avgReturnRate),
    costBasis: lot.costBasis,
    year: lot.year,
  }));

  if (applyContribution && asset.yearlyContribution > 0) {
    grownLots.push({
      value: asset.yearlyContribution,
      costBasis: asset.yearlyContribution,
      year: ctx.year,
    });
  }

  return {
    asset: { ...asset, lots: grownLots },
    passiveIncome: 0,
  };
}
