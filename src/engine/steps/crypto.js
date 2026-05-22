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
 *   c_y = yearlyContribution · (1 + contributionGrowthRate)^year
 *   If applyContribution and c_y > 0:
 *     newLot = { value: c_y, costBasis: c_y, year: ctx.year }
 *   passiveIncome = 0
 *
 * @assumptions Crypto pays no income in v1 (no staking rewards modelled).
 *   `contributionGrowthRate` defaults to 0, matching the previous flat-
 *   contribution behaviour.
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

  const g = asset.contributionGrowthRate ?? 0;
  const cy = asset.yearlyContribution * Math.pow(1 + g, ctx.year);
  if (applyContribution && cy > 0) {
    grownLots.push({
      value: cy,
      costBasis: cy,
      year: ctx.year,
    });
  }

  return {
    asset: { ...asset, lots: grownLots },
    passiveIncome: 0,
  };
}
