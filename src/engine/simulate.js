/**
 * @fileoverview Top-level yearly-step simulation engine.
 * @module src/engine/simulate
 */

import { stepStocks } from './steps/stocks.js';
import { stepBonds } from './steps/bonds.js';
import { stepCrypto } from './steps/crypto.js';
import { stepCash } from './steps/cash.js';
import { stepRealEstate } from './steps/realEstate.js';
import { stepPrivateBusiness } from './steps/privateBusiness.js';
import { stepPension } from './steps/pension.js';
import { stepPersonalDebt } from './steps/personalDebt.js';
import { inflateExpenses } from './inflation.js';
import { computeNetWorth, computeNetWorthByClass } from './netWorth.js';
import { computeSaleProceeds, applySaleConversion } from './sale.js';

const DEFAULT_HORIZON_AGE = 100;

/**
 * Default retirement age used when neither a user override nor a pension is
 * configured. 67 matches the current statutory default in many EU countries
 * (including the app's locked country, Germany).
 *
 * Kept in sync with `DEFAULT_RETIREMENT_AGE` in scenarios.js.
 * @pure
 * @type {number}
 */
const DEFAULT_RETIREMENT_AGE = 67;

/**
 * Computes the age at which contributions stop in the **Standard** scenario.
 *
 * Rule: in the Standard ("if you keep doing what you're doing today")
 * trajectory, contributions are funded by the user's active salary. Once
 * the user retires, salary disappears, and so do contributions. The
 * cutoff is the earliest of:
 *   1. `userInfo.retirementAge`         (the user's planned retirement)
 *   2. earliest `pension.startingAge`   (the latest age a pension implies)
 *   3. `DEFAULT_RETIREMENT_AGE` (67)    if neither of the above is set
 *
 * Contributions apply while `currentAge < cutoff`; from `currentAge ≥ cutoff`
 * they stop. (Strict `<` so the cutoff age is the *first* no-contribution
 * year, matching the "no salary in retirement" intuition.)
 *
 * @pure
 * @param {Object} state
 * @returns {number} cutoff age
 */
function standardContributionCutoff(state) {
  const userInfoR =
    typeof state.userInfo?.retirementAge === 'number' &&
    Number.isFinite(state.userInfo.retirementAge)
      ? state.userInfo.retirementAge
      : null;
  const pensions = (state.assets || []).filter((a) => a.class === 'pension');
  const pensionR =
    pensions.length > 0 ? Math.min(...pensions.map((p) => p.startingAge)) : null;

  const candidates = [userInfoR, pensionR].filter((v) => v != null);
  if (candidates.length === 0) return DEFAULT_RETIREMENT_AGE;
  return Math.min(...candidates);
}

/**
 * Deep-clone an asset (plain JSON works because all fields are POD).
 * @private
 */
function cloneAsset(a) {
  return JSON.parse(JSON.stringify(a));
}

/**
 * Apply the appropriate step function to a single asset.
 * Returns the updated asset and its passive income for the year.
 * @private
 */
function stepAsset(asset, ctx) {
  switch (asset.class) {
    case 'stocks':          return stepStocks(asset, ctx);
    case 'bonds':           return stepBonds(asset, ctx);
    case 'crypto':          return stepCrypto(asset, ctx);
    case 'cash':            return stepCash(asset, ctx);
    case 'realEstate':      return stepRealEstate(asset, ctx);
    case 'privateBusiness': return stepPrivateBusiness(asset, ctx);
    case 'pension':         return stepPension(asset, ctx);
    case 'personalDebt':    return stepPersonalDebt(asset, ctx);
    default:                return { asset, passiveIncome: 0 };
  }
}

/**
 * After applying yearly steps, trigger any illiquid-asset sales whose
 * `saleYearsFromNow == year`. Each sale removes the asset and converts its
 * net proceeds into the configured target (existing asset or new inline asset).
 *
 * @private
 * @pure
 * @param {Array} assets
 * @param {number} year
 * @returns {Array} Updated asset list (post-sales)
 */
function applyYearSales(assets, year) {
  // Identify all assets whose sale fires this year (RE/PB only, with non-null saleYearsFromNow)
  const toSell = assets.filter(
    (a) =>
      (a.class === 'realEstate' || a.class === 'privateBusiness') &&
      a.saleYearsFromNow != null &&
      a.saleYearsFromNow === year
  );

  let next = assets;
  for (const src of toSell) {
    const proceeds = computeSaleProceeds(src, year);
    next = applySaleConversion(next, src.id, proceeds, year);
  }
  return next;
}

