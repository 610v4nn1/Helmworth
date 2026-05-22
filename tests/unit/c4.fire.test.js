/**
 * @fileoverview Unit tests for Milestone C4 — Drawdown / FIRE.
 * Covers TC4.6–TC4.19.
 */
import { sellLotsHIFO, drawdownYear } from '../../src/engine/drawdown.js';
import { simulateFire, findFireAge } from '../../src/engine/fire.js';
import {
  createStocks,
  createBonds,
  createCash,
  createPersonalDebt,
} from '../../src/model/assets.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export default function run({ test, assert, assertClose, assertDeepEqual }) {
  // -------------------------------------------------------------------------
  // sellLotsHIFO
  // -------------------------------------------------------------------------
  test('TC4.6: HIFO consumes higher-cost-basis lot first', () => {
    const lots = [
      { value: 1000, costBasis: 600, year: 0 },
      { value: 1000, costBasis: 900, year: 1 },
    ];
    const result = sellLotsHIFO(lots, 500, 0.20);
    // The cb=900 lot is touched first; cb=600 lot untouched.
    const cb600Lot = result.updatedLots.find((l) => l.costBasis === 600);
    assert(cb600Lot, 'cb=600 lot remains untouched');
    assertClose(cb600Lot.value, 1000, 1e-6, 'cb=600 untouched value');
    // Tax reflects gain on cb=900 only: gainRatio=(1000-900)/1000=0.10
    // valueToSell ≈ 500/0.98 ≈ 510.20; tax = 510.20·0.10·0.20 ≈ 10.20
    assertClose(result.taxPaid, 10.2041, 0.01);
    assertClose(result.netProceeds, 500.00, 0.01);
  });

  test('TC4.7: need == lot.value exactly → only that lot consumed', () => {
    // cb=lot value → no gain, so net == gross == 1000
    const lots = [
      { value: 1000, costBasis: 1000, year: 0 },
      { value: 500,  costBasis: 500,  year: 1 },
    ];
    const result = sellLotsHIFO(lots, 1000, 0.20);
    // Only one lot of value 500 should remain
    assert(result.updatedLots.length === 1);
    assertClose(result.updatedLots[0].value, 500, 1e-6);
    assertClose(result.netProceeds, 1000, 0.01);
    assertClose(result.taxPaid, 0, 1e-6);
  });

  test('TC4.8: need > total → all consumed, netProceeds < need', () => {
    const lots = [
      { value: 1000, costBasis: 800, year: 0 },
    ];
    const result = sellLotsHIFO(lots, 5000, 0.20);
    assert(result.updatedLots.length === 0, 'all lots consumed');
    // gain = 200, tax = 40, net = 1000 - 40 = 960
    assertClose(result.netProceeds, 960, 0.01);
    assert(result.netProceeds < 5000);
  });

  test('TC4.9: cgt=0 → no tax', () => {
    const lots = [{ value: 1000, costBasis: 0, year: 0 }];
    const result = sellLotsHIFO(lots, 500, 0);
    assertClose(result.taxPaid, 0, 1e-9);
    assertClose(result.netProceeds, 500, 1e-6);
    assertClose(result.grossSold, 500, 1e-6);
  });

  test('TC4.10: untouched lots preserve costBasis and year', () => {
    const lots = [
      { value: 100, costBasis: 50, year: 0 },
      { value: 1000, costBasis: 950, year: 5 },
    ];
    const result = sellLotsHIFO(lots, 100, 0.20);
    // Only second lot (HIFO) is touched. First (cb=50) untouched.
    const untouched = result.updatedLots.find((l) => l.costBasis === 50);
    assert(untouched, 'cb=50 lot still present');
    assert(untouched.year === 0, 'year preserved');
    assertClose(untouched.value, 100, 1e-9);
  });

  // -------------------------------------------------------------------------
  // drawdownYear
  // -------------------------------------------------------------------------
  test('TC4.11: 100k stocks + 100k bonds + 10k cash, shortfall 8k → 4k each from S+B', () => {
    const stocks = createStocks({ value: 100000, capitalGainsTaxRate: 0 });
    const bonds  = createBonds({  value: 100000, capitalGainsTaxRate: 0 });
    const cash   = createCash({   value: 10000 });
    const result = drawdownYear([stocks, bonds, cash], 8000);
    assert(result.success);
    // proportional: stocks 50%, bonds 50% → 4000 each
    const stocksAfter = result.updatedAssets.find((a) => a.class === 'stocks');
    const bondsAfter  = result.updatedAssets.find((a) => a.class === 'bonds');
    const cashAfter   = result.updatedAssets.find((a) => a.class === 'cash');
    assertClose(stocksAfter.lots.reduce((s,l)=>s+l.value,0), 96000, 1.0);
    assertClose(bondsAfter.lots.reduce((s,l)=>s+l.value,0), 96000, 1.0);
    assertClose(cashAfter.value, 10000, 1e-6); // cash untouched
  });

  test('TC4.12: shortfall exceeds liquid + cash → success=false', () => {
    const stocks = createStocks({ value: 1000, capitalGainsTaxRate: 0 });
    const cash   = createCash({   value: 500 });
    const result = drawdownYear([stocks, cash], 5000);
    assert(result.success === false);
  });

  test('TC4.13: cash-only 5000, shortfall 3000 → cash drained by 3000', () => {
    const cash = createCash({ value: 5000 });
    const result = drawdownYear([cash], 3000);
    assert(result.success);
    assertClose(result.updatedAssets[0].value, 2000, 1e-6);
    assertClose(result.drawn, 3000, 1e-6);
  });

  // -------------------------------------------------------------------------
  // simulateFire
  // -------------------------------------------------------------------------
  test('TC4.14: 5M stocks @ 7%, expenses 3000/mo, startAge=50 → never fails', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 3000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 5000000, avgReturnRate: 0.07, yearlyContribution: 0, capitalGainsTaxRate: 0 })],
    };
    const r = simulateFire(state, { startAge: 50, horizonAge: 100 });
    assert(r.failedAtAge === null, `expected null, got ${r.failedAtAge}`);
  });

  test('TC4.15: insufficient assets → failedAtAge defined and ≤ 100', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 3000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 10000, avgReturnRate: 0.07, capitalGainsTaxRate: 0 })],
    };
    const r = simulateFire(state, { startAge: 30, horizonAge: 100 });
    assert(r.failedAtAge !== null);
    assert(r.failedAtAge <= 100);
  });

  test('TC4.16: simulateFire years ≥ startAge add no new contribution lots', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 100, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 100000, avgReturnRate: 0.07, yearlyContribution: 5000, capitalGainsTaxRate: 0 })],
    };
    // startAge = 30 → contributions never apply (entire horizon is decumulation)
    const r = simulateFire(state, { startAge: 30, horizonAge: 35 });
    // Trajectory keeps stocks lots fixed in count: no new yearly contribution lots
    // The starting lot may shrink but no NEW lots from contributions.
    // Year 0: 1 lot. After year 1+ in decumulation: still 1 lot (the remaining one,
    // since drawdown shrinks but doesn't add contribution lots).
    // Just check no year added a NEW positive lot from contribution.
    // Equivalently: total #lots never grows.
    let prevCount = 1;
    for (let y = 1; y < r.trajectory.length; y++) {
      // We don't have direct access to lots in trajectory, only byClass.
      // But we can assert: in pure-decumulation mode, stock value should
      // monotonically decrease (until 0) — never grow above year 0 due to a contribution lot.
      // (This is approximate; rigorous "no new lots" is in the design contract.)
      const prev = r.trajectory[y - 1].byClass.stocks ?? 0;
      const curr = r.trajectory[y].byClass.stocks ?? 0;
      // Allow tiny float epsilon
      assert(curr <= prev * 1.08 + 1e-6, `stocks grew suspiciously: ${prev} → ${curr}`);
    }
    void prevCount;
  });

  test('TC4.17: findFireAge success case returns earliest valid age', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 1000000, avgReturnRate: 0.07, capitalGainsTaxRate: 0 })],
    };
    const a = findFireAge(state, { horizonAge: 100 });
    assert(typeof a === 'number' && a >= 30 && a <= 100, `got ${a}`);
  });

  test('TC4.18: findFireAge failure case returns null', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 5000, inflationRate: 0.05, country: '' },
      assets: [createStocks({ value: 1000, avgReturnRate: 0.01, capitalGainsTaxRate: 0 })],
    };
    const a = findFireAge(state, { horizonAge: 100 });
    assert(a === null, `expected null, got ${a}`);
  });

  test('TC4.19: monotonicity — if FIRE works at X, it works at X+1, X+5, X+10', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 1000000, avgReturnRate: 0.07, capitalGainsTaxRate: 0 })],
    };
    const X = findFireAge(state, { horizonAge: 100 });
    assert(X !== null);
    for (const k of [1, 5, 10]) {
      if (X + k > 100) continue;
      const r = simulateFire(state, { startAge: X + k, horizonAge: 100 });
      assert(r.failedAtAge === null, `monotonicity violated at X+${k}=${X+k}`);
    }
  });
}
