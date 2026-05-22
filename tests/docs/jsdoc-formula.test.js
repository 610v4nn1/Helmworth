/**
 * @fileoverview C6.2 — Every formula-bearing engine function must carry an
 * `@formula` tag in its JSDoc. The exact list of names is enumerated in
 * tasks.md C6.2.
 */
import { fetchSource } from '../arch/fetch-source.js';

/** Each entry is [filePath, functionName]. */
const REQUIRED = [
  ['../src/engine/inflation.js',                     'inflateExpenses'],
  ['../src/engine/passiveIncome.js',                 'computePassiveIncome'],
  ['../src/engine/netWorth.js',                      'computeNetWorth'],
  ['../src/engine/simulate.js',                      'simulateStandard'],
  ['../src/engine/scenarios.js',                     'simulateCoastFire'],
  ['../src/engine/scenarios.js',                     'findCoastFireAge'],
  ['../src/engine/drawdown.js',                      'sellLotsHIFO'],
  ['../src/engine/drawdown.js',                      'drawdownYear'],
  ['../src/engine/fire.js',                          'simulateFire'],
  ['../src/engine/fire.js',                          'findFireAge'],
  ['../src/engine/sale.js',                          'computeSaleProceeds'],
  ['../src/engine/sale.js',                          'applySaleConversion'],
  ['../src/engine/stats.js',                         'computeStatsTable'],
  ['../src/engine/steps/stocks.js',                  'stepStocks'],
  ['../src/engine/steps/bonds.js',                   'stepBonds'],
  ['../src/engine/steps/crypto.js',                  'stepCrypto'],
  ['../src/engine/steps/cash.js',                    'stepCash'],
  ['../src/engine/steps/realEstate.js',              'stepRealEstate'],
  ['../src/engine/steps/privateBusiness.js',         'stepPrivateBusiness'],
  ['../src/engine/steps/pension.js',                 'stepPension'],
  ['../src/engine/steps/personalDebt.js',            'stepPersonalDebt'],
];

/**
 * Finds the JSDoc block (block-comment) immediately preceding the export
 * declaration of `name` in `src`. Returns its text or null.
 */
function findJsDocFor(src, name) {
  const lines = src.split('\n');
  // Match: export ... function|const NAME or `function NAME`
  const declRe = new RegExp(
    `^\\s*(?:export\\s+(?:default\\s+)?)?(?:async\\s+)?(?:function|const|let|var)\\s+${name}\\b`
  );
  for (let i = 0; i < lines.length; i++) {
    if (declRe.test(lines[i])) {
      // Walk backward, skipping blanks, collecting the JSDoc block ending at i-1
      let j = i - 1;
      while (j >= 0 && /^\s*$/.test(lines[j])) j--;
      if (j < 0) return null;
      if (!/\*\/\s*$/.test(lines[j])) return null;
      // Find matching block start (slash-star-star)
      let k = j;
      while (k >= 0 && !/\/\*\*/.test(lines[k])) k--;
      if (k < 0) return null;
      return lines.slice(k, j + 1).join('\n');
    }
  }
  return null;
}

export default async function run({ test, assert }) {
  // Pre-fetch each unique file
  const uniquePaths = [...new Set(REQUIRED.map(([p]) => p))];
  const sources = {};
  for (const p of uniquePaths) sources[p] = await fetchSource(p);

  test('TC6.2: every required function has @formula in its JSDoc', () => {
    const offenders = [];
    for (const [path, name] of REQUIRED) {
      const doc = findJsDocFor(sources[path], name);
      if (!doc) {
        offenders.push(`${path}: ${name}  (no JSDoc found)`);
      } else if (!/@formula\b/.test(doc)) {
        offenders.push(`${path}: ${name}  (JSDoc missing @formula)`);
      }
    }
    assert(
      offenders.length === 0,
      `Missing @formula:\n  ${offenders.join('\n  ')}`
    );
  });
}