/**
 * @typedef {Object} YearResult
 * @property {number} age           - User age in this year
 * @property {number} year          - Years from start (0 = start)
 * @property {number} netWorth      - Net worth at end of year
 * @property {Object<string, number>} byClass - Net worth broken down by class
 * @property {number} passiveIncome - Total passive income for the year
 * @property {number} pensionIncome - Pension portion of passive income (subset of passiveIncome).
 *                                    0 before any pension's startingAge.
 * @property {number} expenses      - Yearly expenses (12 · inflated monthly)
 * @property {number} debtPayments  - Total debt payments for the year
 */

/**
 * Runs the **Standard** scenario simulation: contributions continue as today,
 * no decumulation, until the user retires (no salary → no contributions).
 *
 * Each year:
 *   1. Apply the per-class step (growth, contributions if before cutoff,
 *      passive income).
 *   2. Aggregate passive income, debt payments.
 *   3. Compute end-of-year net worth.
 *
 * **Contribution cutoff.** Contributions only apply while
 * `currentAge < min(userInfo.retirementAge, earliest pension.startingAge,
 *                   DEFAULT_RETIREMENT_AGE)`.
 * From the cutoff onward, contributions stop because the user no longer has
 * salary income to invest. Callers can still force contributions off the
 * entire trajectory by passing `applyContribution: false` (used by some
 * Coast FIRE call sites that want a "stop-now" baseline).
 *
 * @pure  No mutation of input state. Same input → same output.
 *
 * @param {Object} state             - { userInfo, assets }
 * @param {Object} [opts]
 * @param {number} [opts.horizonAge=100] - Stop at this age
 * @param {boolean} [opts.applyContribution=true] - Allow yearly contributions
 *   up to the contribution cutoff. Pass `false` to disable contributions
 *   entirely (used by Coast FIRE).
 * @returns {YearResult[]} Year-by-year trajectory, length = horizonAge − age + 1.
 *   Index 0 is the starting state (no step applied yet).
 *
 * @formula
 *   cutoffAge = min(userInfo.retirementAge, min(pension.startingAge),
 *                   DEFAULT_RETIREMENT_AGE)
 *
 *   Year 0: take state as-is, compute netWorth, expenses (no inflation).
 *   For each year y in 1..(horizonAge − startAge):
 *     applyContribution = callerWantsContributions ∧ (startAge + y < cutoffAge)
 *     for each asset a:
 *       (a', pi_a) = stepClass(a, { year: y, currentAge: startAge + y, applyContribution })
 *     totalPassiveIncome  = Σ pi_a
 *     totalDebtPayments   = Σ yearlyPayments_a   (debt only)
 *     monthlyExpenses_y   = monthlyExpenses_0 · (1 + inflationRate)^y
 *     yearlyExpenses_y    = monthlyExpenses_y · 12
 *     netWorth_y          = computeNetWorth(updatedAssets)
 *
 * @assumptions
 *   - Year 0 = starting snapshot, no growth applied yet.
 *   - All step functions are pure and deterministic.
 *   - Active income (salary) is implicit: it is assumed to cover expenses in
 *     the Standard scenario; net worth tracks investments only.
 *   - Contributions are bounded by the user's working years: once retired
 *     (or once a pension kicks in), there is no salary to invest.
 *
 * Cross-reference: see "Time stepping" in
 *   [engine.md](../../docs/engine.md#time-stepping).
 *
 * @example
 *   const state = {
 *     userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0.02 },
 *     assets: [createStocks({ value: 10000, avgReturnRate: 0.10 })],
 *   };
 *   const traj = simulateStandard(state, { horizonAge: 32 });
 *   // traj.map(r => r.netWorth) === [10000, 11000, 12100]
 */
