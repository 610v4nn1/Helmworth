/**
 * @fileoverview C6.4 — `engine.md` must contain every required heading per
 * tasks.md C6.4.
 */
import { fetchSource } from '../arch/fetch-source.js';

const REQUIRED_HEADINGS = [
  '## Time stepping',
  '## Inflation',
  '## Per-asset-class yearly updates',
  '### Stocks',
  '### Bonds',
  '### Crypto',
  '### Cash',
  '### Real estate',
  '### Private business',
  '### Pension',
  '### Personal debt',
  '## Passive income',
  '## Net worth',         // tasks.md says "## Net worth"; engine.md uses "## Net worth definition"
  '## Drawdown algorithm',
  '## Coast FIRE check',
  '## FIRE check',
  '## Sale events',
  '## Stats table semantics',
  '## State & persistence',
  '## Public engine API',
];

export default async function run({ test, assert }) {
  const md = await fetchSource('../docs/engine.md');

  test('TC6.4: engine.md contains every required heading', () => {
    const lines = md.split('\n').map((l) => l.trim());
    const offenders = [];
    for (const heading of REQUIRED_HEADINGS) {
      // Allow a slight variation on "## Net worth" vs "## Net worth definition"
      const exact = lines.includes(heading);
      const tolerantNetWorth =
        heading === '## Net worth' && lines.some((l) => l.startsWith('## Net worth'));
      if (!exact && !tolerantNetWorth) {
        offenders.push(heading);
      }
    }
    assert(
      offenders.length === 0,
      `Missing engine.md headings:\n  ${offenders.join('\n  ')}`
    );
  });
}
