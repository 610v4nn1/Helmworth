/**
 * @fileoverview Coast FIRE scenario + earliest-feasible-age search.
 * @module src/engine/scenarios
 */

import { computePassiveIncome } from './passiveIncome.js';
import { inflateExpenses } from './inflation.js';
import { computeNetWorth, computeNetWorthByClass } from './netWorth.js';

import { stepStocks } from './steps/stocks.js';
import { stepBonds } from './steps/bonds.js';
import { stepCrypto } from './steps/crypto.js';
import { stepCash } from './steps/cash.js';
import { stepRealEstate } from './steps/realEstate.js';
import { stepPrivateBusiness } from './steps/privateBusiness.js';
import { stepPension } from './steps/pension.js';
import { stepPersonalDebt } from './steps/personalDebt.js';
import { computeSaleProceeds, applySaleConversion } from './sale.js';

const DEFAULT_HORIZON_AGE = 100;

/**
 * 4 % rule — safe withdrawal rate applied to net worth.
 * @pure
 * @type {number}
 */
export const SAFE_WITHDRAWAL_RATE = 0.04;

/**
 * Runs the Coast FIRE scenario: contribute as in Standard until `coastAge`,
 * then **stop contributing** and let assets compound on their own.
 *
 * If `coastAge` is omitted, defaults to the user's current age (i.e. stop
 * contributing immediately) — this matches the legacy "pure coast" definition.
 *
 * @pure  Same input → same output, no mutation.
 *
 * @param {Object} state
 * @param {Object} [opts]
 * @param {number} [opts.horizonAge=100]
 * @param {number} [opts.coastAge]   Stop contributing once age > coastAge.
 *                                   If null/undefined, stops at currentAge.
 * @returns {import('./simulate.js').YearResult[]} Year-by-year trajectory
 *
 * @formula
 *   For year y with currentAge = startAge + y:
 *     applyContribution(y) = (currentAge ≤ coastAge)
 *
 *   Equivalently: contribute up to and including the year the user reaches
 *   coastAge; from that point on, contributions are zero.
 *
 * Cross-reference: see "Coast FIRE check" in
 *   [engine.md](../../docs/engine.md#coast-fire-check).
 */
export function simulateCoastFire(state, opts = {}) {
  const horizonAge = opts.horizonAge ?? DEFAULT_HORIZON_AGE;
  const startAge = state.userInfo.age;
  // If coastAge is omitted, default to startAge − 1 (no year ever satisfies
  // currentAge ≤ coastAge → contributions are off the entire trajectory).
  const coastAge = opts.coastAge ?? (startAge - 1);

  return simulatePiecewise(state, { horizonAge, coastAge });
}

/**
 * Piecewise simulation: contributions on while currentAge ≤ coastAge, off after.
 * Otherwise identical to simulateStandard.
 *
 * @private
 * @pure
 */
function simulatePiecewise(state, { horizonAge, coastAge }) {
  const userInfo = { ...state.userInfo };
  let assets = (state.assets || []).map((a) => JSON.parse(JSON.stringify(a)));
  const startAge = userInfo.age;
  const numYears = Math.max(0, horizonAge - startAge);

  const results = [];
  results.push({
    age: startAge,
    year: 0,
    netWorth: computeNetWorth(assets),
    byClass: computeNetWorthByClass(assets),
    passiveIncome: 0,
    expenses: userInfo.monthlyExpenses * 12,
    debtPayments: 0,
  });

  for (let y = 1; y <= numYears; y++) {
    const currentAge = startAge + y;
    const applyContribution = currentAge <= coastAge;
    const ctx = { year: y, currentAge, applyContribution };

    let totalPassiveIncome = 0;
    let totalDebtPayments = 0;
    let totalExtraExpense = 0;
    const newAssets = [];
    for (const a of assets) {
      const r = stepAsset(a, ctx);
      newAssets.push(r.asset);
      totalPassiveIncome += r.passiveIncome;
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
      expenses: monthlyInflated * 12 + totalExtraExpense,
      debtPayments: totalDebtPayments,
    });
  }
  return results;
}

/**
 * Returns the earliest age **X** at which the user can stop contributing
 * (Coast FIRE) and still meet the 4% rule **at retirement**.
 *
 * **Definition:** Coast FIRE age is the earliest X ≥ currentAge such that:
 *   1. Contribute normally until age X (inclusive).
 *   2. Stop contributing afterward; assets compound on their own.
 *   3. At retirement age R, the 4% rule holds:
 *        passiveIncome(R) + 0.04 · netWorth(R) ≥ inflatedYearlyExpenses(R)
 *
 * **Retirement age R precedence (highest to lowest):**
 *   1. `opts.retirementAge`                    — explicit per-call override
 *   2. `state.userInfo.retirementAge`          — user setting from the form
 *   3. `min(pension.startingAge)`              — auto-detected from pensions
 *   4. `DEFAULT_RETIREMENT_AGE` (67)           — fallback default
 *
 * The user-set `userInfo.retirementAge` therefore wins over an auto-detected
 * pension age: a user with a pension that starts at 70 but who plans to
 * retire at 60 will be evaluated against age 60.
 *
 * This is monotone in X: if stopping at X works, stopping later than X also
 * works (more accumulation, same retirement target). Therefore the earliest
 * X is well-defined.
 *
 * @pure
 *
 * @param {Object} state
 * @param {Object} [opts]
 * @param {number} [opts.horizonAge=100]
 * @param {number} [opts.retirementAge] Override the user's retirement age (and any auto-detection)
 * @returns {number|null} Earliest Coast FIRE age X, or null if infeasible
 *
 * @formula
 *   feasibleAt(R; X) ⇔ 0.04 · netWorth(R; X) ≥ expenses(R) − passiveIncome(R; X)
 *
 *   where netWorth(R; X) and passiveIncome(R; X) come from
 *   simulateCoastFire(state, { coastAge: X }) at age R (retirement age).
 *
 *   X is feasible ⇔ feasibleAt(R; X).
 *
 *   findCoastFireAge returns the smallest such X in [currentAge, R],
 *   or null if even contributing through R isn't enough.
 *
 * @assumptions
 *   - Net worth includes all asset classes except pension (income-only).
 *   - Retirement age precedence: opts.retirementAge > userInfo.retirementAge
 *     > min(pension.startingAge) > DEFAULT_RETIREMENT_AGE (67).
 *
 * Cross-reference: see "Coast FIRE check" in
 *   [engine.md](../../docs/engine.md#coast-fire-check).
 */