export function simulateStandard(state, opts = {}) {
  const horizonAge = opts.horizonAge ?? DEFAULT_HORIZON_AGE;
  // When the caller asks for contributions (default), honor them per-year
  // up to the contribution cutoff (see standardContributionCutoff).
  // When the caller explicitly disables them, contributions are off the
  // entire trajectory regardless of age (this preserves the legacy
  // "Standard with applyContribution:false ≡ pure-coast" semantic used by
  // some Coast FIRE call sites and tests).
  const callerWantsContributions = opts.applyContribution !== false;
  const cutoffAge = standardContributionCutoff(state);

  // Deep-clone everything to guarantee purity
  const userInfo = { ...state.userInfo };
  let assets = (state.assets || []).map(cloneAsset);

  const startAge = userInfo.age;
  const numYears = Math.max(0, horizonAge - startAge);

  const results = [];

  // Year 0: starting snapshot
  results.push({
    age: startAge,
    year: 0,
    netWorth: computeNetWorth(assets),
    byClass: computeNetWorthByClass(assets),
    passiveIncome: 0,
    pensionIncome: 0,
    expenses: userInfo.monthlyExpenses * 12,
    debtPayments: 0,
  });

  // Years 1..numYears
  for (let y = 1; y <= numYears; y++) {
    const currentAge = startAge + y;
    const applyContribution = callerWantsContributions && currentAge < cutoffAge;
    const ctx = { year: y, currentAge, applyContribution };

    let totalPassiveIncome = 0;
    let totalDebtPayments = 0;
    let totalExtraExpense = 0;
    let pensionIncome = 0;

    const newAssets = [];
    for (const a of assets) {
      const result = stepAsset(a, ctx);
      newAssets.push(result.asset);
      totalPassiveIncome += result.passiveIncome;
      if (a.class === 'pension') {
        pensionIncome += result.passiveIncome;
      }
      if (typeof result.extraExpense === 'number') {
        totalExtraExpense += result.extraExpense;
      }
      if (a.class === 'personalDebt' && typeof result.yearlyPayments === 'number') {
        totalDebtPayments += result.yearlyPayments;
      }
    }
    assets = newAssets;

    // Trigger illiquid-asset sales scheduled for this year
    assets = applyYearSales(assets, y);

    const monthlyInflated = inflateExpenses(userInfo.monthlyExpenses, userInfo.inflationRate, y);
    results.push({
      age: currentAge,
      year: y,
      netWorth: computeNetWorth(assets),
      byClass: computeNetWorthByClass(assets),
      passiveIncome: totalPassiveIncome,
      pensionIncome,
      expenses: monthlyInflated * 12 + totalExtraExpense,
      debtPayments: totalDebtPayments,
    });
  }

  return results;
}

/**
 * Like {@link simulateStandard} but returns the *evolved asset list* at the
 * target age, in addition to the trajectory. Internal helper used by the
 * Coast FIRE / FIRE search procedures (which need the asset state at a given
 * age to compute passive income / drawdown).
 *
 * @pure
 * @param {Object} state
 * @param {Object} [opts]
 * @param {number} [opts.horizonAge]
 * @param {boolean} [opts.applyContribution=true]
 * @returns {{trajectory: import('./simulate.js').YearResult[], assets: Array}}
 */
export function simulateAndReturnAssets(state, opts = {}) {
  const horizonAge = opts.horizonAge ?? DEFAULT_HORIZON_AGE;
  const callerWantsContributions = opts.applyContribution !== false;
  const cutoffAge = standardContributionCutoff(state);

  const userInfo = { ...state.userInfo };
  let assets = (state.assets || []).map(cloneAsset);
  const startAge = userInfo.age;
  const numYears = Math.max(0, horizonAge - startAge);
  const results = [];

  results.push({
    age: startAge,
    year: 0,
    netWorth: computeNetWorth(assets),
    byClass: computeNetWorthByClass(assets),
    passiveIncome: 0,
    pensionIncome: 0,
    expenses: userInfo.monthlyExpenses * 12,
    debtPayments: 0,
  });

  for (let y = 1; y <= numYears; y++) {
    const currentAge = startAge + y;
    const applyContribution = callerWantsContributions && currentAge < cutoffAge;
    const ctx = { year: y, currentAge, applyContribution };
    let totalPassiveIncome = 0;
    let totalDebtPayments = 0;
    let totalExtraExpense = 0;
    let pensionIncome = 0;
    const newAssets = [];
    for (const a of assets) {
      const r = stepAsset(a, ctx);
      newAssets.push(r.asset);
      totalPassiveIncome += r.passiveIncome;
      if (a.class === 'pension') {
        pensionIncome += r.passiveIncome;
      }
      if (typeof r.extraExpense === 'number') {
        totalExtraExpense += r.extraExpense;
      }
      if (a.class === 'personalDebt' && typeof r.yearlyPayments === 'number') {
        totalDebtPayments += r.yearlyPayments;
      }
    }
    assets = newAssets;
    assets = applyYearSales(assets, y);

    const monthlyInflated = inflateExpenses(userInfo.monthlyExpenses, userInfo.inflationRate, y);
    results.push({
      age: currentAge,
      year: y,
      netWorth: computeNetWorth(assets),
      byClass: computeNetWorthByClass(assets),
      passiveIncome: totalPassiveIncome,
      pensionIncome,
      expenses: monthlyInflated * 12 + totalExtraExpense,
      debtPayments: totalDebtPayments,
    });
  }

  return { trajectory: results, assets };
}
