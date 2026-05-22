/**
 * @fileoverview C5.3 — Architectural test: the public engine API exposed by
 * `src/engine/index.js` is **frozen**. Adding/removing an export here without
 * updating `engine.md` and this list breaks the test (intentionally).
 */
import * as engineApi from '../../src/engine/index.js';

/**
 * Authoritative list of expected exports. Keep in lock-step with C4.11 and
 * the "Public engine API" section of `engine.md`.
 */
const EXPECTED_EXPORTS = [
  'simulateStandard',
  'simulateCoastFire',
  'findCoastFireAge',
  'simulateFire',
  'findFireAge',
  'computeNetWorth',
  'computeNetWorthByClass',
  'computePassiveIncome',
  'computeStatsTable',
  'validateAsset',
];

export default function run({ test, assert }) {
  const actual = Object.keys(engineApi).filter((k) => k !== 'default').sort();
  const expected = [...EXPECTED_EXPORTS].sort();

  test('TC5.3a: every expected export is present', () => {
    const missing = expected.filter((name) => !(name in engineApi));
    assert(
      missing.length === 0,
      `Missing engine exports: ${missing.join(', ')}`
    );
  });

  test('TC5.3b: no unexpected (extra) exports', () => {
    const extras = actual.filter((name) => !expected.includes(name));
    assert(
      extras.length === 0,
      `Unexpected engine exports: ${extras.join(', ')}`
    );
  });

  test('TC5.3c: every export is a function', () => {
    for (const name of EXPECTED_EXPORTS) {
      assert(
        typeof engineApi[name] === 'function',
        `Engine export ${name} is not a function (got ${typeof engineApi[name]})`
      );
    }
  });
}
