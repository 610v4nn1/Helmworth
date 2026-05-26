/**
 * @fileoverview I1 — Asset creation interaction tests.
 *
 * Walks the full UI flow that the calculation-layer suite never touches:
 *   "+" button → picker modal → class tile → asset form → Create
 *
 * These exist because the previous regression — the help-tip wiring — could
 * have silently broken any of these clicks while every existing test still
 * passed (they cover engine/model/architecture/docs, not DOM behaviour).
 *
 * Skipped automatically in the browser runner via `SKIP_IN_BROWSER` so
 * `runner.html` keeps using the calc-layer suite only.
 */

import { setupApp, SKIP_IN_BROWSER, seqTest } from './_harness.js';

export default async function run({ test, assert }) {
  if (SKIP_IN_BROWSER) return; // never executed in runner.html, but be safe

  seqTest(test, 'TI1.1: clicking "+" opens the picker modal with all 8 class tiles', async () => {
    const app = await setupApp();
    try {
      const addBtn = app.document.getElementById('add-asset-btn');
      app.click(addBtn);
      await app.tick();

      const modal = app.document.querySelector('#modal-root .modal');
      assert(modal !== null, 'picker modal should be open after clicking +');

      const tiles = app.document.querySelectorAll('.picker-grid .picker-btn');
      assert(
        tiles.length === 8,
        `expected 8 class tiles, got ${tiles.length}`,
      );

      const classes = [...tiles].map((b) =>
        [...b.classList].find((c) => c.startsWith('cls-'))?.replace('cls-', ''),
      );
      const expected = ['stocks', 'bonds', 'crypto', 'cash',
        'realEstate', 'privateBusiness', 'pension', 'personalDebt'];
      for (const c of expected) {
        assert(classes.includes(c), `picker missing class tile: ${c}`);
      }
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI1.2: clicking a class tile opens the asset form with the right fields', async () => {
    const app = await setupApp();
    try {
      app.click(app.document.getElementById('add-asset-btn'));
      await app.tick();
      app.click(app.document.querySelector('.picker-btn.cls-stocks'));
      await app.tick();

      const form = app.document.querySelector('form.asset-form');
      assert(form !== null, 'asset form should be rendered');

      // 7 fields for stocks (see classDefs.js: name, value, costBasis,
      // avgReturnRate, yearlyContribution, contributionGrowthRate, capitalGainsTaxRate).
      const fields = form.querySelectorAll('.field');
      assert(fields.length === 7, `expected 7 stocks fields, got ${fields.length}`);

      // The Create button must exist as a real submit button.
      const createBtn = form.querySelector('button[type="submit"]');
      assert(createBtn !== null, 'Create submit button missing');
      assert(/create/i.test(createBtn.textContent), 'submit button text should be "Create"');
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI1.3: every field on the form has a help-tip ("?") next to its label', async () => {
    const app = await setupApp();
    try {
      app.click(app.document.getElementById('add-asset-btn'));
      await app.tick();
      app.click(app.document.querySelector('.picker-btn.cls-stocks'));
      await app.tick();

      const form = app.document.querySelector('form.asset-form');
      const fields = form.querySelectorAll('.field');
      for (const f of fields) {
        const tip = f.querySelector('label .help-tip');
        assert(
          tip !== null,
          `field "${f.querySelector('label')?.textContent?.trim()}" missing a help-tip button`,
        );
        assert(
          tip.getAttribute('type') === 'button',
          'help-tip must be type=button so it does not submit the form',
        );
      }
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI1.4: filling required fields and submitting Create adds an asset and closes the modal', async () => {
    const app = await setupApp();
    try {
      assert(app.store.getState().assets.length === 0, 'sanity: starts with 0 assets');

      app.click(app.document.getElementById('add-asset-btn'));
      await app.tick();
      app.click(app.document.querySelector('.picker-btn.cls-stocks'));
      await app.tick();

      const form = app.document.querySelector('form.asset-form');
      // The "Current value" field is the only required currency field.
      const valueInput = [...form.querySelectorAll('input')].find(
        (i) => i.getAttribute('data-type') === 'currency',
      );
      assert(valueInput !== null, 'currency input not found');
      app.type(valueInput, '12345');
      app.change(valueInput);

      app.submit(form.querySelector('button[type="submit"]'));
      await app.tick();

      const assets = app.store.getState().assets;
      assert(assets.length === 1, `expected 1 asset after Create, got ${assets.length}`);
      assert(assets[0].class === 'stocks', `expected stocks, got ${assets[0].class}`);
      // Stocks store value via lots; the form rewrites lots from the typed value.
      const total = (assets[0].lots ?? []).reduce((s, l) => s + (l.value || 0), 0);
      assert(total === 12345, `expected total lot value 12345, got ${total}`);

      const modalRoot = app.document.getElementById('modal-root');
      assert(modalRoot.hidden === true, 'modal-root should be hidden after successful Create');
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI1.5: submitting with empty required field shows an inline error and does NOT add an asset', async () => {
    const app = await setupApp();
    try {
      app.click(app.document.getElementById('add-asset-btn'));
      await app.tick();
      app.click(app.document.querySelector('.picker-btn.cls-stocks'));
      await app.tick();

      const form = app.document.querySelector('form.asset-form');
      // The "Current value" field is pre-filled with the default ("0"). For
      // this test we want to simulate the user clearing it before submit, so
      // we explicitly blank the input.
      const valueInput = [...form.querySelectorAll('input')].find(
        (i) => i.getAttribute('data-type') === 'currency',
      );
      assert(valueInput !== null, 'currency input not found');
      valueInput.value = '';
      app.change(valueInput);

      app.submit(form.querySelector('button[type="submit"]'));
      await app.tick();

      const formErr = form.querySelector('.form-error');
      assert(
        formErr !== null && formErr.textContent.length > 0,
        'expected a form-level error message after invalid submit',
      );
      // The field-specific error must also be set on the value input.
      const valueFieldEl = valueInput.closest('.field');
      assert(
        valueFieldEl?.querySelector('.error')?.textContent?.length > 0,
        'expected per-field error on the empty currency input',
      );
      assert(
        app.store.getState().assets.length === 0,
        'no asset should be added on invalid submit',
      );
      // Modal must stay open so the user can fix the field.
      const modalRoot = app.document.getElementById('modal-root');
      assert(modalRoot.hidden === false, 'modal should remain open on invalid submit');
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI1.6: real-estate "propertyKind=residence" hides the cashFlow field and shows yearlyCosts', async () => {
    const app = await setupApp();
    try {
      app.click(app.document.getElementById('add-asset-btn'));
      await app.tick();
      app.click(app.document.querySelector('.picker-btn.cls-realEstate'));
      await app.tick();

      const form = app.document.querySelector('form.asset-form');
      const kindSelect = [...form.querySelectorAll('select')].find(
        (s) => s.getAttribute('data-type') === 'option',
      );
      assert(kindSelect !== null, 'propertyKind select not found');

      // Initially: investment → cashFlow visible, yearlyCosts hidden.
      const labelText = (key) => {
        for (const f of form.querySelectorAll('.field')) {
          const label = f.querySelector('label')?.textContent ?? '';
          if (label.toLowerCase().includes(key)) return { field: f, hidden: f.style.display === 'none' };
        }
        return null;
      };
      const cashFlow0 = labelText('cash flow');
      const yearlyCosts0 = labelText('running costs');
      assert(cashFlow0 && !cashFlow0.hidden, 'cashFlow should be visible for investment');
      assert(yearlyCosts0 && yearlyCosts0.hidden, 'yearlyCosts should be hidden for investment');

      // Switch to residence
      kindSelect.value = 'residence';
      app.change(kindSelect);
      await app.tick();

      const cashFlow1 = labelText('cash flow');
      const yearlyCosts1 = labelText('running costs');
      assert(cashFlow1 && cashFlow1.hidden, 'cashFlow should be hidden for residence');
      assert(yearlyCosts1 && !yearlyCosts1.hidden, 'yearlyCosts should be visible for residence');
    } finally { app.teardown(); }
  });
}
