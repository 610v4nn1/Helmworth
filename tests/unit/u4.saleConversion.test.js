/**
 * @fileoverview Tests that sale events with a sale conversion correctly
 * channel proceeds into the chosen target. Exercises the end-to-end engine
 * path the UI now wires up.
 */
import { simulateStandard } from '../../src/engine/simulate.js';
import { createRealEstate, createStocks, createPrivateBusiness } from '../../src/model/assets.js';

export default function run({ test, assert, assertClose }) {
  test('TU4.S1: RE saleConversion null → proceeds become cash (no value lost)', () => {
    const re = createRealEstate({
      value: 300000, appreciationRate: 0,
      saleYearsFromNow: 1, saleFeesPct: 0, saleCapitalGainsTaxRate: 0,
      saleConversion: null,
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [re],
    };
    const traj = simulateStandard(state, { horizonAge: 32 });
    // After year 1 sale: RE gone, proceeds (300k) sit in a new cash asset → net worth 300k
    assertClose(traj[1].byClass.realEstate ?? 0, 0, 0.5);
    assertClose(traj[1].byClass.cash ?? 0, 300000, 0.5);
    assertClose(traj[1].netWorth, 300000, 0.5);
  });

  test('TU4.S2: RE saleConversion targets existing stocks → proceeds become a new lot', () => {
    const stocks = createStocks({ value: 0, avgReturnRate: 0, capitalGainsTaxRate: 0 });
    const re = createRealEstate({
      value: 300000, appreciationRate: 0, mortgageBalance: 0,
      saleYearsFromNow: 1, saleFeesPct: 0, saleCapitalGainsTaxRate: 0,
      saleConversion: { targetAssetId: stocks.id, inlineParams: null },
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [stocks, re],
    };
    const traj = simulateStandard(state, { horizonAge: 32 });
    assertClose(traj[1].byClass.realEstate ?? 0, 0, 0.5);
    assertClose(traj[1].byClass.stocks ?? 0, 300000, 0.5);
  });

  test('TU4.S3: RE saleConversion inlineParams creates a new cash asset', () => {
    const re = createRealEstate({
      value: 200000, appreciationRate: 0, mortgageBalance: 0,
      saleYearsFromNow: 1, saleFeesPct: 0, saleCapitalGainsTaxRate: 0,
      saleConversion: { targetAssetId: null, inlineParams: { class: 'cash', name: 'Sale proceeds' } },
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [re],
    };
    const traj = simulateStandard(state, { horizonAge: 32 });
    assertClose(traj[1].byClass.realEstate ?? 0, 0, 0.5);
    assertClose(traj[1].byClass.cash ?? 0, 200000, 0.5);
  });

  test('TU4.S4: PB saleConversion inlineParams creates a new bonds asset', () => {
    const pb = createPrivateBusiness({
      value: 150000, valueGrowthRate: 0, yearlyDividend: 0, dividendGrowthRate: 0, dividendTaxRate: 0,
      saleYearsFromNow: 2, saleFeesPct: 0, saleCapitalGainsTaxRate: 0,
      saleConversion: { targetAssetId: null, inlineParams: { class: 'bonds' } },
    });
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [pb],
    };
    const traj = simulateStandard(state, { horizonAge: 33 });
    // Year 2: pb sold, bonds created with 150000
    assertClose(traj[2].byClass.privateBusiness ?? 0, 0, 0.5);
    assertClose(traj[2].byClass.bonds ?? 0, 150000, 0.5);
  });
}
