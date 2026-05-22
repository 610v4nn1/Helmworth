// Node-side shim that runs the same test modules the browser runner runs.
// Used purely for dev verification; the browser runner remains source of truth.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assert, assertClose, assertDeepEqual, assertThrows } from './assert.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// fetch shim that reads from disk relative to tests/runner.html
globalThis.fetch = async (url) => {
  // Strip query strings if any
  const cleanUrl = String(url).split('?')[0];
  // Resolve relative to tests/ (where runner.html lives)
  const path = resolve(__dirname, cleanUrl);
  try {
    const text = readFileSync(path, 'utf8');
    return { ok: true, status: 200, text: async () => text };
  } catch (err) {
    return { ok: false, status: 404, text: async () => '' };
  }
};

// localStorage stub for any incidental usage
globalThis.localStorage = undefined; // calc layer must handle this gracefully

let passed = 0;
let failed = 0;
const failures = [];
const pendingAsync = [];

const ctx = {
  test(name, fn) {
    try {
      const ret = fn();
      if (ret && typeof ret.then === 'function') {
        pendingAsync.push(
          ret.then(
            () => { passed++; },
            (err) => { failed++; failures.push({ name, err: err.message }); }
          )
        );
      } else {
        passed++;
      }
    } catch (err) {
      failed++;
      failures.push({ name, err: err.message });
    }
  },
  assert,
  assertClose,
  assertDeepEqual,
  assertThrows,
};

const suites = [
  ['C1 Model',          './unit/c1.model.test.js'],
  ['C1 Format',         './unit/c1.format.test.js'],
  ['C2 Engine',         './unit/c2.engine.test.js'],
  ['C3 State',          './unit/c3.state.test.js'],
  ['C4 Coast FIRE',     './unit/c4.coastfire.test.js'],
  ['C4 FIRE',           './unit/c4.fire.test.js'],
  ['C4 Sale',           './unit/c4.sale.test.js'],
  ['C4 Stats',          './unit/c4.stats.test.js'],
  ['C5 Forbidden',      './arch/forbidden-imports.test.js'],
  ['C5 No-UI',          './arch/no-ui-imports.test.js'],
  ['C5 Engine API',     './arch/engine-public-api.test.js'],
  ['C5 Purity',         './arch/purity.test.js'],
  ['C6 Coverage',       './docs/jsdoc-coverage.test.js'],
  ['C6 Formula',        './docs/jsdoc-formula.test.js'],
  ['C6 Pure',           './docs/jsdoc-pure.test.js'],
  ['C6 Engine.md',      './docs/engine-md.test.js'],
  ['C6 API sync',       './docs/api-doc-sync.test.js'],
  ['C6 Cross-refs',     './docs/cross-refs.test.js'],
  ['C6 Factory-fields', './docs/factory-fields-doc-sync.test.js'],
  ['C6 Methodology',    './docs/methodology-cross-refs.test.js'],
  ['U2 Chart',          './unit/u2.chart.test.js'],
  ['U3 Import/Export',  './unit/u3.imex.test.js'],
  ['U4 SaleConversion', './unit/u4.saleConversion.test.js'],
];

for (const [label, path] of suites) {
  process.stdout.write(`\n== ${label} ==\n`);
  try {
    const mod = await import(path);
    await mod.default(ctx);
  } catch (err) {
    failed++;
    failures.push({ name: `${label} suite load`, err: err.stack || err.message });
  }
}

// Drain async
while (pendingAsync.length) {
  const batch = pendingAsync.splice(0);
  await Promise.all(batch);
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.name}: ${f.err}`);
  }
  process.exit(1);
}
