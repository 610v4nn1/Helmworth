/**
 * @fileoverview The "+" asset picker: an 8-button modal grid, one per class,
 * each with neon icon and color. Selecting a class opens the corresponding
 * asset form (assetForms.js).
 * @module src/ui/assetPicker
 */

import { h, setChildren, createIcon } from './dom.js';
import { CLASSES } from './classDefs.js';
import { openModal, closeModal } from './modal.js';
import { openAssetForm } from './assetForms.js';

/**
 * Opens the picker modal. Selecting a class delegates to openAssetForm.
 * @param {Object} store
 */
export function openAssetPicker(store) {
  const grid = h('div', {
    className: 'picker-grid',
    children: CLASSES.map((cls) =>
      h('button', {
        className: `picker-btn cls-${cls.key}`,
        attrs: { type: 'button' },
        on: { click: () => {
          closeModal();
          openAssetForm(store, cls.key);
        }},
        children: [
          createIcon(cls.icon, 'icon'),
          h('span', { className: 'label', children: cls.label }),
        ],
      })
    ),
  });

  openModal({
    title: 'Add an asset',
    body: grid,
  });
}
