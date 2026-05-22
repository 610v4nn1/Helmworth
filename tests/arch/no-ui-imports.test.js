/**
 * @fileoverview C5.2 — Architectural test: the calculation layer must NOT
 * import anything from `src/ui/`.
 */
import { fetchSource, stripComments } from './fetch-source.js';

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

// Matches:  from '...' / from "..."  containing "/ui/"
const UI_IMPORT_RE = /from\s+['"][^'"]*\/ui\//;

export default async function run({ test, assert }) {
  const sources = {};
  for (const path of CALC_FILES) {
    sources[path] = stripComments(await fetchSource(path));
  }

  test('TC5.2: no imports from src/ui/** in the calculation layer', () => {
    const offenders = CALC_FILES.filter((p) => UI_IMPORT_RE.test(sources[p]));
    assert(
      offenders.length === 0,
      `Files import from src/ui/: ${offenders.join(', ')}`
    );
  });
}
