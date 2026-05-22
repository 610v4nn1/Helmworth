/**
 * @fileoverview Doc-drift guard: every parameter accepted by an asset
 * factory in `src/model/assets.js` must be referenced (by its exact name)
 * in the matching class section of `docs/engine.md`.
 *
 * Why: when someone adds (or renames) a field on, say, Stocks, it's easy
 * to forget to update engine.md. Without this test the doc silently rots.
 *
 * What this catches:
 *   - A new factory parameter that isn't named anywhere in engine.md.
 *   - A renamed parameter where engine.md still mentions the old name (the
 *     missing new name fails the check; the leftover old name will look
 *     like dead text in the doc but won't fail this test — that's a
 *     code-review concern).
 *
 * What this does NOT catch:
 *   - Drift in `methodology.html`. That page is intentionally written in
 *     mathematical notation (Greek letters, formulas) for end users
 *     rather than JS field names, so a name-equality check would force
 *     ugly prose. Methodology drift is partially covered by
 *     `methodology-cross-refs.test.js` (every class section exists and
 *     contains a math block).
 *   - A formula that is mentioned by name but is mathematically wrong.
 *     Use the targeted unit tests for that.
 */
import { fetchSource } from '../arch/fetch-source.js';

/**
 * Map of factory-name → engine.md `### heading`.
 */
const FACTORIES = [
  ['createStocks',          '### Stocks'],
  ['createBonds',           '### Bonds'],
  ['createCrypto',          '### Crypto'],
  ['createCash',            '### Cash'],
  ['createRealEstate',      '### Real estate'],
  ['createPrivateBusiness', '### Private business'],
  ['createPension',         '### Pension'],
  ['createPersonalDebt',    '### Personal debt'],
];

/**
 * Parameters that aren't user-facing economic inputs and therefore don't
 * need to be mentioned in the docs.
 *
 *   - `name` is a free-text label.
 *   - `propertyKind` IS user-facing for real-estate, but the docs already
 *     describe it via the "investment" / "residence" branch — we still
 *     check the keyword shows up below.
 */
const STRUCTURAL_PARAMS = new Set(['name']);

/**
 * Extracts the destructured parameter names from a `function createXxx({ … } = {})`
 * signature in the source text. Robust to multi-line signatures with default
 * values.
 *
 * @param {string} src
 * @param {string} factoryName
 * @returns {string[]} parameter names, in source order
 */
function extractFactoryParams(src, factoryName) {
  // Find the start of the function declaration.
  const declRe = new RegExp(`function\\s+${factoryName}\\s*\\(`);
  const m = declRe.exec(src);
  if (!m) return [];

  // Locate the opening '{' of the destructuring pattern (skipping whitespace
  // after the opening '(').
  let i = m.index + m[0].length; // position right after '('
  while (i < src.length && /\s/.test(src[i])) i++;
  if (src[i] !== '{') return []; // not a destructured signature

  // Walk forward, tracking brace depth, to find the MATCHING closing '}'.
  // This is the key fix: a regex like /\{([\s\S]*)\}/ is greedy and grabs
  // far too much when the source contains `} = {}`.
  let depth = 0;
  const start = i + 1;
  let end = -1;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return [];

  const inner = src.slice(start, end);

  // Split on commas at depth 0 — handles defaults like `foo = 0.07`.
  const params = [];
  let depthBrace = 0;
  let depthParen = 0;
  let buf = '';
  for (const ch of inner) {
    if (ch === '{' || ch === '[') depthBrace++;
    else if (ch === '}' || ch === ']') depthBrace--;
    else if (ch === '(') depthParen++;
    else if (ch === ')') depthParen--;
    if (ch === ',' && depthBrace === 0 && depthParen === 0) {
      params.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) params.push(buf.trim());

  // Each param looks like "name" or "name = default". Take the LHS up to '='.
  return params
    .map((p) => p.split('=')[0].trim())
    .filter((p) => p.length > 0 && /^[A-Za-z_]/.test(p));
}

/**
 * Returns the body of an `engine.md` `### <heading>` subsection (until
 * the next heading at level 2 or 3).
 */
function extractMdSection(md, heading) {
  const lines = md.split('\n');
  const startIdx = lines.findIndex((l) => l.trim() === heading);
  if (startIdx < 0) return '';
  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || /^###\s/.test(lines[i])) { endIdx = i; break; }
  }
  return lines.slice(startIdx, endIdx).join('\n');
}

export default async function run({ test, assert }) {
  const assetsSrc = await fetchSource('../src/model/assets.js');
  const md        = await fetchSource('../docs/engine.md');

  test('TC6.7: every factory parameter is named in engine.md', () => {
    const offenders = [];
    for (const [factoryName, mdHeading] of FACTORIES) {
      const params = extractFactoryParams(assetsSrc, factoryName);
      assert(params.length > 0, `Could not extract params for ${factoryName}`);

      const mdSection = extractMdSection(md, mdHeading);
      assert(mdSection.length > 0, `engine.md is missing section "${mdHeading}"`);

      for (const p of params) {
        if (STRUCTURAL_PARAMS.has(p)) continue;
        const re = new RegExp(`\\b${p}\\b`);
        if (!re.test(mdSection)) {
          offenders.push(
            `${factoryName}: parameter "${p}" missing from engine.md section "${mdHeading}"`
          );
        }
      }
    }
    assert(
      offenders.length === 0,
      `Doc drift detected:\n  ${offenders.join('\n  ')}`
    );
  });
}
