/**
 * @fileoverview Yearly step for Pension — pure.
 * @module src/engine/steps/pension
 */

/**
 * Computes pension payout for one year.
 * Pension has no stored value; only an income stream once `currentAge ≥ startingAge`.
 *
 * @pure
 * @param {Object} asset - Pension asset
 * @param {Object} ctx - Step context
 * @param {number} ctx.currentAge - User's age in this simulation year
 * @returns {{asset: Object, passiveIncome: number}}
 *
 * @formula
 *   if currentAge < startingAge:  passiveIncome = 0
 *   else:                         passiveIncome = yearlyAmount · (1 + revaluationRate)^(currentAge − startingAge)
 *   asset' = asset   // pension state itself does not change
 *
 * @assumptions
 *   - Pension is paid yearly (no monthly modelling).
 *   - Revaluation compounds each year past `startingAge` regardless of payout receipt.
 *   - Pension is *not* taxed in v1 (yearlyAmount is treated as the net amount).
 *     Users can lower yearlyAmount manually to model net.
 *
 * Cross-reference: see "Pension" in [engine.md](../../../docs/engine.md#pension).
 *
 * @example
 *   const p = createPension({ yearlyAmount: 20000, revaluationRate: 0.02, startingAge: 67 });
 *   stepPension(p, { currentAge: 60 }).passiveIncome // 0
 *   stepPension(p, { currentAge: 67 }).passiveIncome // 20000
 *   stepPension(p, { currentAge: 68 }).passiveIncome // 20400
 */
export function stepPension(asset, ctx) {
  const { currentAge } = ctx;
  if (currentAge < asset.startingAge) {
    return { asset: { ...asset }, passiveIncome: 0 };
  }
  const yearsPaid = currentAge - asset.startingAge;
  const passiveIncome = asset.yearlyAmount * Math.pow(1 + asset.revaluationRate, yearsPaid);
  return { asset: { ...asset }, passiveIncome };
}
