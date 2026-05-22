/**
 * @fileoverview Unit tests for Milestone C2 — Simulation engine.
 * Covers TC2.1–TC2.26 from tasks.md.
 */
import { inflateExpenses } from '../../src/engine/inflation.js';
import { stepStocks } from '../../src/engine/steps/stocks.js';
import { stepBonds } from '../../src/engine/steps/bonds.js';
import { stepCrypto } from '../../src/engine/steps/crypto.js';
import { stepCash } from '../../src/engine/steps/cash.js';
import { stepRealEstate } from '../../src/engine/steps/realEstate.js';
import { stepPrivateBusiness } from '../../src/engine/steps/privateBusiness.js';
import { stepPension } from '../../src/engine/steps/pension.js';
import { stepPersonalDebt } from '../../src/engine/steps/personalDebt.js';
import { computePassiveIncome } from '../../src/engine/passiveIncome.js';
import { computeNetWorth } from '../../src/engine/netWorth.js';
import { simulateStandard } from '../../src/engine/simulate.js';
import {
  createStocks,
  createBonds,
  createCrypto,
  createCash,
  createRealEstate,
  createPrivateBusiness,
  createPension,
  createPersonalDebt,
} from '../../src/model/assets.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export default function run({ test, assert, assertClose, assertDeepEqual }) {
  // -------------------------------------------------------------------------
  // INFLATION (TC2.1–TC2.3)
  // -------------------------------------------------------------------------
  test('TC2.1: inflateExpenses(1000, 0.02, 0) === 1000', () => {
    assertClose(inflateExpenses(1000, 0.02, 0), 1000, 1e-9);
  });

  test('TC2.2: inflateExpenses(1000, 0.02, 10) ≈ 1218.99', () => {
    assertClose(inflateExpenses(1000, 0.02, 10), 1218.9944, 0.01);
  });

  test('TC2.3: inflateExpenses(1000, 0, 50) === 1000', () => {
    assertClose(inflateExpenses(1000, 0, 50), 1000, 1e-9);
  });

  // -------------------------------------------------------------------------
  // STOCKS (TC2.4–TC2.7)
  // -------------------------------------------------------------------------
  test('TC2.4: stocks 1 step, 10000 @ 10%, no contribution', () => {
    const a = createStocks({ value: 10000, avgReturnRate: 0.10, yearlyContribution: 0 });
    const { asset, passiveIncome } = stepStocks(a, { year: 1 });
    assert(asset.lots.length === 1);
    assertClose(asset.lots[0].value, 11000, 1e-6);
    assertClose(asset.lots[0].costBasis, 10000, 1e-6);
    assert(passiveIncome === 0);
  });

  test('TC2.5: stocks 1 step, 10000 @ 10%, contribution 1000 → 2 lots', () => {
    const a = createStocks({ value: 10000, avgReturnRate: 0.10, yearlyContribution: 1000 });
    const { asset } = stepStocks(a, { year: 1 });
    assert(asset.lots.length === 2);
    assertClose(asset.lots[0].value, 11000, 1e-6);
    assertClose(asset.lots[1].value, 1000, 1e-6);
    assertClose(asset.lots[1].costBasis, 1000, 1e-6);
    assert(asset.lots[1].year === 1);
  });

  test('TC2.6: stocks 10 years @ 7%, start 10000, no contribution → ≈19671.51', () => {
    let a = createStocks({ value: 10000, avgReturnRate: 0.07, yearlyContribution: 0 });
    for (let y = 1; y <= 10; y++) a = stepStocks(a, { year: y }).asset;
    const total = a.lots.reduce((s, l) => s + l.value, 0);
    assertClose(total, 19671.5135, 0.01);
  });

  test('TC2.7: stepStocks does not mutate input', () => {
    const a = createStocks({ value: 10000, avgReturnRate: 0.10, yearlyContribution: 1000 });
    const snap = clone(a);
    stepStocks(a, { year: 1 });
    assertDeepEqual(a, snap, 'input must not change');
  });

  // -------------------------------------------------------------------------
  // BONDS (TC2.8–TC2.9)
  // -------------------------------------------------------------------------
  test('TC2.8: bonds 100000 @ 4% yield, 20% tax → passiveIncome 3200', () => {
    const b = createBonds({ value: 100000, yieldRate: 0.04, yieldTaxRate: 0.20 });
    const { passiveIncome } = stepBonds(b, { year: 1 });
    assertClose(passiveIncome, 3200, 1e-6);
  });

  test('TC2.9: bond principal flat after 1 step', () => {
    const b = createBonds({ value: 100000, yieldRate: 0.04, yieldTaxRate: 0.20 });
    const { asset } = stepBonds(b, { year: 1 });
    const total = asset.lots.reduce((s, l) => s + l.value, 0);
    assertClose(total, 100000, 1e-6);
  });

  // -------------------------------------------------------------------------
  // CASH (TC2.10)
  // -------------------------------------------------------------------------
  test('TC2.10: cash 5000 over 5 steps → still 5000', () => {
    let c = createCash({ value: 5000 });
    for (let y = 1; y <= 5; y++) c = stepCash(c, { year: y }).asset;
    assertClose(c.value, 5000, 1e-9);
  });

  // -------------------------------------------------------------------------
  // REAL ESTATE (TC2.11–TC2.13)
  // -------------------------------------------------------------------------
  test('TC2.11: investment property — appreciation + cash flow', () => {
    const re = createRealEstate({
      propertyKind: 'investment',
      value: 300000,
      appreciationRate: 0.03,
      cashFlow: 12000,
      mortgageBalance: 0,
    });
    const { asset, passiveIncome, extraExpense } = stepRealEstate(re, {});
    assertClose(asset.value, 309000, 1e-6);
    assertClose(passiveIncome, 12000, 1e-6);
    assertClose(extraExpense, 0, 1e-6);
  });

  test('TC2.12: mortgage 100000, repayment rate 5% → bal\' = 95000 (no interest)', () => {
    const re = createRealEstate({
      value: 300000,
      mortgageBalance: 100000,
      mortgageRepaymentRate: 0.05,
      cashFlow: 0,
    });
    const { asset } = stepRealEstate(re, {});
    // bal' = 100000 · (1 - 0.05) = 95000  (no interest)
    assertClose(asset.mortgageBalance, 95000, 1e-6);
  });

  test('TC2.13: post-step net contribution = value − mortgageBalance', () => {
    const re = createRealEstate({
      value: 300000,
      appreciationRate: 0.03,
      mortgageBalance: 100000,
      mortgageRepaymentRate: 0.05,
    });
    const { asset } = stepRealEstate(re, {});
    const net = asset.value - asset.mortgageBalance;
    // 309000 - 95000 = 214000
    assertClose(net, 214000, 1e-6);
  });

  test('TC2.13b: residence — no cash flow, costs reported as extra expense', () => {
    const home = createRealEstate({
      propertyKind: 'residence',
      value: 400000, appreciationRate: 0.02,
      mortgageBalance: 250000, mortgageRepaymentRate: 0.04,
      yearlyCosts: 4000,
    });
    const { asset, passiveIncome, extraExpense } = stepRealEstate(home, {});
    assertClose(asset.value, 408000, 1e-6);
    assertClose(asset.mortgageBalance, 240000, 1e-6);
    assert(passiveIncome === 0, 'residence has no passive income');
    assertClose(extraExpense, 4000, 1e-6);
  });

  // -------------------------------------------------------------------------
  // PRIVATE BUSINESS (TC2.14)
  // -------------------------------------------------------------------------
  test('TC2.14: PB 200000 @ 5%, dividend 10000 @ 3% growth, 26% tax', () => {
    const pb = createPrivateBusiness({
      value: 200000,
      valueGrowthRate: 0.05,
      yearlyDividend: 10000,
      dividendGrowthRate: 0.03,
      dividendTaxRate: 0.26,
    });
    const r1 = stepPrivateBusiness(pb, {});
    assertClose(r1.passiveIncome, 7400, 1e-6);            // 10000 · 0.74
    assertClose(r1.asset.value, 210000, 1e-6);             // value grew first
    assertClose(r1.asset.yearlyDividend, 10300, 1e-6);     // dividend grew

    // Year 2 pre-tax dividend
    const r2 = stepPrivateBusiness(r1.asset, {});
    const preTaxYear2 = 10300; // r1.asset.yearlyDividend
    assertClose(r2.passiveIncome, preTaxYear2 * 0.74, 1e-6);
  });

  // -------------------------------------------------------------------------
  // PENSION (TC2.15–TC2.16)
  // -------------------------------------------------------------------------
  test('TC2.15: pension 20000 @ 2%, startingAge 67, age 60 → income 0 for 7 years', () => {
    const p = createPension({ yearlyAmount: 20000, revaluationRate: 0.02, startingAge: 67 });
    for (let age = 60; age < 67; age++) {
      assert(stepPension(p, { currentAge: age }).passiveIncome === 0, `age ${age} should be 0`);
    }
  });

  test('TC2.16: pension at age 67 → 20000; age 68 → 20400', () => {
    const p = createPension({ yearlyAmount: 20000, revaluationRate: 0.02, startingAge: 67 });
    assertClose(stepPension(p, { currentAge: 67 }).passiveIncome, 20000, 1e-6);
    assertClose(stepPension(p, { currentAge: 68 }).passiveIncome, 20400, 1e-6);
  });

  // -------------------------------------------------------------------------
  // PERSONAL DEBT (TC2.17–TC2.18)
  // -------------------------------------------------------------------------
  test('TC2.17: debt 10000 @ 12%, payment 500/mo → balance ≈ 4927.00 after 1 yr', () => {
    // Note: tasks.md states "4734.26" but the recurrence
    //   bal_{m+1} = bal_m · (1 + r/12) − P, with r=0.12, P=500, bal_0=10000
    // gives bal_12 ≈ 4927.00 (closed-form: 10000·1.01^12 − 500·(1.01^12−1)/0.01).
    // We test the mathematically correct value; engine.md notes this.
    const d = createPersonalDebt({ balance: 10000, interestRate: 0.12, monthlyPayment: 500 });
    const { asset } = stepPersonalDebt(d, {});
    assertClose(asset.balance, 4926.9994, 0.01);
  });

  test('TC2.18: debt simulated to payoff, no further accrual', () => {
    let d = createPersonalDebt({ balance: 10000, interestRate: 0.12, monthlyPayment: 500 });
    let safety = 0;
    while (d.balance > 0 && safety < 10) {
      d = stepPersonalDebt(d, {}).asset;
      safety++;
    }
    assert(d.balance === 0, `balance reached 0 (got ${d.balance})`);
    // Further steps should keep it at 0 with zero payments
    const r = stepPersonalDebt(d, {});
    assert(r.asset.balance === 0);
    assert(r.yearlyPayments === 0);
  });

  // -------------------------------------------------------------------------
  // PASSIVE INCOME AGGREGATION (TC2.19–TC2.20)
  // -------------------------------------------------------------------------
  test('TC2.19: byClass keys sum to total', () => {
    const assets = [
      createBonds({ value: 100000, yieldRate: 0.04, yieldTaxRate: 0.20 }),
      createRealEstate({
        propertyKind: 'investment',
        value: 300000, cashFlow: 12000, mortgageBalance: 0,
      }),
      createPrivateBusiness({
        value: 200000, yearlyDividend: 10000, dividendTaxRate: 0.26,
      }),
      createPension({ yearlyAmount: 20000, startingAge: 67 }),
    ];
    const ctx = { year: 1, currentAge: 70 }; // pension active
    const { total, byClass } = computePassiveIncome(assets, ctx);
    const sum = Object.values(byClass).reduce((s, v) => s + v, 0);
    assertClose(sum, total, 1e-6);
    assert(byClass.pension > 0, 'pension should contribute');
  });

  test('TC2.20: stocks/crypto contribute 0 to passive income', () => {
    const assets = [
      createStocks({ value: 50000, avgReturnRate: 0.10, yearlyContribution: 1000 }),
      createCrypto({ value: 5000, avgReturnRate: 0.15 }),
    ];
    const { total, byClass } = computePassiveIncome(assets, { year: 1, currentAge: 30 });
    assert(total === 0, `total should be 0, got ${total}`);
    assert((byClass.stocks ?? 0) === 0);
    assert((byClass.crypto ?? 0) === 0);
  });

  // -------------------------------------------------------------------------
  // NET WORTH (TC2.21)
  // -------------------------------------------------------------------------
  test('TC2.21: stocks 100k + cash 5k − debt 10k + RE 300k/m100k = 295k', () => {
    const assets = [
      createStocks({ value: 100000 }),
      createCash({ value: 5000 }),
      createPersonalDebt({ balance: 10000 }),
      createRealEstate({ value: 300000, mortgageBalance: 100000 }),
    ];
    assertClose(computeNetWorth(assets), 295000, 1e-6);
  });

  // -------------------------------------------------------------------------
  // simulateStandard END-TO-END (TC2.22–TC2.26)
  // -------------------------------------------------------------------------
  test('TC2.22: empty state → length horizon-age+1, all netWorth 0', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0.02, country: '' },
      assets: [],
    };
    const traj = simulateStandard(state, { horizonAge: 35 });
    assert(traj.length === 6, `length=${traj.length}`);
    traj.forEach((r) => assert(r.netWorth === 0));
  });

  test('TC2.23: stocks 10000 @ 10%, age 30, horizon 32 → [10000, 11000, 12100]', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [createStocks({ value: 10000, avgReturnRate: 0.10, yearlyContribution: 0 })],
    };
    const traj = simulateStandard(state, { horizonAge: 32 });
    assertClose(traj[0].netWorth, 10000, 1e-6);
    assertClose(traj[1].netWorth, 11000, 1e-6);
    assertClose(traj[2].netWorth, 12100, 1e-6);
  });

  test('TC2.24: byClass only has classes that exist in state', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [createStocks({ value: 10000 }), createCash({ value: 1000 })],
    };
    const traj = simulateStandard(state, { horizonAge: 31 });
    // Year 1 byClass should have stocks + cash, nothing else
    const keys = Object.keys(traj[1].byClass);
    assert(keys.includes('stocks') && keys.includes('cash'));
    assert(!keys.includes('bonds'));
    assert(!keys.includes('crypto'));
  });

  test('TC2.25: simulateStandard purity (state unchanged)', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 100, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 10000, avgReturnRate: 0.10, yearlyContribution: 1000 }),
        createPersonalDebt({ balance: 5000, interestRate: 0.05, monthlyPayment: 100 }),
      ],
    };
    const snap = clone(state);
    simulateStandard(state, { horizonAge: 35 });
    assertDeepEqual(state, snap, 'state must not mutate');
  });

  test('TC2.26: simulateStandard determinism', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 100, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 10000, avgReturnRate: 0.07, yearlyContribution: 500 })],
    };
    const a = simulateStandard(state, { horizonAge: 40 });
    const b = simulateStandard(state, { horizonAge: 40 });
    assertDeepEqual(a, b, 'two runs must be deep-equal');
  });

  // -------------------------------------------------------------------------
  // Contribution cutoff (Standard scenario stops contributing at the user's
  // retirement / pension age — no salary in retirement → no contributions).
  // -------------------------------------------------------------------------
  test('TC2.27: contributions stop at userInfo.retirementAge', () => {
    // 0% growth, 0% inflation: easy arithmetic. Yearly contribution 1000.
    // Retirement at 35; user is 30. Years 31..34 contribute (4 years), year
    // 35 onward does not.
    const state = {
      userInfo: { age: 30, retirementAge: 35, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [createStocks({
        value: 10000, avgReturnRate: 0, yearlyContribution: 1000, capitalGainsTaxRate: 0,
      })],
    };
    const traj = simulateStandard(state, { horizonAge: 40 });
    const at34 = traj.find((r) => r.age === 34);
    const at35 = traj.find((r) => r.age === 35);
    const at40 = traj.find((r) => r.age === 40);
    // 10000 + 4·1000 = 14000 by age 34 (last contribution year before cutoff).
    assertClose(at34.byClass.stocks, 14000, 1e-6, 'year 34: 4 contribs');
    // Year 35 = retirement: no new contribution.
    assertClose(at35.byClass.stocks, 14000, 1e-6, 'year 35: no contrib at cutoff');
    // Year 40: still no contributions; net worth unchanged at 0% growth.
    assertClose(at40.byClass.stocks, 14000, 1e-6, 'year 40: still no contribs');
  });

  test('TC2.28: contributions stop at earliest pension startingAge when retirementAge unset', () => {
    // No userInfo.retirementAge; pension starts at 67. With age 30, that's
    // 37 contribution years (31..66 inclusive, then stop at 67).
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [
        createStocks({ value: 0, avgReturnRate: 0, yearlyContribution: 100, capitalGainsTaxRate: 0 }),
        createPension({ yearlyAmount: 0, revaluationRate: 0, startingAge: 67 }),
      ],
    };
    const traj = simulateStandard(state, { horizonAge: 80 });
    const at66 = traj.find((r) => r.age === 66);
    const at67 = traj.find((r) => r.age === 67);
    const at80 = traj.find((r) => r.age === 80);
    // Years 31..66 contribute → 36 contribs of 100 = 3600.
    assertClose(at66.byClass.stocks, 3600, 1e-6, 'last contrib year 66');
    assertClose(at67.byClass.stocks, 3600, 1e-6, 'no contrib at pension age');
    assertClose(at80.byClass.stocks, 3600, 1e-6, 'still no contrib in late retirement');
  });

  test('TC2.29: cutoff is the earliest of retirementAge and pension startingAge', () => {
    // retirementAge=40 (early FIRE-style), pension at 67. Cutoff = 40.
    const state = {
      userInfo: { age: 30, retirementAge: 40, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [
        createStocks({ value: 0, avgReturnRate: 0, yearlyContribution: 1000, capitalGainsTaxRate: 0 }),
        createPension({ yearlyAmount: 0, revaluationRate: 0, startingAge: 67 }),
      ],
    };
    const traj = simulateStandard(state, { horizonAge: 70 });
    const at39 = traj.find((r) => r.age === 39);
    const at40 = traj.find((r) => r.age === 40);
    // Years 31..39 contribute → 9·1000 = 9000.
    assertClose(at39.byClass.stocks, 9000, 1e-6);
    assertClose(at40.byClass.stocks, 9000, 1e-6);
  });

  test('TC2.30: applyContribution=false still disables contributions everywhere', () => {
    // Even before retirementAge, explicit override wins.
    const state = {
      userInfo: { age: 30, retirementAge: 65, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [createStocks({
        value: 1000, avgReturnRate: 0, yearlyContribution: 5000, capitalGainsTaxRate: 0,
      })],
    };
    const traj = simulateStandard(state, { horizonAge: 35, applyContribution: false });
    const at35 = traj.find((r) => r.age === 35);
    assertClose(at35.byClass.stocks, 1000, 1e-6, 'no growth, no contribs');
  });
}
