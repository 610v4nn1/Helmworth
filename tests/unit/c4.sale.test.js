/**
 * @fileoverview Unit tests for Milestone C4 — Sale events.
 * Covers TC4.20–TC4.25.
 */
import { simulateStandard } from '../../src/engine/simulate.js';
import { simulateCoastFire } from '../../src/engine/scenarios.js';
import { simulateFire } from '../../src/engine/fire.js';
import {
  createStocks,
  createRealEstate,
  createPrivateBusiness,
} from '../../src/model/assets.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export default function run({ test, assert, assertClose, assertDeepEqual }) {
  test('TC4.20: RE 300k, sale @5y, 5% fees, 20% CGT, 3% appreciation → conversion to existing stocks', () => {
    const stocks = createStocks({ name: 'Stocks', value: 0, avgReturnRate: 0, capitalGainsTaxRate: 0, yearlyContribution: 0 });
    // Make starting stocks "empty" (a single 0-value lot is fine)
    const re = createRealEstate({
      name: 'House',
      value: 300000,
      appreciationRate: 0.03,
      mortgageBalance: 0,
      mortgageRepaymentRate: 0,
      saleYearsFromNow: 5,
      saleFeesPct: 0.05,
      saleCapitalGainsTaxRate: 0.20,
      saleConversion: { targetAssetId: stocks.id, inlineParams: null },
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [stocks, re],
    };
    const traj = simulateStandard(state, { horizonAge: 35 });
    // After year 5, RE should be gone, stocks should have a new lot ≈ 320836
    const yr5 = traj[5];
    assertClose(yr5.byClass.realEstate ?? 0, 0, 0.5, 'RE removed');
    // 300000 · 1.03^5 = 347782.18; gain = 47782.18; tax = 9556.44; fees = 17389.11
    // proceeds = 347782.18 - 17389.11 - 9556.44 = 320836.63
    assertClose(yr5.byClass.stocks ?? 0, 320836.63, 1.0);
  });

  test('TC4.21: RE conversion with inlineParams → new crypto asset', () => {
    const re = createRealEstate({
      value: 300000,
      appreciationRate: 0.03,
      mortgageBalance: 0,
      saleYearsFromNow: 5,
      saleFeesPct: 0.05,
      saleCapitalGainsTaxRate: 0.20,
      saleConversion: {
        targetAssetId: null,
        inlineParams: { class: 'crypto', name: 'BTC', avgReturnRate: 0, capitalGainsTaxRate: 0 },
      },
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [re],
    };
    const traj = simulateStandard(state, { horizonAge: 35 });
    const yr5 = traj[5];
    assertClose(yr5.byClass.realEstate ?? 0, 0, 0.5);
    assertClose(yr5.byClass.crypto ?? 0, 320836.63, 1.0);
  });

  test('TC4.22: mortgage 50k → proceeds reduced by 50k', () => {
    const stocks = createStocks({ value: 0, avgReturnRate: 0, capitalGainsTaxRate: 0 });
    const re = createRealEstate({
      value: 300000,
      appreciationRate: 0.03,
      mortgageBalance: 50000,
      mortgageRepaymentRate: 0,
      saleYearsFromNow: 5,
      saleFeesPct: 0.05,
      saleCapitalGainsTaxRate: 0.20,
      saleConversion: { targetAssetId: stocks.id, inlineParams: null },
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [stocks, re],
    };
    const traj = simulateStandard(state, { horizonAge: 35 });
    // Without mortgage: 320836.63. With 50k: 270836.63
    assertClose(traj[5].byClass.stocks ?? 0, 270836.63, 1.0);
  });

  test('TC4.23: PB 200k @5%, sale @10y, 2% fees, 26% CGT', () => {
    const stocks = createStocks({ value: 0, avgReturnRate: 0, capitalGainsTaxRate: 0 });
    const pb = createPrivateBusiness({
      value: 200000,
      valueGrowthRate: 0.05,
      yearlyDividend: 0,
      dividendGrowthRate: 0,
      saleYearsFromNow: 10,
      saleFeesPct: 0.02,
      saleCapitalGainsTaxRate: 0.26,
      saleConversion: { targetAssetId: stocks.id, inlineParams: null },
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [stocks, pb],
    };
    const traj = simulateStandard(state, { horizonAge: 41 });
    // value@10 = 200000 · 1.05^10 = 325778.93
    // fees = 0.02 · 325778.93 = 6515.58
    // gain = 125778.93; tax = 0.26 · 125778.93 = 32702.52
    // proceeds = 325778.93 - 6515.58 - 32702.52 = 286560.83
    assertClose(traj[10].byClass.stocks ?? 0, 286560.83, 2.0);
    assertClose(traj[10].byClass.privateBusiness ?? 0, 0, 0.5);
  });

  test('TC4.24: saleYearsFromNow=null → asset persists across full simulation', () => {
    const reA = createRealEstate({
      value: 300000, appreciationRate: 0.03,
      saleYearsFromNow: null,
    });
    const stateA = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [reA],
    };
    const trajA = simulateStandard(stateA, { horizonAge: 40 });
    // Last year RE still present
    assert((trajA[10].byClass.realEstate ?? 0) > 0, 'RE persists');
  });

  test('TC4.25: same RE sale year-5 → year-5 net worth equal across Standard/Coast/Fire(>=age+5)', () => {
    const stocks = createStocks({ value: 0, avgReturnRate: 0, capitalGainsTaxRate: 0, yearlyContribution: 0 });
    const re = createRealEstate({
      value: 300000, appreciationRate: 0.03,
      saleYearsFromNow: 5, saleFeesPct: 0.05, saleCapitalGainsTaxRate: 0.20,
      saleConversion: { targetAssetId: stocks.id, inlineParams: null },
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [stocks, re],
    };
    const std = simulateStandard(state, { horizonAge: 35 })[5].netWorth;
    const cf  = simulateCoastFire(state, { horizonAge: 35 })[5].netWorth;
    const fire= simulateFire(state, { startAge: 36, horizonAge: 36 }).trajectory[5].netWorth;
    assertClose(std, cf, 1.0);
    assertClose(std, fire, 1.0);
  });
}
