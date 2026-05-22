/**
 * @fileoverview Yearly step for Real Estate — pure.
 *
 * Two property kinds:
 *   - `'investment'`: yearly user-supplied `cashFlow` becomes passive income
 *     (rent − costs − interest − tax, already netted by the user).
 *   - `'residence'`: no cash flow; `yearlyCosts` is reported as an extra
 *     expense for the year (added to the simulation's yearly expenses).
 *
 * Both kinds: value appreciates and the mortgage balance is reduced by a
 * yearly repayment expressed as a fraction of the outstanding balance
 * (no interest accrual — the planner doesn't model mortgage interest
 * separately).
 *
 * @module src/engine/steps/realEstate
 */

/**
 * Advances a Real Estate asset by one year.
 *
 * @pure
 * @param {Object} asset - Real estate asset
 * @param {Object} _ctx - Step context (year not needed; sales handled outside)
 * @returns {{asset: Object, passiveIncome: number, extraExpense: number}}
 *   `passiveIncome` is the year's cash flow contribution (investment only;
 *   0 for residence). `extraExpense` is the year's added expense
 *   (residence only; 0 for investment).
 *
 * @formula
 *   value'           = value · (1 + appreciationRate)
 *   mortgageBalance' = max(0, mortgageBalance · (1 − mortgageRepaymentRate))
 *
 *   if propertyKind === 'investment':
 *     passiveIncome = cashFlow      // user-supplied; can be negative
 *     extraExpense  = 0
 *   else if propertyKind === 'residence':
 *     passiveIncome = 0
 *     extraExpense  = yearlyCosts
 *
 * @assumptions
 *   - The mortgage has no interest rate — a fixed *fraction* of the balance
 *     is repaid each year (e.g. 1.5%). Any interest the user actually pays
 *     on an investment property is already folded into `cashFlow` by the user.
 *   - Cash flow is a flat yearly figure; it does not grow with rent indexation
 *     in v1 (the user may revise the asset to reflect new conditions).
 *
 * Cross-reference: see "Real estate" in
 *   [engine.md](../../../docs/engine.md#real-estate).
 *
 * @example
 *   const inv = createRealEstate({
 *     propertyKind: 'investment',
 *     value: 300000, appreciationRate: 0.03,
 *     mortgageBalance: 100000, mortgageRepaymentRate: 0.05,
 *     cashFlow: 6000,
 *   });
 *   const r = stepRealEstate(inv, {});
 *   // r.asset.value === 309000
 *   // r.asset.mortgageBalance === 95000   (100000 · (1 − 0.05))
 *   // r.passiveIncome === 6000, r.extraExpense === 0
 *
 *   const home = createRealEstate({
 *     propertyKind: 'residence',
 *     value: 400000, appreciationRate: 0.02,
 *     mortgageBalance: 250000, mortgageRepaymentRate: 0.04,
 *     yearlyCosts: 4000,
 *   });
 *   const r2 = stepRealEstate(home, {});
 *   // r2.asset.value === 408000
 *   // r2.asset.mortgageBalance === 240000  (250000 · (1 − 0.04))
 *   // r2.passiveIncome === 0, r2.extraExpense === 4000
 */
export function stepRealEstate(asset, _ctx) {
  const newValue = asset.value * (1 + (asset.appreciationRate ?? 0));
  const repaymentRate = asset.mortgageRepaymentRate ?? 0;
  const newMortgage = Math.max(
    0,
    (asset.mortgageBalance ?? 0) * (1 - repaymentRate)
  );

  const isInvestment = asset.propertyKind !== 'residence'; // default → investment
  const passiveIncome = isInvestment ? (asset.cashFlow ?? 0) : 0;
  const extraExpense = isInvestment ? 0 : (asset.yearlyCosts ?? 0);

  return {
    asset: { ...asset, value: newValue, mortgageBalance: newMortgage },
    passiveIncome,
    extraExpense,
  };
}
