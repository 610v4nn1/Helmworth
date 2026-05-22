/**
 * @fileoverview C5.4 — Architectural test: every step function in
 * `src/engine/steps/*.js` is pure — calling it with a deep-cloned input does
 * not mutate the original.
 */
import { stepStocks } from '../../src/engine/steps/stocks.js';
import { stepBonds } from '../../src/engine/steps/bonds.js';
import { stepCrypto } from '../../src/engine/steps/crypto.js';
import { stepCash } from '../../src/engine/steps/cash.js';
import { stepRealEstate } from '../../src/engine/steps/realEstate.js';
import { stepPrivateBusiness } from '../../src/engine/steps/privateBusiness.js';
import { stepPension } from '../../src/engine/steps/pension.js';
import { stepPersonalDebt } from '../../src/engine/steps/personalDebt.js';
import {
  createStocks, createBonds, createCrypto, createCash,
  createRealEstate, createPrivateBusiness, createPension, createPersonalDebt,
} from '../../src/model/assets.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

/** Pairs of [stepFn, sample asset, ctx] that exercise contributions / time-dependence. */
const CASES = [
  ['stepStocks',          stepStocks,          () => createStocks({ value: 10000, avgReturnRate: 0.07, yearlyContribution: 1000 }), { year: 1, currentAge: 31, applyContribution: true }],
  ['stepBonds',           stepBonds,           () => createBonds({ value: 50000, yieldRate: 0.04, yieldTaxRate: 0.20, yearlyContribution: 500 }), { year: 1, currentAge: 31, applyContribution: true }],
  ['stepCrypto',          stepCrypto,          () => createCrypto({ value: 5000, avgReturnRate: 0.10, yearlyContribution: 100 }), { year: 1, currentAge: 31, applyContribution: true }],
  ['stepCash',            stepCash,            () => createCash({ value: 5000 }),                                                  { year: 1 }],
  ['stepRealEstate',      stepRealEstate,      () => createRealEstate({ propertyKind: 'investment', value: 300000, appreciationRate: 0.03, mortgageBalance: 100000, mortgageRepaymentRate: 0.05, cashFlow: 6000 }), {}],
  ['stepPrivateBusiness', stepPrivateBusiness, () => createPrivateBusiness({ value: 200000, valueGrowthRate: 0.05, yearlyDividend: 10000, dividendGrowthRate: 0.03, dividendTaxRate: 0.26 }), {}],
  ['stepPension',         stepPension,         () => createPension({ yearlyAmount: 20000, revaluationRate: 0.02, startingAge: 67 }), { currentAge: 70 }],
  ['stepPersonalDebt',    stepPersonalDebt,    () => createPersonalDebt({ balance: 10000, interestRate: 0.12, monthlyPayment: 500 }), {}],
];

export default function run({ test, assert, assertDeepEqual }) {
  for (const [name, fn, factory, ctx] of CASES) {
    test(`TC5.4 ${name}: input not mutated`, () => {
      const asset = factory();
      const snap = clone(asset);
      const result = fn(asset, ctx);
      assert(result && typeof result === 'object', `${name} returned non-object`);
      assert('asset' in result, `${name} did not return { asset, ... }`);
      assertDeepEqual(asset, snap, `${name} mutated its input`);
    });
  }
}
