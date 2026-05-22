/**
 * @fileoverview FIRE scenario: standard until startAge, then no contributions
 * + drawdown each year. `findFireAge` searches for the earliest feasible age.
 * @module src/engine/fire
 */

import { stepStocks } from './steps/stocks.js';
import { stepBonds } from './steps/bonds.js';
import { stepCrypto } from './steps/crypto.js';
import { stepCash } from './steps/cash.js';
import { stepRealEstate } from './steps/realEstate.js';
import { stepPrivateBusiness } from './steps/privateBusiness.js';
import { stepPension } from './steps/pension.js';
import { stepPersonalDebt } from './steps/personalDebt.js';
import { drawdownYear } from './drawdown.js';
import { inflateExpenses } from './inflation.js';
import { computeNetWorth, computeNetWorthByClass } from './netWorth.js';
import { computeSaleProceeds, applySaleConversion } from './sale.js';

const DEFAULT_HORIZON_AGE = 100;

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

/**
 * @typedef {Object} FireYearResult
 * @property {number} age
 * @property {number} year
 * @property {number} netWorth
 * @property {Object<string,number>} byClass
 * @property {number} passiveIncome
 * @property {number} pensionIncome - Pension portion of passiveIncome (subset of passiveIncome).
 * @property {Object<string,number>} passiveByClass - Passive income split by asset class
 *   (keys: stocks, bonds, crypto, cash, realEstate, privateBusiness, pension, personalDebt).
 *   Sum equals passiveIncome.
 * @property {number} expenses
 * @property {number} debtPayments
 * @property {number} drawnDown      - net cash drawn from liquid assets this year
 * @property {Object<string,number>} drawnByClass - Drawdown split by liquid class
 *   (keys: cash, stocks, bonds, crypto). Sum equals drawnDown.
 * @property {boolean} drawdownOk    - whether drawdown succeeded
 */

/**
 * @typedef {Object} FireResult
 * @property {FireYearResult[]} trajectory
 * @property {number|null} failedAtAge - age at which drawdown failed, else null
 */

/**
 * Runs the FIRE scenario:
 *   - Years before `startAge`: Standard (with contributions).
 *   - Years from `startAge` onward: no contributions; cover the yearly shortfall
 *     by drawing down liquid assets (HIFO + proportional, see drawdownYear).
 *
 * @pure  No mutation; same input → same output.
 *
 * @param {Object} state
 * @param {Object} opts
 * @param {number} opts.startAge - Age at which decumulation begins
 * @param {number} [opts.horizonAge=100]
 * @returns {FireResult}
 *
 * @formula
 *   For y in 1..(horizonAge − age):
 *     ctx = { year:y, currentAge: age+y,
 *             applyContribution: (age+y) < startAge }
 *     for each asset: stepClass(...)
 *     totalPassiveIncome, totalDebtPayments, expenses (inflated)
 *
 *     If currentAge ≥ startAge:
 *       shortfall = expenses + totalDebtPayments − totalPassiveIncome
 *       if shortfall > 0:
 *         (assets', drawn, success) = drawdownYear(assets, shortfall)
 *         if !success → record failedAtAge = currentAge, stop simulation
 *
 *     netWorth = computeNetWorth(assets)
 *
 * Cross-reference: see "FIRE check" in
 *   [engine.md](../../docs/engine.md#fire-check).
 */
