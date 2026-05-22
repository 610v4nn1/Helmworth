/**
 * @fileoverview Renders the asset cards grid + the live net-worth header.
 * Subscribes to the store so any state change re-renders the list.
 * @module src/ui/assetList
 */

import { setChildren, h } from './dom.js';
import { renderAssetCard } from './assetCard.js';
import { formatCurrency } from './format.js';
import { computeNetWorth } from '../engine/index.js';

/**
 * Mounts the asset list + net-worth header.
 * @param {HTMLElement} listEl - Asset grid container
 * @param {HTMLElement} nwEl - Net-worth value element
 * @param {Object} store
 */
export function mountAssetList(listEl, nwEl, store) {
  // Track which card is expanded (only one at a time)
  let expandedId = null;

  function setExpanded(id) {
    expandedId = id;
    render();
  }

  // Close the expanded card on Escape (parity with modal UX).
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expandedId !== null) {
      // If a real modal is open, let it handle Escape first.
      const modalRoot = document.getElementById('modal-root');
      if (modalRoot && !modalRoot.hasAttribute('hidden')) return;
      setExpanded(null);
    }
  });

  function render() {
    const { assets } = store.getState();

    // If the previously-expanded asset no longer exists (e.g., user just
    // deleted it), drop the expanded state so the overlay/backdrop are
    // cleaned up properly below.
    if (expandedId !== null && !assets.some((a) => a.id === expandedId)) {
      expandedId = null;
    }

    // Asset cards
    const cards = assets.map((a) =>
      renderAssetCard(a, store, a.id === expandedId, setExpanded)
    );
    setChildren(listEl, cards);

    // Reflect expanded state on <body> so CSS can dim everything else and
    // lift the expanded card into a centered overlay. The backdrop element
    // itself is a fixed-position pseudo-modal; a click on it collapses
    // the card.
    const body = document.body;
    let backdrop = document.getElementById('card-backdrop');
    if (expandedId !== null) {
      body.classList.add('has-expanded-card');
      if (!backdrop) {
        backdrop = h('div', {
          attrs: { id: 'card-backdrop' },
          className: 'card-backdrop',
          on: { click: () => setExpanded(null) },
        });
        body.appendChild(backdrop);
      }
    } else {
      body.classList.remove('has-expanded-card');
      if (backdrop) backdrop.remove();
      // Also clean up any orphan overlay card from the previous render.
      const orphan = document.getElementById('asset-card-overlay');
      if (orphan) orphan.remove();
    }

    // Net worth header
    const nw = computeNetWorth(assets);
    nwEl.textContent = formatCurrency(nw, { digits: 0 });
    nwEl.classList.toggle('negative', nw < 0);
  }

  render();
  store.subscribe(render);
}
