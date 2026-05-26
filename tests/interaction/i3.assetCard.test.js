/**
 * @fileoverview I3 — Expanded asset-card interaction tests.
 *
 * Covers the inline-edit overlay that opens when a card is clicked:
 *   - clicking a collapsed card opens the overlay;
 *   - editing a field updates the store live;
 *   - clicking Update closes the overlay and persists the latest values;
 *   - clicking Delete opens a confirmation modal; confirming removes the asset.
 *
 * Skipped in the browser runner via SKIP_IN_BROWSER.
 */

import { setupApp, SKIP_IN_BROWSER, seqTest } from './_harness.js';

/** Seed the store with a stocks asset so we have a card to interact with. */
async function withStockAsset(app, value = 10000) {
  const { createStocks } = await import(`../../src/model/assets.js`);
  app.store.addAsset(createStocks({ name: 'Test Stocks', value, avgReturnRate: 0.07 }));
  await app.tick();
}

export default async function run({ test, assert }) {
  if (SKIP_IN_BROWSER) return;

  seqTest(test, 'TI3.1: clicking a collapsed card opens the expanded overlay (with Delete + Update)', async () => {
    const app = await setupApp();
    try {
      await withStockAsset(app);

      const collapsed = app.document.querySelector('#asset-list .asset-card');
      assert(collapsed !== null, 'precondition: a collapsed card should be in the list');

      app.click(collapsed);
      await app.tick();

      const overlay = app.document.getElementById('asset-card-overlay');
      assert(overlay !== null, 'expanded overlay should be appended to the document');
      assert(overlay.classList.contains('expanded'), 'overlay should carry the .expanded class');
      assert(
        overlay.querySelector('.delete-btn') !== null,
        'overlay must have a Delete button',
      );
      assert(
        overlay.querySelector('.update-btn') !== null,
        'overlay must have an Update button',
      );
      // The card-backdrop element is also added (used as the dismiss-on-click backdrop).
      assert(
        app.document.getElementById('card-backdrop') !== null,
        'card backdrop should be present while expanded',
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI3.2: editing a field in the expanded card updates the store live', async () => {
    const app = await setupApp();
    try {
      await withStockAsset(app, 10000);
      const card = app.document.querySelector('#asset-list .asset-card');
      app.click(card);
      await app.tick();

      const overlay = app.document.getElementById('asset-card-overlay');
      // The "Name" text input is the easiest field to assert on (no formatting).
      const nameInput = [...overlay.querySelectorAll('input')].find(
        (i) => i.getAttribute('data-type') === 'text',
      );
      assert(nameInput !== null, 'name input not found on expanded card');

      nameInput.value = 'Renamed';
      app.change(nameInput); // change handler defers via Promise.resolve; tick to drain it.
      await app.tick();

      const assets = app.store.getState().assets;
      assert(assets.length === 1, 'still exactly one asset');
      assert(
        assets[0].name === 'Renamed',
        `asset name should be "Renamed", got "${assets[0].name}"`,
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI3.3: clicking Update commits any pending edits and closes the overlay', async () => {
    const app = await setupApp();
    try {
      await withStockAsset(app, 10000);
      app.click(app.document.querySelector('#asset-list .asset-card'));
      await app.tick();

      const overlay = app.document.getElementById('asset-card-overlay');
      const nameInput = [...overlay.querySelectorAll('input')].find(
        (i) => i.getAttribute('data-type') === 'text',
      );
      // Set a new name but DO NOT fire change — Update must still pick it up
      // (this is exactly the "user typed and clicked Update before blur" path
      // the existing assetCard.js code goes out of its way to handle).
      nameInput.value = 'Final Name';

      app.click(overlay.querySelector('.update-btn'));
      await app.tick();

      assert(
        app.document.getElementById('asset-card-overlay') === null,
        'overlay must be removed from the DOM after Update',
      );
      assert(
        app.store.getState().assets[0].name === 'Final Name',
        'Update must commit the typed-but-not-blurred edit',
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI3.4: clicking Delete opens a confirm dialog; confirming removes the asset', async () => {
    const app = await setupApp();
    try {
      await withStockAsset(app);
      assert(app.store.getState().assets.length === 1, 'precondition: 1 asset');

      app.click(app.document.querySelector('#asset-list .asset-card'));
      await app.tick();

      const overlay = app.document.getElementById('asset-card-overlay');
      const deleteBtn = overlay.querySelector('.delete-btn');
      app.click(deleteBtn);
      await app.tick();

      // The overlay closes first; then a confirm modal opens.
      assert(
        app.document.getElementById('asset-card-overlay') === null,
        'overlay should close before confirmation appears',
      );
      const confirmBody = app.document.querySelector('#modal-root .confirm-body');
      assert(confirmBody !== null, 'confirm dialog should be rendered');
      const confirmBtn = [...confirmBody.querySelectorAll('button')].find(
        (b) => /delete/i.test(b.textContent),
      );
      assert(confirmBtn !== null, 'expected a "Delete" confirm button');

      app.click(confirmBtn);
      await app.tick();

      assert(
        app.store.getState().assets.length === 0,
        'asset must be removed after confirming delete',
      );
      assert(
        app.document.getElementById('modal-root').hidden === true,
        'confirm modal should close',
      );
    } finally { app.teardown(); }
  });

  seqTest(test, 'TI3.5: clicking Delete then Cancel keeps the asset', async () => {
    const app = await setupApp();
    try {
      await withStockAsset(app);
      app.click(app.document.querySelector('#asset-list .asset-card'));
      await app.tick();

      app.click(app.document.querySelector('.delete-btn'));
      await app.tick();

      const cancelBtn = [...app.document.querySelectorAll('#modal-root button')].find(
        (b) => /cancel/i.test(b.textContent),
      );
      assert(cancelBtn !== null, 'Cancel button should be present in the confirm dialog');
      app.click(cancelBtn);
      await app.tick();

      assert(
        app.store.getState().assets.length === 1,
        'asset must NOT be removed when delete is cancelled',
      );
    } finally { app.teardown(); }
  });
}
