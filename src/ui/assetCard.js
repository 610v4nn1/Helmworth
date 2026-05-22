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
import { assetNetValue, createLot } from '../model/assets.js';
import { confirmDialog } from './modal.js';

/** Asset classes whose net value lives in `lots[]`, not in a top-level
 * `value` field. The form still exposes a single "Current value" input
 * for ergonomics, so we have to translate edits to that input back into
 * a lots update — and read the displayed value from the lot sum, not
 * from `asset.value` (which doesn't exist on these classes). */
const LOT_BEARING_CLASSES = new Set(['stocks', 'bonds', 'crypto']);

/**
 * Translates a single-field edit into a state patch suitable for
 * `store.updateAsset(id, patch)`. For most fields this is just
 * `{ [key]: value }`, but for the synthetic "value" field on lot-bearing
 * classes we have to rebuild `lots` so the change actually takes effect
 * (assetNetValue for stocks/bonds/crypto is sum(lot.value), it ignores
 * any top-level `value` property).
 *
 * Strategy when editing `value` on a lot-bearing class:
 *   - If the asset already has lots with a positive total, scale every
 *     lot's `value` proportionally to the new total. `costBasis` is left
 *     untouched, so unrealized gains (and therefore the HIFO drawdown
 *     tax math) stay consistent with what the user originally entered.
 *   - Otherwise (no lots, or all-zero lots), collapse to a single lot
 *     at the new value, with `costBasis = newValue` — same shape the
 *     create-asset factory uses.
 */
function buildFieldPatch(asset, key, value) {
  if (key === 'value' && LOT_BEARING_CLASSES.has(asset.class)) {
    const newTotal = Number(value) || 0;
    const oldTotal = (asset.lots ?? []).reduce((s, l) => s + (l.value || 0), 0);
    if (oldTotal > 0 && newTotal > 0) {
      const scale = newTotal / oldTotal;
      const lots = asset.lots.map((l) => ({ ...l, value: l.value * scale }));
      return { lots };
    }
    return { lots: [createLot({ value: newTotal, costBasis: newTotal, year: 0 })] };
  }
  return { [key]: value };
}

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
    // For lot-bearing classes (stocks/bonds/crypto), the synthetic "value"
    // form field doesn't correspond to a top-level property — the actual
    // value lives in `lots[]`. Show the current lot total instead so the
    // input is pre-filled with the value the user sees on the card.
    const initial =
      f.key === 'value' && LOT_BEARING_CLASSES.has(asset.class)
        ? assetNetValue(asset)
        : asset[f.key];
    const { field: fieldEl, input } = renderField(f, initial, { store, currentAssetId: asset.id });
    fieldEls[f.key] = fieldEl;
    fieldInputs[f.key] = input;
    input.addEventListener('change', () => {
      const r = readField(f, input);
      if (r.error) return;
      // Defer the store update to a microtask. If `change` fires as part
      // of a click sequence on a sibling button (e.g. Update or Delete),
      // a synchronous `store.updateAsset` here would call `setState` ->
      // `notify` -> `assetList.render()`, which destroys the overlay
      // (and the button being clicked). Firefox specifically suppresses
      // the trailing `click` event when the mousedown target is removed
      // between mousedown and mouseup, so the user's click would be
      // swallowed and they'd have to click a second time. Deferring the
      // store update lets the click handler complete first.
      const id = asset.id;
      const patch = buildFieldPatch(asset, f.key, r.value);
      Promise.resolve().then(() => store.updateAsset(id, patch));
    });
    // Refresh visibility when controller fields change. (The store update
    // above will trigger a full re-render too, but doing it locally avoids
    // a flash for option-type controllers.)
    input.addEventListener('change', applyConditionalVisibility);
    input.addEventListener('input', applyConditionalVisibility);
    fieldsEl.appendChild(fieldEl);
  }
  applyConditionalVisibility();

  // Update — gathers the current values from every input, applies them to
  // the store as a single batched patch, then closes the expanded card.
  // We can't rely solely on the per-field `change` listener: if the user
  // clicks Update while still editing an input, in some browsers the
  // input's `change` event won't fire before our handler runs (the
  // button click doesn't always blur the input first), so the latest
  // edits would be lost.
  const commitAndClose = (e) => {
    e.stopPropagation();
    // Read every field's current value and build a single patch.
    const patch = {};
    for (const f of fields) {
      const input = fieldInputs[f.key];
      if (!input) continue;
      const r = readField(f, input);
      if (r.error) continue; // skip invalid fields, keep prior value
      // For lot-bearing classes, editing `value` rewrites `lots` (see
      // buildFieldPatch). Merge the resulting fragment into the batch
      // patch so a single store.updateAsset call applies everything.
      Object.assign(patch, buildFieldPatch(asset, f.key, r.value));
    }
    // Apply synchronously — the overlay is about to be torn down
    // anyway, so the deferral dance the `change` handler does is
    // unnecessary here.
    if (Object.keys(patch).length > 0) {
      store.updateAsset(asset.id, patch);
    }
    onToggleExpand(null);
  };

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
    // We bind BOTH `mousedown` and `click` for Update. The `mousedown`
    // path is a safety net for Firefox/macOS where the trailing `click`
    // can be swallowed when the overlay is rebuilt mid-click. Closing on
    // `mousedown` guarantees first-click response; the redundant `click`
    // handler keeps keyboard activation (Enter/Space on a focused button)
    // working too — by then the card is already closed and the second
    // call is a no-op (overlay no longer in the DOM).
    h('button', {
      className: 'update-btn',
      attrs: { type: 'button', 'aria-label': 'Save changes and close' },
      on: {
        mousedown: (e) => {
          if (e.button !== 0) return; // primary (left) only
          commitAndClose(e);
        },
        click: commitAndClose,
      },
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
