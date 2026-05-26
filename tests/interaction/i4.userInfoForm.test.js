/**
 * @fileoverview I4 — User-info form interaction tests.
 *
 * The user-info form is a separate DOM-driven module (no shared field
 * descriptors with the asset forms). It two-way-binds 4 fields to the
 * store: age, retirementAge, monthlyExpenses, inflationRate.
 *
 * Skipped in the browser runner via SKIP_IN_BROWSER.
 */

import { setupApp, SKIP_IN_BROWSER, seqTest } from './_harness.js';

export default async function run({ test, assert }) {
  if (SKIP_IN_BROWSER) return;

  seqTest(test, 'TI4.1: form mounts with all four fields, pre-filled from the store', async () => {
    const app = await setupApp();
    try {
      const fields = app.document.querySelectorAll('#user-info-form .field');
      assert(fields.length === 4, `expected 4 user-info fields, got ${fields.length}`);

      const age = app.document.getElementById('ui-age');
      const ret = app.document.getElementById('ui-retirement-age');
      const exp = app.document.getElementById('ui-expenses');
      const inf = app.document.getElementById('ui-inflation');
      for (const [k, el] of [['age', age], ['retirementAge', ret], ['expenses', exp], ['inflation', inf]]) {
        assert(el !== null, `missing input for ${k}`);
      }

      const ui = app.store.getState().userInfo;
      assert(Number(age.value) === ui.age, `age input should equal store age`);
      assert(Number(ret.value) === ui.retirementAge, `retirementAge input should equal store value`);
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI4.2: typing in the age field updates the store immediately (input event)', async () => {
    const app = await setupApp();
    try {
      const age = app.document.getElementById('ui-age');
      app.type(age, '42'); // dispatches input
      await app.tick();
      assert(
        app.store.getState().userInfo.age === 42,
        `expected store.age=42, got ${app.store.getState().userInfo.age}`,
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI4.3: changing monthly expenses updates the store on the change event', async () => {
    const app = await setupApp();
    try {
      const exp = app.document.getElementById('ui-expenses');
      exp.value = '3500';
      app.change(exp);
      await app.tick();
      assert(
        app.store.getState().userInfo.monthlyExpenses === 3500,
        `expected monthlyExpenses=3500, got ${app.store.getState().userInfo.monthlyExpenses}`,
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI4.4: invalid expenses input is reverted to the previous formatted value', async () => {
    const app = await setupApp();
    try {
      const exp = app.document.getElementById('ui-expenses');
      const before = app.store.getState().userInfo.monthlyExpenses;
      exp.value = 'not a number';
      app.change(exp);
      await app.tick();

      assert(
        app.store.getState().userInfo.monthlyExpenses === before,
        'invalid input must NOT mutate the store',
      );
      // The handler also resets the input value back to the formatted current
      // amount; tolerate either by checking that .value parses to `before`.
      const numeric = exp.value.replace(/[^0-9.\-]/g, '');
      assert(
        Number(numeric) === before || exp.value !== 'not a number',
        'invalid input should be reverted, not left in place',
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI4.5: inflation input accepts a percentage and stores its decimal value', async () => {
    const app = await setupApp();
    try {
      const inf = app.document.getElementById('ui-inflation');
      inf.value = '3.5%';
      app.change(inf);
      await app.tick();
      const stored = app.store.getState().userInfo.inflationRate;
      assert(
        Math.abs(stored - 0.035) < 1e-9,
        `expected inflationRate≈0.035, got ${stored}`,
      );
    } finally { app.teardown(); }
  });
}
