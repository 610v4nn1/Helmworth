/**
 * @fileoverview I2 — Help-tip popup interaction tests.
 *
 * Verifies the "?" affordance attached to every form field:
 *   - clicking it opens the popup;
 *   - clicking the X close button closes it;
 *   - Esc closes it;
 *   - backdrop click closes it;
 *   - it does NOT dismiss the underlying asset-creation modal;
 *   - focus returns to the trigger after close.
 *
 * Runs only in Node (skipped in the browser runner via SKIP_IN_BROWSER).
 */

import { setupApp, SKIP_IN_BROWSER, seqTest } from './_harness.js';

async function openFormWithTip(app) {
  app.click(app.document.getElementById('add-asset-btn'));
  await app.tick();
  app.click(app.document.querySelector('.picker-btn.cls-stocks'));
  await app.tick();
  const form = app.document.querySelector('form.asset-form');
  const tip = form.querySelector('.help-tip');
  return { form, tip };
}

export default async function run({ test, assert }) {
  if (SKIP_IN_BROWSER) return;

  seqTest(test, 'TI2.1: clicking a "?" tip opens a popup with title, body paragraphs, and X button', async () => {
    const app = await setupApp();
    try {
      const { tip } = await openFormWithTip(app);
      assert(tip !== null, 'precondition: form should have at least one help-tip');
      app.click(tip);
      await app.tick();

      const popup = app.document.querySelector('#help-popup-root .help-popup');
      assert(popup !== null, 'popup should be in the DOM after clicking ?');

      const root = app.document.getElementById('help-popup-root');
      assert(root.hidden === false, 'popup root should be visible');

      assert(
        popup.querySelector('.help-popup-title')?.textContent.length > 0,
        'popup must have a non-empty title',
      );
      const paras = popup.querySelectorAll('.help-popup-para');
      assert(paras.length > 0, 'popup must render at least one paragraph');
      // Plain-text rendering — no rogue HTML elements injected from copy.
      for (const p of paras) {
        assert(p.children.length === 0, 'help paragraphs must be plain text (no child elements)');
      }

      const x = popup.querySelector('.help-popup-close');
      assert(x !== null, 'popup must have an X close button');
      assert(x.getAttribute('aria-label') === 'Close', 'X button needs aria-label="Close"');
      assert(x.getAttribute('type') === 'button', 'X button must be type=button');
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI2.2: clicking X closes the popup and returns focus to the trigger', async () => {
    const app = await setupApp();
    try {
      const { tip } = await openFormWithTip(app);
      app.click(tip);
      await app.tick(20); // give setTimeout(focus) a chance to run

      const x = app.document.querySelector('.help-popup-close');
      app.click(x);
      await app.tick();

      const root = app.document.getElementById('help-popup-root');
      assert(root.hidden === true, 'popup root should be hidden after X click');
      assert(
        app.document.querySelector('.help-popup') === null,
        'popup element should be removed from the DOM',
      );
      assert(
        app.document.activeElement === tip,
        'focus should return to the help-tip trigger after close',
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI2.3: pressing Escape closes the popup but NOT the underlying modal', async () => {
    const app = await setupApp();
    try {
      const { tip } = await openFormWithTip(app);
      app.click(tip);
      await app.tick();

      assert(
        app.document.getElementById('help-popup-root').hidden === false,
        'precondition: popup is open',
      );

      app.pressKey('Escape');
      await app.tick();

      assert(
        app.document.getElementById('help-popup-root').hidden === true,
        'popup must close on Escape',
      );
      // The asset-form modal must still be visible — Esc on the popup
      // should not bubble up and dismiss it.
      assert(
        app.document.getElementById('modal-root').hidden === false,
        'underlying asset-form modal must remain open',
      );
      assert(
        app.document.querySelector('form.asset-form') !== null,
        'form should still be present',
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI2.4: clicking the popup backdrop closes the popup; clicking the popup body does not', async () => {
    const app = await setupApp();
    try {
      const { tip } = await openFormWithTip(app);
      app.click(tip);
      await app.tick();

      const root = app.document.getElementById('help-popup-root');
      const popup = root.querySelector('.help-popup');

      // Click on the body of the popup → should NOT close.
      app.click(popup.querySelector('.help-popup-body'));
      await app.tick();
      assert(root.hidden === false, 'click inside popup body must NOT close it');

      // Click on the root (backdrop) directly → should close.
      root.dispatchEvent(new app.window.MouseEvent('click', { bubbles: true, cancelable: true }));
      await app.tick();
      assert(root.hidden === true, 'click on backdrop must close the popup');
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI2.5: opening the popup from inside a form does not submit the form', async () => {
    const app = await setupApp();
    try {
      const { form, tip } = await openFormWithTip(app);

      let submitted = false;
      form.addEventListener('submit', () => { submitted = true; });

      app.click(tip);
      await app.tick();

      assert(submitted === false, 'help-tip click must not submit the surrounding form');
      assert(app.store.getState().assets.length === 0, 'no asset should have been created');
    } finally { app.teardown(); }
  });
}
