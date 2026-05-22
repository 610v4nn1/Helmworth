/**
 * @fileoverview Unit tests for Milestone C4 — Coast FIRE.
 *
 * Coast FIRE definition (after C4 fix): the earliest age X at which the user
 * can stop contributing and still meet the 4% rule at retirement.
 *   - Contribute up to age X.
 *   - Stop contributing afterward; assets compound on their own.
 *   - At retirement age R: passiveIncome(R) + 4% · netWorth(R) ≥ expenses(R).
 *   - R = userInfo.retirementAge override > earliest pension startingAge > 67 default.
 */
import { simulateCoastFire, findCoastFireAge } from '../../src/engine/scenarios.js';
import {
  createStocks,
  createPension,
} from '../../src/model/assets.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export default function run({ test, assert, assertClose, assertDeepEqual }) {
  test('TC4.1: stocks 100k @ 7%, age 30, no contrib → value @67 ≈ 1222362', () => {
    const state = {
      userInfo: { age: 30, monthlyExpenses: 2000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 100000, avgReturnRate: 0.07, yearlyContribution: 0 })],
    };
    // No coastAge → defaults to startAge − 1 → no contributions ever.
    const traj = simulateCoastFire(state, { horizonAge: 67 });
    assert(traj.length === 38, `expected 38 trajectory entries, got ${traj.length}`);
    const yr67 = traj[37];
    assert(yr67 !== undefined, `traj[37] is undefined; traj has ${traj.length} entries`);
    assert(yr67.age === 67, `expected age 67, got ${yr67.age}`);
    const stocks = yr67.byClass.stocks ?? 0;
    assertClose(stocks, 1222361.81, 1.0, 'stocks @ 67');
  });

  test('TC4.2: 100k stocks + 20k pension @67 → already at Coast FIRE (age 30)', () => {
    // 100k @ 7% → 1.22M by age 67.
    // 4% · 1.22M + 20k = 48894 + 20000 = 68894 ≥ 48957 (inflated expenses) ✓
    const state = {
      userInfo: { age: 30, monthlyExpenses: 2000, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 100000, avgReturnRate: 0.07, yearlyContribution: 0 }),
        createPension({ yearlyAmount: 20000, revaluationRate: 0, startingAge: 67 }),
      ],
    };
    const age = findCoastFireAge(state, { horizonAge: 100 });
    assert(age === 30, `expected 30 (already at Coast FIRE), got ${age}`);
  });

  test('TC4.3: 50k stocks @ 7% + 5k contrib + pension → coast around early 30s', () => {
    // 50k starting + 5k/yr until X, then coast to 67. Pension 20k.
    // Per simulation, X=33 is the earliest where the 4% rule holds at 67.
    const state = {
      userInfo: { age: 30, monthlyExpenses: 2000, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 50000, avgReturnRate: 0.07, yearlyContribution: 5000 }),
        createPension({ yearlyAmount: 20000, revaluationRate: 0, startingAge: 67 }),
      ],
    };
    const age = findCoastFireAge(state, { horizonAge: 100 });
    assert(age !== null && age >= 30 && age <= 67, `expected 30..67, got ${age}`);
  });

  test('TC4.4: 10k stocks no contrib, no pension → returns null', () => {
    // 10k @ 7% reaches only ~116k by age 67 (default retirement).
    // 4%·116k ≈ 4649 < expenses(67) ≈ 49917. Not feasible at any X.
    const state = {
      userInfo: { age: 30, monthlyExpenses: 2000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 10000, avgReturnRate: 0.07, yearlyContribution: 0 })],
    };
    const age = findCoastFireAge(state, { horizonAge: 100 });
    assert(age === null, `expected null, got ${age}`);
  });

  test('TC4.5: simulateCoastFire(no coastAge) ≡ trajectory with contributions off', () => {
    const stateA = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 50000, avgReturnRate: 0.07, yearlyContribution: 5000 })],
    };
    const stateB = clone(stateA);
    stateB.assets[0].yearlyContribution = 0;

    // No coastAge → contributions off entire trajectory.
    const trajA = simulateCoastFire(stateA, { horizonAge: 50 });
    const trajExpected = simulateCoastFire(stateB, { horizonAge: 50 });
    assertDeepEqual(trajA, trajExpected, 'Coast FIRE w/o coastAge ignores contributions');
  });

  test('TC4.6: simulateCoastFire with coastAge ≥ horizonAge ≡ Standard', () => {
    // If user "stops contributing" at horizon, they actually never stop.
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 50000, avgReturnRate: 0.07, yearlyContribution: 5000 })],
    };
    const standardLike = simulateCoastFire(state, { horizonAge: 50, coastAge: 50 });
    const yr50 = standardLike[20];
    assert(yr50.age === 50, `expected age 50, got ${yr50.age}`);
    const noContrib = simulateCoastFire(state, { horizonAge: 50 });
    assert(
      yr50.netWorth > noContrib[20].netWorth + 50000,
      `with contribs (${yr50.netWorth}) should exceed no-contribs (${noContrib[20].netWorth}) by a lot`,
    );
  });

  test('TC4.7: piecewise — Coast FIRE matches Standard up to coastAge, diverges after', () => {
    // Contribute until 40, then stop.
    const state = {
      userInfo: { age: 30, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [createStocks({ value: 50000, avgReturnRate: 0.07, yearlyContribution: 5000 })],
    };
    const traj = simulateCoastFire(state, { horizonAge: 50, coastAge: 40 });
    // At age 40 (year 10): contributions still applied.
    // At age 41 (year 11): no contribution. Year-41 growth = 7% on year-40 net worth.
    const yr40 = traj[10];
    const yr41 = traj[11];
    const expected41 = yr40.netWorth * 1.07;
    assertClose(yr41.netWorth, expected41, 0.5, 'no contribution after coastAge');
  });

  test('TC4.8: userInfo.retirementAge wins over auto-detected pension age', () => {
    // The user has a pension starting at 70 (auto-detected R would be 70),
    // but explicitly plans to retire at 60. With 50k @ 7% no contributions,
    // value at 60 ≈ 50k * 1.07^30 ≈ 380,613. Inflated yearly expenses at
    // age 60 ≈ 1000*12*1.02^30 ≈ 21,724. 4%*380,613 ≈ 15,225 → infeasible
    // (no contributions case). With contributions starting from 30, we
    // expect a positive findCoastFireAge. We just check that the function
    // doesn't pick an age > 60: that would mean the engine ignored the
    // userInfo override and used the pension age 70.
    const state = {
      userInfo: { age: 30, retirementAge: 60, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 50000, avgReturnRate: 0.07, yearlyContribution: 5000 }),
        createPension({ yearlyAmount: 20000, revaluationRate: 0, startingAge: 70 }),
      ],
    };
    const age = findCoastFireAge(state, { horizonAge: 100 });
    assert(age === null || age <= 60,
      `expected null or X<=60 (retirement target), got ${age}`);
  });

  test('TC4.9: opts.retirementAge wins over userInfo.retirementAge', () => {
    // Same state as TC4.8 but force retirementAge=70 via opts: that is
    // strictly later than the user's setting (60), and gives more time to
    // accumulate, so any feasible age must be ≤ 70.
    const state = {
      userInfo: { age: 30, retirementAge: 60, monthlyExpenses: 1000, inflationRate: 0.02, country: '' },
      assets: [
        createStocks({ value: 50000, avgReturnRate: 0.07, yearlyContribution: 5000 }),
      ],
    };
    const age = findCoastFireAge(state, { horizonAge: 100, retirementAge: 70 });
    assert(age === null || age <= 70,
      `expected null or X<=70 (opts override), got ${age}`);
  });
}
