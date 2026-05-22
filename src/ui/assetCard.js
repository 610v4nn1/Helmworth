/**
 * @fileoverview Renders an asset card. Click to expand → fields editable
 * inline; typing in any field updates the store live (and triggers a
 * re-render via the subscribe loop).
 *
 * When expanded, the card lifts out of the grid into a fixed, centered
 * overlay (modal-like). To prevent the grid from reflowing while the
 * card is expanded, an invisible placeholder card is rendered in the
 * original grid slot.
 *
 * @module src/ui/assetCard
 */

import { h, refreshIcons, createIcon } from './dom.js';
import { formatCurrency } from './format.js';
import { renderField, readField } from './fieldEditor.js';
import { getClassDef, FIELDS } from './classDefs.js';
import { assetNetValue } from '../model/assets.js';
import { confirmDialog } from './modal.js';

/**
 * Builds a single asset card (collapsed by default, expanded if `expanded`).
 * @param {Object} asset
 * @param {Object} store
 * @param {boolean} expanded
 * @param {(id: string|null) => void} onToggleExpand
 * @returns {HTMLElement} The grid-slot element. When expanded, it is an
 *   invisible placeholder and the real card is appended to <body>.
 */
export function renderAssetCard(asset, store, expanded, onToggleExpand) {
  const def = getClassDef(asset.class);
  const fields = FIELDS[asset.class] ?? [];

  // ──────────────────────────────────────────────────────────────────────
  // Collapsed presentation — used both as the in-grid card and (when
  // expanded) as the invisible placeholder so the grid doesn't reflow.
  // ──────────────────────────────────────────────────────────────────────
  const collapsedHeader = h('div', { className: 'card-header', children: [
    h('div', { className: 'header-left', children: [
      createIcon(def.icon, 'icon'),
      h('div', { children: [
        h('div', { className: 'name', children: asset.name || def.label }),
        h('div', { className: 'meta', children: subtitleFor(asset) }),
      ]}),
    ]}),
    h('div', { className: 'header-right', children: [
      h('span', {
        className: 'value',
        children: formatCurrency(assetNetValue(asset), { digits: 0 }),
      }),
    ]}),
  ]});

  // Not expanded: a normal in-grid card, click-to-expand.
  if (!expanded) {
    const card = h('div', {
      className: `asset-card cls-${asset.class}`,
      on: {
        click: (e) => {
          if (e.target.closest('input, select, button, label')) return;
          onToggleExpand(asset.id);
        },
      },
      children: [collapsedHeader],
    });
    refreshIcons();
    return card;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Expanded: build a modal-style overlay card and a placeholder for the
  // original grid slot. We append the overlay to <body> so it isn't clipped
  // by ancestor `overflow: hidden` (the grid card has `overflow: hidden`
  // for its left accent stripe).
  // ──────────────────────────────────────────────────────────────────────
  const placeholder = h('div', {
    className: `asset-card cls-${asset.class} placeholder`,
    children: [collapsedHeader],
  });

  const overlay = h('div', {
    className: `asset-card cls-${asset.class} expanded`,
    on: {
      // Clicks inside the overlay should never bubble to the backdrop.
      click: (e) => e.stopPropagation(),
    },
  });

  // Build expanded content: header (with close button) + editable fields
  // + actions.
  const closeBtn = h('button', {
    className: 'card-close-btn',
    attrs: { type: 'button', 'aria-label': 'Close' },
    on: { click: (e) => { e.stopPropagation(); onToggleExpand(null); }},
    children: '×',
  });

  const overlayHeader = h('div', { className: 'card-header', children: [
    h('div', { className: 'header-left', children: [
      createIcon(def.icon, 'icon'),
      h('div', { children: [
        h('div', { className: 'name', children: asset.name || def.label }),
        h('div', { className: 'meta', children: subtitleFor(asset) }),
      ]}),
    ]}),
    h('div', { className: 'header-right', children: [
      h('span', {
        className: 'value',
        children: formatCurrency(assetNetValue(asset), { digits: 0 }),
      }),
      closeBtn,
    ]}),
  ]});
  overlay.appendChild(overlayHeader);

  const fieldsEl = h('div', { className: 'expanded-fields' });
  const fieldEls = {};
  const fieldInputs = {};

  // Hide/show fields whose `showWhen` no longer matches the current asset.
  function applyConditionalVisibility() {
    for (const f of fields) {
      if (!f.showWhen) continue;
      const matches = Object.entries(f.showWhen).every(([k, v]) => {
        const ctrl = fieldInputs[k];
        if (!ctrl) return true;
        return ctrl.value === v;
      });
      const el = fieldEls[f.key];
      if (el) el.style.display = matches ? '' : 'none';
    }
  }

  for (const f of fields) {
    const initial = asset[f.key];
    const { field: fieldEl, input } = renderField(f, initial, { store, currentAssetId: asset.id });
    fieldEls[f.key] = fieldEl;
    fieldInputs[f.key] = input;
    input.addEventListener('change', () => {
      const r = readField(f, input);
      if (r.error) return;
      store.updateAsset(asset.id, { [f.key]: r.value });
    });
    // Refresh visibility when controller fields change. (The store update
    // above will trigger a full re-render too, but doing it locally avoids
    // a flash for option-type controllers.)
    input.addEventListener('change', applyConditionalVisibility);
    input.addEventListener('input', applyConditionalVisibility);
    fieldsEl.appendChild(fieldEl);
  }
  applyConditionalVisibility();

  const actions = h('div', { className: 'form-actions card-actions', children: [
    h('button', {
      className: 'delete-btn',
      attrs: { type: 'button' },
      on: { click: async (e) => {
        e.stopPropagation();
        // Capture identity *before* collapsing the card — the asset object
        // reference will still be valid (state isn't mutated until confirm),
        // but we read these values now for clarity.
        const id = asset.id;
        const label = asset.name || def.label;
        // Close the expanded card first so the user sees only the
        // confirmation dialog (no overlapping card + backdrop + modal).
        onToggleExpand(null);
        const ok = await confirmDialog(
          `Delete "${label}"? This action cannot be undone.`,
          { title: 'Delete asset', confirmLabel: 'Delete', danger: true }
        );
        if (ok) store.removeAsset(id);
      }},
      children: 'Delete',
    }),
    h('button', {
      className: 'update-btn',
      attrs: { type: 'button' },
      // Saving is automatic on every field `change` event, so this button
      // simply closes the expanded card.
      //
      // Subtlety: some inputs (text/number) only fire `change` on blur,
      // and a focused input may have a pending edit. We must NOT call
      // `blur()` synchronously here, because our `change` listener calls
      // `store.updateAsset()` which notifies subscribers synchronously,
      // and `assetList.render()` then destroys the overlay (including
      // this very button) mid-click. That caused the previously-observed
      // "first click reopens, second click closes" glitch.
      //
      // Instead we:
      //   1. Read any pending value from the focused input *directly* and
      //      forward it to the store (matching the existing `change`
      //      listener's behaviour). This avoids relying on a synchronous
      //      blur→change pipeline.
      //   2. Defer the close to the next microtask so it lands after any
      //      re-render triggered by step 1 settles.
      on: { click: (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Step 1: flush a pending edit from the focused input, if any.
        const active = document.activeElement;
        if (
          active &&
          active !== document.body &&
          overlay.contains(active) &&
          fieldInputs &&
          typeof active.matches === 'function' &&
          active.matches('input, select')
        ) {
          // Find which field this input belongs to so we can apply the
          // same parsing the `change` listener would.
          const fieldKey = Object.keys(fieldInputs).find(
            (k) => fieldInputs[k] === active
          );
          if (fieldKey) {
            const fdef = fields.find((f) => f.key === fieldKey);
            if (fdef) {
              const r = readField(fdef, active);
              if (!r.error) {
                store.updateAsset(asset.id, { [fdef.key]: r.value });
              }
            }
          }
        }

        // Step 2: defer the close so any synchronous re-render from
        // step 1 has finished before we collapse.
        Promise.resolve().then(() => onToggleExpand(null));
      }},
      children: 'Update',
    }),
  ]});

  overlay.appendChild(fieldsEl);
  overlay.appendChild(actions);

  // Mount overlay to <body>. setChildren in assetList replaces the grid
  // contents on every render, so we tag the overlay with a known id and
  // remove any previous one before appending the new one.
  const existing = document.getElementById('asset-card-overlay');
  if (existing) existing.remove();
  overlay.id = 'asset-card-overlay';
  document.body.appendChild(overlay);

  refreshIcons();
  return placeholder;
}

/** A short one-line description of the asset for the collapsed card meta. */
function subtitleFor(asset) {
  switch (asset.class) {
    case 'stocks':
    case 'bonds':
    case 'crypto': {
      const lots = asset.lots?.length ?? 0;
      return lots === 1 ? '1 lot' : `${lots} lots`;
    }
    case 'realEstate': {
      const kindLabel = asset.propertyKind === 'residence' ? 'Residence' : 'Investment';
      const detail = asset.mortgageBalance > 0
        ? `${kindLabel} · Mortgage ${formatCurrency(asset.mortgageBalance, { digits: 0 })}`
        : `${kindLabel} · No mortgage`;
      return detail;
    }
    case 'privateBusiness':
      return asset.yearlyDividend > 0
        ? `Dividend: ${formatCurrency(asset.yearlyDividend, { digits: 0 })}/yr`
        : 'No dividend';
    case 'pension':
      return `Starts at ${asset.startingAge}`;
    case 'personalDebt':
      return asset.monthlyPayment > 0
        ? `${formatCurrency(asset.monthlyPayment, { digits: 0 })}/mo`
        : 'No payment';
    default:
      return '';
  }
}
