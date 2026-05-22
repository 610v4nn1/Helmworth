/**
 * @fileoverview Yearly step for Bonds — pure.
 * @module src/engine/steps/bonds
 */

/**
 * Advances a Bonds asset by one year.
 *
 * @pure
 * @param {Object} asset - Bonds asset (see src/model/assets.js)
 * @param {Object} ctx - Step context
 * @param {number} ctx.year - Current simulation year
 * @param {boolean} [ctx.applyContribution=true] - Whether to add the yearly contribution
 * @returns {{asset: Object, passiveIncome: number}} New asset state and after-tax yield income
 *
 * @formula
 *   For each lot:
 *     lot.value'      = lot.value          // v1: principal stays flat
 *     lot.costBasis'  = lot.costBasis
 *     lot.year'       = lot.year
 *
 *   c_y = yearlyContribution · (1 + contributionGrowthRate)^year
 *
 *   If applyContribution and c_y > 0:
 *     newLot = { value: c_y,
 *                costBasis: c_y,
 *                year: ctx.year }
 *
 *   passiveIncome = totalValue · y · (1 − t)
 *   (totalValue is the pre-contribution sum of lot.value, so the new
 *    contribution doesn't pay yield in the year it's added.)
 *
 * @assumptions
 *   - Bond principal is treated as flat in v1 (no appreciation modelled).
 *   - Yield is paid out as cash each year (not reinvested into the asset).
 *   - Yield tax is applied per-year at `yieldTaxRate`.
 *   - `contributionGrowthRate` defaults to 0, reproducing the previous flat
 *     contribution behaviour.
 *
 * Cross-reference: see "Bonds" in [engine.md](../../../docs/engine.md#bonds).
 *
 * @example
 *   const b = createBonds({ value: 100000, yieldRate: 0.04, yieldTaxRate: 0.20 });
 *   const { asset, passiveIncome } = stepBonds(b, { year: 1 });
 *   // asset.lots[0].value === 100000  (flat)
 *   // passiveIncome === 100000 · 0.04 · (1 − 0.20) === 3200
 */
export function stepBonds(asset, ctx) {
  const applyContribution = ctx.applyContribution !== false;
  // Compute yield BEFORE adding new contribution (the new lot doesn't pay this year)
  const totalValue = asset.lots.reduce((s, l) => s + l.value, 0);
  const passiveIncome = totalValue * asset.yieldRate * (1 - asset.yieldTaxRate);

  // Principal flat (v1) — clone lots
  const lots = asset.lots.map((lot) => ({
    value: lot.value,
    costBasis: lot.costBasis,
    year: lot.year,
  }));

  const g = asset.contributionGrowthRate ?? 0;
  const cy = asset.yearlyContribution * Math.pow(1 + g, ctx.year);
  if (applyContribution && cy > 0) {
    lots.push({
      value: cy,
      costBasis: cy,
      year: ctx.year,
    });
  }

  return {
    asset: { ...asset, lots },
    passiveIncome,
  };
}
