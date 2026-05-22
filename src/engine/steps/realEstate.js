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
 *   `passiveIncome` is the year's positive cash-flow contribution (investment
 *   only; 0 for residence). `extraExpense` is the year's added expense:
 *   running costs for residences, or the absolute value of a *negative*
 *   investment cash flow (so a money-losing rental shows up as expenses,
 *   never as negative passive income).
 *
 * @formula
 *   value'           = value · (1 + appreciationRate)
 *   mortgageBalance' = max(0, mortgageBalance · (1 − mortgageRepaymentRate))
 *
 *   if propertyKind === 'investment':
 *     if cashFlow ≥ 0:
 *       passiveIncome = cashFlow
 *       extraExpense  = 0
 *     else:
 *       passiveIncome = 0
 *       extraExpense  = −cashFlow      // a positive expense
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
 *   - Negative cash flow on an investment property is reported as an extra
 *     expense, not as negative passive income, so the projection chart and
 *     coverage charts show "money in" and "money out" cleanly separated.
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
 *   // Same property but with negative cash flow:
 *   const inv2 = createRealEstate({ ...inv, cashFlow: -2000 });
 *   const r1 = stepRealEstate(inv2, {});
 *   // r1.passiveIncome === 0, r1.extraExpense === 2000
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

  let passiveIncome = 0;
  let extraExpense = 0;
  if (isInvestment) {
    const cf = asset.cashFlow ?? 0;
    if (cf >= 0) {
      passiveIncome = cf;
    } else {
      // Negative rental cash flow is reported as an expense, not as
      // negative passive income — keeps "money in" and "money out"
      // visually separated in the projection / coverage charts.
      extraExpense = -cf;
    }
  } else {
    extraExpense = asset.yearlyCosts ?? 0;
  }

  return {
    asset: { ...asset, value: newValue, mortgageBalance: newMortgage },
    passiveIncome,
    extraExpense,
  };
}
