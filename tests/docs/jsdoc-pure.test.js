/**
 * @fileoverview C6.3 — Every exported function inside `src/engine/**` must
 * carry an `@pure` tag in its JSDoc. (`src/engine/index.js` is a pure
 * re-export hub and is exempt — its exports are documented in their source files.)
 */
import { fetchSource } from '../arch/fetch-source.js';

const ENGINE_FILES = [
  '../src/engine/inflation.js',
  '../src/engine/passiveIncome.js',
  '../src/engine/netWorth.js',
  '../src/engine/simulate.js',
  '../src/engine/scenarios.js',
  '../src/engine/drawdown.js',
  '../src/engine/fire.js',
  '../src/engine/sale.js',
  '../src/engine/stats.js',
  '../src/engine/steps/stocks.js',
  '../src/engine/steps/bonds.js',
  '../src/engine/steps/crypto.js',
  '../src/engine/steps/cash.js',
  '../src/engine/steps/realEstate.js',
  '../src/engine/steps/privateBusiness.js',
  '../src/engine/steps/pension.js',
  '../src/engine/steps/personalDebt.js',
];

/** Returns the JSDoc block (string) immediately preceding the export of `name`, or null. */
function findJsDocFor(src, name) {
  const lines = src.split('\n');
  const declRe = new RegExp(
    `^\\s*export\\s+(?:default\\s+)?(?:async\\s+)?(?:function|const|let|var)\\s+${name}\\b`
  );
  for (let i = 0; i < lines.length; i++) {
    if (declRe.test(lines[i])) {
      let j = i - 1;
      while (j >= 0 && /^\s*$/.test(lines[j])) j--;
      if (j < 0) return null;
      if (!/\*\/\s*$/.test(lines[j])) return null;
      let k = j;
      while (k >= 0 && !/\/\*\*/.test(lines[k])) k--;
      if (k < 0) return null;
      return lines.slice(k, j + 1).join('\n');
    }
  }
  return null;
}

/** Lists exported function/const names declared in `src`. */
function listExports(src) {
  const re = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var)\s+(\w+)/gm;
  const out = [];
  let m;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

export default async function run({ test, assert }) {
  const sources = {};
  for (const p of ENGINE_FILES) sources[p] = await fetchSource(p);

  test('TC6.3: every exported function in src/engine/** has @pure in its JSDoc', () => {
    const offenders = [];
    for (const path of ENGINE_FILES) {
      const exports = listExports(sources[path]);
      for (const name of exports) {
        const doc = findJsDocFor(sources[path], name);
        if (!doc) {
          offenders.push(`${path}: ${name}  (no JSDoc found)`);
        } else if (!/@pure\b/.test(doc)) {
          offenders.push(`${path}: ${name}  (JSDoc missing @pure)`);
        }
      }
    }
    assert(
      offenders.length === 0,
      `Missing @pure:\n  ${offenders.join('\n  ')}`
    );
  });
}
