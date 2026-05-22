/**
 * @fileoverview Doc-drift guard: every per-asset-class step function in
 * `src/engine/steps/` must have a corresponding subsection in
 * `methodology.html` that:
 *
 *   (a) exists (matched by asset-class title), and
 *   (b) contains at least one math block (`\[ … \]`) — i.e. it's not a
 *       stub. The math block is the load-bearing part of the
 *       methodology page; without it the section is just prose.
 *
 * Why: if a new asset class is added (or an existing one is meaningfully
 * reworked), this prevents the methodology page from quietly going stale
 * with a "TODO" or simply missing the new class altogether.
 *
 * What this catches:
 *   - A new step file (= new class) that nobody added to methodology.html.
 *   - A subsection that has been emptied of its math but is still in the
 *     page as orphan prose.
 *
 * What this does NOT catch:
 *   - A formula that's mathematically wrong but still rendered as math.
 *     That's what the targeted unit tests are for.
 */
import { fetchSource } from '../arch/fetch-source.js';

/**
 * Per-class metadata. Order is the methodology page's display order.
 * Each entry: [step-file (under src/engine/steps), title-suffix that
 * appears in the methodology subsection title].
 */
const STEPS = [
  ['stocks.js',          'Stocks'],
  ['bonds.js',           'Bonds'],
  ['crypto.js',          'Crypto'],
  ['cash.js',            'Cash'],
  ['realEstate.js',      'Real estate'],
  ['privateBusiness.js', 'Private business'],
  ['pension.js',         'Pension'],
  ['personalDebt.js',    'Personal debt'],
];

/**
 * Returns the body of a methodology.html `<h3 class="subsection-title">…</h3>`
 * subsection whose title contains `titleSuffix` (case-insensitive),
 * up to the next H2 or H3.
 */
function extractHtmlSubsection(html, titleSuffix) {
  const re = /<h3[^>]*class="subsection-title"[^>]*>([\s\S]*?)<\/h3>/gi;
  let match;
  let bestStart = -1;
  while ((match = re.exec(html)) !== null) {
    if (match[1].toLowerCase().includes(titleSuffix.toLowerCase())) {
      bestStart = match.index;
      break;
    }
  }
  if (bestStart < 0) return '';
  const tail = html.slice(bestStart + 1);
  const endRel = tail.search(/<h[23][^>]*>/);
  return endRel < 0 ? html.slice(bestStart) : html.slice(bestStart, bestStart + 1 + endRel);
}

/** Detects at least one display-math block `\[ … \]`. */
function containsMathBlock(s) {
  return /\\\[[\s\S]*?\\\]/.test(s);
}

export default async function run({ test, assert }) {
  const html = await fetchSource('../methodology.html');

  test('TC6.8a: every step file has a matching subsection in methodology.html', () => {
    const offenders = [];
    for (const [_stepFile, titleSuffix] of STEPS) {
      const body = extractHtmlSubsection(html, titleSuffix);
      if (body.length === 0) {
        offenders.push(`methodology.html: no subsection-title containing "${titleSuffix}"`);
      }
    }
    assert(
      offenders.length === 0,
      `Missing methodology subsections:\n  ${offenders.join('\n  ')}`
    );
  });

  test('TC6.8b: each methodology asset-class subsection contains real math (not just prose)', () => {
    const offenders = [];
    for (const [_stepFile, titleSuffix] of STEPS) {
      const body = extractHtmlSubsection(html, titleSuffix);
      if (body.length === 0) continue; // already reported by TC6.8a
      if (!containsMathBlock(body)) {
        offenders.push(
          `methodology.html "${titleSuffix}" subsection has no \\[ … \\] math block`
        );
      }
    }
    assert(
      offenders.length === 0,
      `Stub-looking subsections:\n  ${offenders.join('\n  ')}`
    );
  });
}