export function simulateFire(state, opts) {
  const horizonAge = opts.horizonAge ?? DEFAULT_HORIZON_AGE;
  const startAge = opts.startAge;
  const userInfo = { ...state.userInfo };
  const currentAge0 = userInfo.age;
  const numYears = Math.max(0, horizonAge - currentAge0);

  let assets = state.assets.map((a) => JSON.parse(JSON.stringify(a)));
  const trajectory = [];
  let failedAtAge = null;

  const emptyByClass = () => ({
    stocks: 0, bonds: 0, crypto: 0, cash: 0,
    realEstate: 0, privateBusiness: 0, pension: 0, personalDebt: 0,
  });
  const emptyDrawByClass = () => ({ cash: 0, stocks: 0, bonds: 0, crypto: 0 });

  // Year 0
  trajectory.push({
    age: currentAge0,
    year: 0,
    netWorth: computeNetWorth(assets),
    byClass: computeNetWorthByClass(assets),
    passiveIncome: 0,
    pensionIncome: 0,
    passiveByClass: emptyByClass(),
    expenses: userInfo.monthlyExpenses * 12,
    debtPayments: 0,
    drawnDown: 0,
    drawnByClass: emptyDrawByClass(),
    drawdownOk: true,
  });

  for (let y = 1; y <= numYears; y++) {
    const currentAge = currentAge0 + y;
    const inDecumulation = currentAge >= startAge;
    const ctx = { year: y, currentAge, applyContribution: !inDecumulation };

    let totalPassiveIncome = 0;
    let totalDebtPayments = 0;
    let totalExtraExpense = 0;
    let pensionIncome = 0;
    const passiveByClass = emptyByClass();
    const newAssets = [];
    for (const a of assets) {
      const r = stepAsset(a, ctx);
      newAssets.push(r.asset);
      totalPassiveIncome += r.passiveIncome;
      if (passiveByClass[a.class] !== undefined) {
        passiveByClass[a.class] += r.passiveIncome;
      }
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

    // Trigger illiquid-asset sales scheduled for this year (before drawdown,
    // so newly-converted proceeds become drawdown candidates this year)
    assets = applyYearSales(assets, y);

    const monthlyInflated = inflateExpenses(userInfo.monthlyExpenses, userInfo.inflationRate, y);
    const yearlyExpenses = monthlyInflated * 12 + totalExtraExpense;

    let drawnDown = 0;
    let drawdownOk = true;
    let drawnByClass = emptyDrawByClass();
    if (inDecumulation) {
      const shortfall = yearlyExpenses + totalDebtPayments - totalPassiveIncome;
      if (shortfall > 0) {
        const dr = drawdownYear(assets, shortfall);
        assets = dr.updatedAssets;
        drawnDown = dr.drawn;
        drawdownOk = dr.success;
        if (dr.drawnByClass) drawnByClass = dr.drawnByClass;
      }
    }

    trajectory.push({
      age: currentAge,
      year: y,
      netWorth: computeNetWorth(assets),
      byClass: computeNetWorthByClass(assets),
      passiveIncome: totalPassiveIncome,
      pensionIncome,
      passiveByClass,
      expenses: yearlyExpenses,
      debtPayments: totalDebtPayments,
      drawnDown,
      drawnByClass,
      drawdownOk,
    });

    if (!drawdownOk) {
      failedAtAge = currentAge;
      break;
    }
  }

  return { trajectory, failedAtAge };
}

/**
 * Returns the earliest age at which FIRE succeeds (drawdown never fails before
 * `horizonAge`), or null if no such age exists.
 *
 * @pure
 *
 * @param {Object} state
 * @param {Object} [opts]
 * @param {number} [opts.horizonAge=100]
 * @returns {number|null}
 *
 * @formula
 *   For A = currentAge .. horizonAge:
 *     run simulateFire(state, { startAge: A })
 *     if failedAtAge === null → return A
 *   return null
 *
 *   Linear scan; relies on the **monotonicity assumption**: if FIRE works at
 *   X, it works at X + k for all k ≥ 0 (more accumulation, less decumulation).
 *   This holds for typical inputs but is not strictly guaranteed under
 *   pathological cases (e.g. enormous contribution rates with poor returns).
 *
 * Cross-reference: see "FIRE check" in
 *   [engine.md](../../docs/engine.md#fire-check).
 */
export function findFireAge(state, opts = {}) {
  const horizonAge = opts.horizonAge ?? DEFAULT_HORIZON_AGE;
  const startAge = state.userInfo.age;
  for (let A = startAge; A <= horizonAge; A++) {
    const { failedAtAge } = simulateFire(state, { startAge: A, horizonAge });
    if (failedAtAge === null) return A;
  }
  return null;
}