export function findCoastFireAge(state, opts = {}) {
  const horizonAge = opts.horizonAge ?? DEFAULT_HORIZON_AGE;
  const startAge = state.userInfo.age;

  // Retirement age precedence:
  //   opts.retirementAge > userInfo.retirementAge > min(pension.startingAge) > default.
  const userInfoR =
    typeof state.userInfo?.retirementAge === 'number' &&
    Number.isFinite(state.userInfo.retirementAge)
      ? state.userInfo.retirementAge
      : null;
  const pensions = (state.assets || []).filter((a) => a.class === 'pension');
  const pensionR =
    pensions.length > 0 ? Math.min(...pensions.map((p) => p.startingAge)) : null;
  const retirementAge =
    opts.retirementAge ?? userInfoR ?? pensionR ?? DEFAULT_RETIREMENT_AGE;

  // If retirementAge is in the past or equals startAge, there's no time to
  // accumulate — feasibility test happens immediately at currentAge.
  const targetAge = Math.max(retirementAge, startAge);
  if (targetAge > horizonAge) return null;

  // Search every candidate stop-age X from currentAge up to retirementAge.
  // (Stopping later than retirementAge makes no sense — you've already retired.)
  const maxX = Math.min(targetAge, horizonAge);
  for (let X = startAge; X <= maxX; X++) {
    if (isCoastFireFeasibleStoppingAt(state, X, { targetAge })) {
      return X;
    }
  }
  return null;
}

/**
 * Default retirement age used when neither a user override nor a pension is
 * configured. 67 matches the current statutory default in many EU countries
 * (including the app's locked country, Germany).
 * @pure
 * @type {number}
 */
const DEFAULT_RETIREMENT_AGE = 67;

/**
 * Feasibility of stopping contributions at age X, evaluated at the retirement
 * age `targetAge`: 4% × netWorth(targetAge) + passiveIncome(targetAge) ≥
 * inflatedYearlyExpenses(targetAge).
 *
 * @private
 * @pure
 */
function isCoastFireFeasibleStoppingAt(state, X, { targetAge }) {
  const startAge = state.userInfo.age;
  // We need the asset state at targetAge under the piecewise simulation that
  // contributes up to X then stops.
  const assetsByAge = collectAssetsByAge(state, { horizonAge: targetAge, coastAge: X });

  const yearIdx = targetAge - startAge;
  if (yearIdx < 0 || yearIdx >= assetsByAge.length) return false;

  const evolvedAssets = assetsByAge[yearIdx];
  const { total: passiveIncome } = computePassiveIncome(evolvedAssets, {
    year: yearIdx,
    currentAge: targetAge,
    applyContribution: false,
  });

  const netWorthByClass = computeNetWorthByClass(evolvedAssets);
  const netWorth =
    (netWorthByClass.stocks ?? 0) +
    (netWorthByClass.bonds ?? 0) +
    (netWorthByClass.crypto ?? 0) +
    (netWorthByClass.cash ?? 0) +
    (netWorthByClass.realEstate ?? 0) +
    (netWorthByClass.privateBusiness ?? 0);

  // Yearly expenses at the retirement age include user-provided residence
  // running costs (yearlyCosts of any 'residence' real-estate asset).
  const residenceExtraExpense = evolvedAssets
    .filter((a) => a.class === 'realEstate' && a.propertyKind === 'residence')
    .reduce((s, a) => s + (a.yearlyCosts ?? 0), 0);
  const yearlyInflated =
    inflateExpenses(state.userInfo.monthlyExpenses, state.userInfo.inflationRate, yearIdx) * 12
    + residenceExtraExpense;

  return passiveIncome + SAFE_WITHDRAWAL_RATE * netWorth >= yearlyInflated;
}

/**
 * Walks the (piecewise) Coast FIRE simulation once and returns an array of
 * asset snapshots, one per year (index = year offset from startAge).
 *
 * Contributions are applied while `currentAge ≤ coastAge`; off otherwise.
 * If `coastAge` is omitted or ≤ startAge, no contributions are applied.
 *
 * @private
 * @pure
 */
function collectAssetsByAge(state, { horizonAge, coastAge }) {
  const startAge = state.userInfo.age;
  const numYears = Math.max(0, horizonAge - startAge);
  const cutoff = coastAge ?? startAge;
  const snapshots = [state.assets.map((a) => JSON.parse(JSON.stringify(a)))];

  let assets = snapshots[0];
  for (let y = 1; y <= numYears; y++) {
    const currentAge = startAge + y;
    const applyContribution = currentAge <= cutoff;
    const ctx = { year: y, currentAge, applyContribution };
    assets = assets.map((a) => stepAsset(a, ctx).asset);
    assets = applyYearSales(assets, y);
    snapshots.push(assets);
  }
  return snapshots;
}

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

function applyYearSales(assets, year) {
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
