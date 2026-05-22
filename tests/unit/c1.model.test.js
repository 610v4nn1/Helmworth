/**
 * @fileoverview Unit tests for Milestone C1 — Data model.
 * Tests: userInfo, asset factories (all 8 classes), lots, helpers, countries.
 */
import { createUserInfo, validateUserInfo } from '../../src/model/userInfo.js';
import {
  createLot,
  createStocks,
  createBonds,
  createCrypto,
  createCash,
  createRealEstate,
  createPrivateBusiness,
  createPension,
  createPersonalDebt,
  assetNetValue,
  liquidValue,
  isLiquid,
  validateAsset,
} from '../../src/model/assets.js';
import { countries, getCountryByCode, getDefaultsByCountry, defaultCountry } from '../../src/data/countries.js';

/**
 * @param {Object} ctx - Test context with test(), assert(), etc.
 */
export default function run({ test, assert, assertClose, assertDeepEqual, assertThrows }) {
  // -------------------------------------------------------------------------
  // USER INFO TESTS
  // -------------------------------------------------------------------------
  test('TC1.1: createUserInfo({}) returns defaults', () => {
    const info = createUserInfo({});
    assert(info.age === 30, 'age should default to 30');
    assert(info.monthlyExpenses === 0, 'monthlyExpenses should default to 0');
    assertClose(info.inflationRate, 0.02, 0.0001, 'inflationRate should default to 0.02');
  });

  test('TC1.2: createUserInfo({ age: -1 }) throws', () => {
    assertThrows(() => createUserInfo({ age: -1 }), 'negative age should throw');
  });

  test('TC1.3: createUserInfo({ inflationRate: 0.5 }) is accepted', () => {
    const info = createUserInfo({ inflationRate: 0.5 });
    assertClose(info.inflationRate, 0.5, 0.0001);
  });

  test('TC1.3a: createUserInfo({}) defaults retirementAge to 67', () => {
    const info = createUserInfo({});
    assert(info.retirementAge === 67, `expected 67, got ${info.retirementAge}`);
  });

  test('TC1.3b: createUserInfo({ retirementAge: 60 }) accepts override', () => {
    const info = createUserInfo({ retirementAge: 60 });
    assert(info.retirementAge === 60, `expected 60, got ${info.retirementAge}`);
  });

  test('TC1.3c: createUserInfo({ retirementAge: -1 }) throws', () => {
    assertThrows(() => createUserInfo({ retirementAge: -1 }), 'negative retirement age should throw');
  });

  test('TC1.3d: createUserInfo({ retirementAge: 121 }) throws', () => {
    assertThrows(() => createUserInfo({ retirementAge: 121 }), 'retirement age > 120 should throw');
  });

  // -------------------------------------------------------------------------
  // ASSET FACTORY TESTS
  // -------------------------------------------------------------------------
  test('TC1.4: createStocks returns object with correct class and id', () => {
    const asset = createStocks({ name: 'VTI', value: 10000 });
    assert(asset.class === 'stocks', 'class should be stocks');
    assert(typeof asset.id === 'string' && asset.id.length > 0, 'id should be a non-empty string');
    assert(asset.lots.length === 1, 'should have one lot');
    assert(asset.name === 'VTI', 'name should match');
  });

  test('TC1.5: createStocks with no value throws an error mentioning "value"', () => {
    assertThrows(() => createStocks({}), 'missing value should throw');
  });

  test('TC1.6: Two consecutive createStocks produce different ids', () => {
    const a1 = createStocks({ value: 1000 });
    const a2 = createStocks({ value: 1000 });
    assert(a1.id !== a2.id, 'ids should be different');
  });

  test('TC1.7: createCash returns correct structure', () => {
    const asset = createCash({ name: 'Emergency Fund', value: 1000 });
    assert(asset.class === 'cash', 'class should be cash');
    assert(asset.value === 1000, 'value should be 1000');
    assert(!('lots' in asset), 'cash should not have lots');
    assert(!('avgReturnRate' in asset), 'cash should not have avgReturnRate');
  });

  test('TC1.8: createPension defaults startingAge to 67', () => {
    const asset = createPension({ yearlyAmount: 20000 });
    assert(asset.startingAge === 67, 'startingAge should default to 67');
  });

  test('TC1.9: createPersonalDebt returns correct class and balance', () => {
    const asset = createPersonalDebt({ balance: 10000, interestRate: 0.05, monthlyPayment: 300 });
    assert(asset.class === 'personalDebt', 'class should be personalDebt');
    assert(asset.balance === 10000, 'balance should be 10000');
    assert(asset.interestRate === 0.05, 'interestRate should be 0.05');
    assert(asset.monthlyPayment === 300, 'monthlyPayment should be 300');
  });

  test('TC1.10: createRealEstate with mortgage has correct net value', () => {
    const asset = createRealEstate({ value: 300000, mortgageBalance: 100000 });
    const net = assetNetValue(asset);
    assert(net === 200000, 'net value should be value - mortgage = 200000');
  });

  test('TC1.11: All 8 factories produce correct class literals', () => {
    const s = createStocks({ value: 100 });
    const b = createBonds({ value: 100 });
    const c = createCrypto({ value: 100 });
    const ca = createCash({ value: 100 });
    const re = createRealEstate({ value: 100 });
    const pb = createPrivateBusiness({ value: 100 });
    const pn = createPension({ yearlyAmount: 100 });
    const pd = createPersonalDebt({ balance: 100 });

    assert(s.class === 'stocks', 'stocks class');
    assert(b.class === 'bonds', 'bonds class');
    assert(c.class === 'crypto', 'crypto class');
    assert(ca.class === 'cash', 'cash class');
    assert(re.class === 'realEstate', 'realEstate class');
    assert(pb.class === 'privateBusiness', 'privateBusiness class');
    assert(pn.class === 'pension', 'pension class');
    assert(pd.class === 'personalDebt', 'personalDebt class');
  });

  // -------------------------------------------------------------------------
  // LOTS & HELPERS TESTS
  // -------------------------------------------------------------------------
  test('TC1.12: createLot survives JSON round-trip', () => {
    const lot = createLot({ value: 100, costBasis: 100, year: 0 });
    const restored = JSON.parse(JSON.stringify(lot));
    assertDeepEqual(lot, restored, 'lot should survive JSON round-trip');
  });

  test('TC1.13: isLiquid returns correct values for each class', () => {
    assert(isLiquid(createStocks({ value: 100 })) === true, 'stocks should be liquid');
    assert(isLiquid(createBonds({ value: 100 })) === true, 'bonds should be liquid');
    assert(isLiquid(createCrypto({ value: 100 })) === true, 'crypto should be liquid');
    assert(isLiquid(createCash({ value: 100 })) === true, 'cash should be liquid');
    assert(isLiquid(createRealEstate({ value: 100 })) === false, 'realEstate should be illiquid');
    assert(isLiquid(createPrivateBusiness({ value: 100 })) === false, 'privateBusiness should be illiquid');
    assert(isLiquid(createPension({ yearlyAmount: 100 })) === false, 'pension should be illiquid');
    assert(isLiquid(createPersonalDebt({ balance: 100 })) === false, 'personalDebt should be illiquid');
  });

  test('TC1.14: validateAsset on malformed stocks (no lots) returns errors', () => {
    const malformed = { id: 'x', name: 'Bad', class: 'stocks', lots: [] };
    const result = validateAsset(malformed);
    assert(result.ok === false, 'validation should fail');
    assert(result.errors.length > 0, 'should have errors');
    assert(result.errors.some(e => e.includes('lot')), 'error should mention lots');
  });

  // -------------------------------------------------------------------------
  // COUNTRIES TESTS
  // -------------------------------------------------------------------------
  test('TC1.15: countries array has >= 10 entries with all required fields', () => {
    assert(countries.length >= 10, 'should have at least 10 countries');
    countries.forEach((c) => {
      assert(c.code && typeof c.code === 'string', 'should have code');
      assert(c.name && typeof c.name === 'string', 'should have name');
      assert(c.defaults && typeof c.defaults === 'object', 'should have defaults');

      const d = c.defaults;
      const keys = [
        'stocksCapitalGainsTax',
        'bondsCapitalGainsTax',
        'bondsYieldTax',
        'cryptoCapitalGainsTax',
        'realEstateRentalTax',
        'realEstateSaleCapitalGainsTax',
        'privateBusinessDividendTax',
        'privateBusinessSaleCapitalGainsTax',
      ];
      keys.forEach((k) => {
        assert(k in d, `${c.code} should have ${k}`);
      });
    });
  });

  test('TC1.16: All numeric country defaults are in [0, 1]', () => {
    countries.forEach((c) => {
      Object.values(c.defaults).forEach((v) => {
        assert(typeof v === 'number' && v >= 0 && v <= 1, `${c.code} default ${v} should be in [0, 1]`);
      });
    });
  });

  // -------------------------------------------------------------------------
  // ADDITIONAL HELPER TESTS
  // -------------------------------------------------------------------------
  test('assetNetValue for debt is negative', () => {
    const debt = createPersonalDebt({ balance: 10000 });
    assert(assetNetValue(debt) === -10000, 'debt net value should be negative');
  });

  test('assetNetValue for pension is 0', () => {
    const pension = createPension({ yearlyAmount: 20000 });
    assert(assetNetValue(pension) === 0, 'pension net value should be 0');
  });

  test('liquidValue sums lot values correctly', () => {
    const stocks = createStocks({ value: 5000 });
    // Manually add another lot
    stocks.lots.push(createLot({ value: 3000, costBasis: 3000, year: 1 }));
    assert(liquidValue(stocks) === 8000, 'liquidValue should sum all lots');
  });

  test('countryDefaults returns correct defaults for known country', () => {
    const defaults = getDefaultsByCountry('DE');
    assert(defaults !== null, 'should find Germany');
    assertClose(defaults.stocksCapitalGainsTax, 0.26375, 0.0001, 'DE stocks CGT');
  });

  test('defaultCountry is first in array', () => {
    assert(defaultCountry.code === countries[0].code, 'default country should match first in array');
  });
}
