/**
 * @fileoverview Unit tests for the data the chart consumes (TU2-style).
 * The chart itself is rendered by Chart.js (DOM); this test only exercises the
 * pure engine outputs the chart binds to, so we can assert the numbers shown
 * in the chart are correct.
 */
import {
  simulateStandard,
  simulateCoastFire,
  findCoastFireAge,
  simulateFire,
  findFireAge,
} from '../../src/engine/index.js';
import { createStocks, createPension } from '../../src/model/assets.js';

export default function run({ test, assert, assertClose }) {
  test('TU2.1: stocks 10000 @ 7%, age 30 → standard line ≈54274 at age 50', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 10000, avgReturnRate: 0.07, yearlyContribution: 0 })],
    };
    const traj = simulateStandard(state, { horizonAge: 100 });
    // age 50 → traj index 20
    const v = traj[20].netWorth;
    // 10000 · 1.07^20 = 38696.84... not 54274. Actually:
    // 1.07^20 = 3.86968446 → value = 38696.84.
    // tasks.md says ≈54274 — let me re-check: 10000 · 1.07^20 = 38696.84. 54274 looks wrong.
    // 1.07^X = 5.4274 → X ≈ 25. So tasks.md may have intended age 55 or rate 8%.
    // We test the mathematically correct value.
    assertClose(v, 38696.84, 1.0, 'standard at age 50');
  });

  test('TU2.2: chart-relevant trajectory length = horizonAge − age + 1', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 10000, avgReturnRate: 0.07 })],
    };
    const traj = simulateStandard(state, { horizonAge: 100 });
    assert(traj.length === 71, `expected 71 entries, got ${traj.length}`);
    assert(traj[0].age === 30 && traj[traj.length - 1].age === 100);
  });

  test('TU2.3: Coast FIRE age + FIRE age both reachable for an obvious case', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 1500000, avgReturnRate: 0.07, capitalGainsTaxRate: 0 }),
        createPension({ yearlyAmount: 20000, revaluationRate: 0, startingAge: 67 }),
      ],
    };
    const coastAge = findCoastFireAge(state, { horizonAge: 100 });
    const fireAge  = findFireAge(state,  { horizonAge: 100 });
    assert(typeof coastAge === 'number');
    assert(typeof fireAge === 'number');
    assert(fireAge >= 30 && fireAge <= 100);
  });

  test('TU2.4: chart datasets shape — 2 lines (Standard, Coast) when no FIRE', () => {
    // Insufficient assets → FIRE not achievable
    const state = {
      userInfo: { age: 30, monthlyExpenses: 5000, inflationRate: 0.05, country: '' },
      assets: [createStocks({ value: 100, avgReturnRate: 0.01, capitalGainsTaxRate: 0 })],
    };
    const fireAge = findFireAge(state, { horizonAge: 100 });
    assert(fireAge === null, 'FIRE should be unachievable here');
  });

  test('TU2.5: simulateFire respects startAge: pre-startAge values match Standard', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 0, inflationRate: 0, country: '' },
      assets: [createStocks({ value: 100000, avgReturnRate: 0.07, yearlyContribution: 0, capitalGainsTaxRate: 0 })],
    };
    const std  = simulateStandard(state, { horizonAge: 60 });
    const fire = simulateFire(state, { startAge: 50, horizonAge: 60 }).trajectory;
    // For ages < 50 (year < 20), they should behave identically (no contributions → identical).
    for (let i = 0; i < 20; i++) {
      assertClose(fire[i].netWorth, std[i].netWorth, 0.5, `mismatch at year ${i}`);
    }
  });
}
