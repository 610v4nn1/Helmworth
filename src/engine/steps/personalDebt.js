/**
 * @fileoverview Yearly step for Personal Debt — pure.
 * @module src/engine/steps/personalDebt
 */

/**
 * Advances a Personal Debt by one year, simulating 12 monthly payments.
 *
 * @pure
 * @param {Object} asset - Personal debt asset
 * @param {Object} _ctx - Step context (ignored)
 * @returns {{asset: Object, passiveIncome: number, yearlyPayments: number}}
 *   - passiveIncome is always 0 (debt is not income)
 *   - yearlyPayments is the actual amount paid this year (used as a cash-flow drag)
 *
 * @formula
 *   For m = 0..11:
 *     bal_{m+1} = bal_m · (1 + interestRate / 12) − monthlyPayment
 *     if bal_{m+1} ≤ 0:
 *        actualPayment_m = bal_m · (1 + interestRate / 12)   // partial last payment
 *        bal_{m+1} = 0
 *        stop
 *     else:
 *        actualPayment_m = monthlyPayment
 *
 *   yearlyPayments = Σ actualPayment_m
 *   passiveIncome  = 0
 *
 * @assumptions
 *   - Interest compounds monthly at `interestRate / 12`.
 *   - Once balance reaches 0, no further payments accrue.
 *   - The final payment is partial (just enough to clear the balance).
 *
 * Cross-reference: see "Personal debt" in
 *   [engine.md](../../../docs/engine.md#personal-debt).
 *
 * @example
 *   const d = createPersonalDebt({ balance: 10000, interestRate: 0.12, monthlyPayment: 500 });
 *   const { asset } = stepPersonalDebt(d, {});
 *   // asset.balance ≈ 4734.26 (12 monthly steps at r/12 = 1%)
 */
export function stepPersonalDebt(asset, _ctx) {
  let bal = asset.balance;
  const monthlyRate = asset.interestRate / 12;
  let yearlyPayments = 0;

  for (let m = 0; m < 12 && bal > 0; m++) {
    const grown = bal * (1 + monthlyRate);
    if (grown <= asset.monthlyPayment) {
      // Final partial payment clears the balance
      yearlyPayments += grown;
      bal = 0;
    } else {
      bal = grown - asset.monthlyPayment;
      yearlyPayments += asset.monthlyPayment;
    }
  }

  return {
    asset: { ...asset, balance: bal },
    passiveIncome: 0,
    yearlyPayments,
  };
}
