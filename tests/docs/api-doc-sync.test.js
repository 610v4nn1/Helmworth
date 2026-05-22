/**
 * @fileoverview C6.5 — Every name exported by `src/engine/index.js` must
 * appear in `engine.md`'s "Public engine API" section, and every name in
 * the section must be exported.
 */
import { fetchSource } from '../arch/fetch-source.js';
import * as engineApi from '../../src/engine/index.js';

/**
 * Extracts the lines belonging to the "## Public engine API" section
 * (until the next H2 heading).
 */
function extractApiSection(md) {
  const lines = md.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === '## Public engine API');
  if (startIdx < 0) return '';
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i])) { endIdx = i; break; }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

export default async function run({ test, assert }) {
  const md = await fetchSource('../docs/engine.md');
  const apiSection = extractApiSection(md);
  const exportedNames = Object.keys(engineApi).filter((k) => k !== 'default');

  test('TC6.5a: every engine export appears in the "Public engine API" section', () => {
    const missing = exportedNames.filter((name) => {
      // Look for the name in either backticks or a markdown table cell
      const re = new RegExp(`\\b${name}\\b`);
      return !re.test(apiSection);
    });
    assert(
      missing.length === 0,
      `Exports not documented in engine.md:\n  ${missing.join('\n  ')}`
    );
  });

  test('TC6.5b: no extra names in the "Public engine API" section', () => {
    // Pull anything that looks like a function name in backticks
    const candidates = new Set();
    const re = /`([a-z][A-Za-z0-9_]+)`/g;
    let m;
    while ((m = re.exec(apiSection)) !== null) {
      candidates.add(m[1]);
    }
    // Filter to only items that look like API names: camelCase starting with
    // verb-ish or noun-ish prefixes used in this codebase. A simple heuristic:
    // ignore short/lowercase tokens like 'state', 'opts'.
    const apiLike = [...candidates].filter((c) =>
      /^(simulate|find|compute|validate|step|create|reduce|apply|sell|inflate|drawdown)/.test(c)
    );
    const extras = apiLike.filter((c) => !exportedNames.includes(c));
    assert(
      extras.length === 0,
      `engine.md "Public engine API" mentions names not exported by src/engine/index.js:\n  ${extras.join('\n  ')}`
    );
  });
}
