/**
 * @fileoverview C6.1 — Every export in the calculation layer must be preceded
 * by a JSDoc block.
 */
import { fetchSource } from '../arch/fetch-source.js';

const CALC_FILES = [
  '../src/state.js',
  '../src/data/countries.js',
  '../src/model/id.js',
  '../src/model/userInfo.js',
  '../src/model/assets.js',
  '../src/engine/index.js',
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

/**
 * Returns the line index (0-based) of every `export` declaration that
 * declares a name (function, const, let, var, class). Re-export forms like
 * `export { ... } from '...'` are skipped — they're documented at the source.
 *
 * @param {string} src
 * @returns {Array<{lineIdx: number, line: string}>}
 */
function findExportDeclarations(src) {
  const lines = src.split('\n');
  const out = [];
  // Match: export (default)? (async)? (function|const|let|var|class) NAME
  const re = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+\w/;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) out.push({ lineIdx: i, line: lines[i] });
  }
  return out;
}

/**
 * Checks whether the line immediately preceding `idx` (after skipping blank
 * lines) is the closing line of a JSDoc block (ends with `* /` -- written
 * out so this comment doesn't itself terminate prematurely).
 */
function isPrecededByJsDoc(lines, idx) {
  let i = idx - 1;
  // Skip blank lines
  while (i >= 0 && /^\s*$/.test(lines[i])) i--;
  if (i < 0) return false;
  // Must end with '*'+'/' on its own
  return /\*\/\s*$/.test(lines[i]);
}

export default async function run({ test, assert }) {
  const sources = {};
  for (const path of CALC_FILES) {
    sources[path] = await fetchSource(path);
  }

  test('TC6.1: every named export has a JSDoc block immediately before it', () => {
    const offenders = [];
    for (const path of CALC_FILES) {
      const lines = sources[path].split('\n');
      const exports = findExportDeclarations(sources[path]);
      for (const { lineIdx, line } of exports) {
        if (!isPrecededByJsDoc(lines, lineIdx)) {
          offenders.push(`${path}:${lineIdx + 1}  ${line.trim()}`);
        }
      }
    }
    assert(
      offenders.length === 0,
      `Exports missing JSDoc:\n  ${offenders.join('\n  ')}`
    );
  });
}
