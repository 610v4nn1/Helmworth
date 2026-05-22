/**
 * @fileoverview C5.1 — Architectural test: the calculation layer must NOT
 * reference DOM globals (`document`, `window`) and must touch `localStorage`
 * only inside `state.js` (the storage adapter implementation).
 */
import { fetchSource, stripComments } from './fetch-source.js';

/** Files in the calculation layer that must be DOM-free. */
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

export default async function run({ test, assert }) {
  // Pre-fetch all sources once.
  const sources = {};
  for (const path of CALC_FILES) {
    sources[path] = stripComments(await fetchSource(path));
  }

  test('TC5.1a: no `document` references in calculation layer', () => {
    const offenders = CALC_FILES.filter((p) => /\bdocument\b/.test(sources[p]));
    assert(
      offenders.length === 0,
      `Files reference \`document\`: ${offenders.join(', ')}`
    );
  });

  test('TC5.1b: no `window` references in calculation layer', () => {
    const offenders = CALC_FILES.filter((p) => /\bwindow\b/.test(sources[p]));
    assert(
      offenders.length === 0,
      `Files reference \`window\`: ${offenders.join(', ')}`
    );
  });

  test('TC5.1c: `localStorage` referenced only in src/state.js (default adapter)', () => {
    const offenders = CALC_FILES.filter(
      (p) => p !== '../src/state.js' && /\blocalStorage\b/.test(sources[p])
    );
    assert(
      offenders.length === 0,
      `Files outside src/state.js reference \`localStorage\`: ${offenders.join(', ')}`
    );
  });
}
