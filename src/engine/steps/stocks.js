/**
 * @fileoverview Yearly step for Stocks — pure.
 * @module src/engine/steps/stocks
 */

/**
 * Advances a Stocks asset by one year.
 *
 * @pure
 * @param {Object} asset - Stocks asset (see src/model/assets.js)
 * @param {Object} ctx - Step context
 * @param {number} ctx.year - Current simulation year (0 = start)
 * @param {boolean} [ctx.applyContribution=true] - Whether to add the yearly contribution
 *   (Standard scenario: true; Coast FIRE / FIRE: false)
 * @returns {{asset: Object, passiveIncome: number}} New asset state and passive income (always 0)
 *
 * @formula
 *   For each existing lot:
 *     lot.value' = lot.value · (1 + avgReturnRate)
 *     lot.costBasis' = lot.costBasis    // unchanged
 *     lot.year' = lot.year              // unchanged
 *
 *   If applyContribution and yearlyContribution > 0:
 *     newLot = { value: yearlyContribution,
 *                costBasis: yearlyContribution,
 *                year: ctx.year }
 *
 *   passiveIncome = 0   // dividends not modelled separately in v1
 *
 * @assumptions
 *   - Stocks pay no separate dividends in v1; gains realized only on sale.
 *   - The new contribution lot is added at year-end at par (cost basis = value).
 *
 * Cross-reference: see "Stocks" in [engine.md](../../../docs/engine.md#stocks).
 *
 * @example
 *   const a = createStocks({ value: 10000, avgReturnRate: 0.10, yearlyContribution: 1000 });
 *   const { asset, passiveIncome } = stepStocks(a, { year: 1 });
 *   // asset.lots[0].value === 11000, asset.lots[1] === { value:1000, costBasis:1000, year:1 }
 *   // passiveIncome === 0
 */
export function stepStocks(asset, ctx) {
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
