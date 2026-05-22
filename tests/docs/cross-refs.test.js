/**
 * @fileoverview C6.6 — Cross-references between step files and engine.md:
 *   - Each `src/engine/steps/*.js` JSDoc references engine.md
 *     (e.g. via a markdown link like `[engine.md](../../../docs/engine.md...)`).
 *   - Each `### <Class>` subsection in engine.md mentions the corresponding
 *     `stepXxx` function name.
 */
import { fetchSource } from '../arch/fetch-source.js';

const STEPS = [
  ['../src/engine/steps/stocks.js',          'stepStocks',          'Stocks'],
  ['../src/engine/steps/bonds.js',           'stepBonds',           'Bonds'],
  ['../src/engine/steps/crypto.js',          'stepCrypto',          'Crypto'],
  ['../src/engine/steps/cash.js',            'stepCash',            'Cash'],
  ['../src/engine/steps/realEstate.js',      'stepRealEstate',      'Real estate'],
  ['../src/engine/steps/privateBusiness.js', 'stepPrivateBusiness', 'Private business'],
  ['../src/engine/steps/pension.js',         'stepPension',         'Pension'],
  ['../src/engine/steps/personalDebt.js',    'stepPersonalDebt',    'Personal debt'],
];

/**
 * Returns the body of the `### <heading>` subsection of engine.md (until the
 * next heading at level 2 or 3).
 */
function extractSubsection(md, heading) {
  const lines = md.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === `### ${heading}`);
  if (startIdx < 0) return '';
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || /^###\s/.test(lines[i])) { endIdx = i; break; }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

export default async function run({ test, assert }) {
  const md = await fetchSource('../docs/engine.md');
  const stepSrcs = {};
  for (const [path] of STEPS) stepSrcs[path] = await fetchSource(path);

  test('TC6.6a: each step file references engine.md', () => {
    const offenders = [];
    for (const [path] of STEPS) {
      if (!/engine\.md/.test(stepSrcs[path])) {
        offenders.push(path);
      }
    }
    assert(
      offenders.length === 0,
      `Step files missing engine.md cross-reference:\n  ${offenders.join('\n  ')}`
    );
  });

  test('TC6.6b: each `### <Class>` section in engine.md mentions the corresponding step function', () => {
    const offenders = [];
    for (const [, fnName, heading] of STEPS) {
      const body = extractSubsection(md, heading);
      if (body.length === 0) {
        offenders.push(`engine.md: section "### ${heading}" not found`);
        continue;
      }
      if (!body.includes(fnName)) {
        offenders.push(`engine.md "### ${heading}" missing reference to ${fnName}`);
      }
    }
    assert(
      offenders.length === 0,
      `Cross-ref failures:\n  ${offenders.join('\n  ')}`
    );
  });
}
