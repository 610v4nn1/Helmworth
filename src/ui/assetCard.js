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
 * `value` field. The form still exposes "Current value" and "Cost basis"
 * inputs for ergonomics, so we have to translate edits to those inputs
 * back into a lots update — and read the displayed values from the lot
 * sums, not from `asset.value` / `asset.costBasis` (which don't exist on
 * these classes). */
const LOT_BEARING_CLASSES = new Set(['stocks', 'bonds', 'crypto']);

/** Sum of `lot.costBasis` across an asset's lots (0 if no lots). */
function totalCostBasis(asset) {
  return (asset.lots ?? []).reduce((s, l) => s + (l.costBasis || 0), 0);
}

/**
 * Builds a `{ lots: [...] }` patch that applies a new total value AND a new
 * total cost basis to a lot-bearing asset. Either argument can be `null` /
 * `undefined`, meaning "the user didn't touch that side, keep the current
 * total". Edits scale the per-lot value/costBasis proportionally so any
 * fine-grained lot history (years, lot-by-lot HIFO ordering) is preserved.
 *
 * Behaviour:
 *   - When the relevant *old* total is 0, we can't scale, so we collapse
 *     to a single fresh lot at the new total (year: 0, the freshly-edited
 *     position is treated as new today).
 *   - Other fields on each lot (`year`) are kept untouched.
 */
function buildLotsPatch(asset, newValue, newCostBasis) {
  const oldValue = assetNetValue(asset);
  const oldCB    = totalCostBasis(asset);

  // If the user didn't touch one side, the new total for that side is
  // identically the old total (no scaling, leaves lots untouched on that
  // axis).
  const targetValue = newValue == null ? oldValue : Number(newValue) || 0;
  const targetCB    = newCostBasis == null ? oldCB    : Number(newCostBasis) || 0;

  // Empty / all-zero starting point on either axis → we can't proportionally
  // scale; collapse to a single fresh lot reflecting the new totals.
  if (oldValue <= 0 || oldCB <= 0 || (asset.lots ?? []).length === 0) {
    return {
      lots: [createLot({
        value: targetValue,
        costBasis: targetCB,
        year: 0,
      })],
    };
  }

  const valueScale = targetValue / oldValue;
  const cbScale    = targetCB / oldCB;
  const lots = asset.lots.map((l) => ({
    ...l,
    value:     l.value     * valueScale,
    costBasis: l.costBasis * cbScale,
  }));
  return { lots };
}

/**
 * Translates a single-field edit into a state patch suitable for
 * `store.updateAsset(id, patch)`. For most fields this is just
 * `{ [key]: value }`; for the synthetic `value` and `costBasis` inputs on
 * lot-bearing classes we delegate to `buildLotsPatch` so the change
 * actually takes effect.
 *
 * Optionally, `companion` lets the caller pass through the *other* side
 * (current value when editing cost basis, and vice versa). This keeps the
 * lot rewrite consistent when both inputs are edited within a single
 * commit, instead of one overwriting the other.
 */
function buildFieldPatch(asset, key, value, companion) {
  if (LOT_BEARING_CLASSES.has(asset.class)) {
    if (key === 'value') {
      return buildLotsPatch(asset, value, companion);
    }
    if (key === 'costBasis') {
      return buildLotsPatch(asset, companion, value);
    }
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
    // and "costBasis" form fields don't correspond to top-level properties
    // — both live in `lots[]`. Show the current lot totals instead so the
    // inputs are pre-filled with the figures the user sees on the card.
    let initial;
    if (LOT_BEARING_CLASSES.has(asset.class) && f.key === 'value') {
      initial = assetNetValue(asset);
    } else if (LOT_BEARING_CLASSES.has(asset.class) && f.key === 'costBasis') {
      initial = totalCostBasis(asset);
    } else {
      initial = asset[f.key];
    }
    const { field: fieldEl, input } = renderField(f, initial, { store, currentAssetId: asset.id, assetClass: asset.class });
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
      // For lot-bearing classes, edits to `value` or `costBasis` rewrite
      // `lots[]` (see buildFieldPatch). Pass the *current* reading of the
      // companion input so the rewrite preserves the side the user didn't
      // touch this time, instead of accidentally collapsing it via
      // proportional scaling against a stale value.
      let companion;
      if (LOT_BEARING_CLASSES.has(asset.class) && (f.key === 'value' || f.key === 'costBasis')) {
        const otherKey = f.key === 'value' ? 'costBasis' : 'value';
        const otherInput = fieldInputs[otherKey];
        const otherDescriptor = fields.find((fd) => fd.key === otherKey);
        if (otherInput && otherDescriptor) {
          const or = readField(otherDescriptor, otherInput);
          if (!or.error) companion = or.value;
        }
      }
      const patch = buildFieldPatch(asset, f.key, r.value, companion);
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
    // Pre-read value / costBasis so the lot-bearing rewrite below can use
    // both sides at once instead of letting one clobber the other.
    const lotBearing = LOT_BEARING_CLASSES.has(asset.class);
    let pendingValue;
    let pendingCB;
    if (lotBearing) {
      const valueDesc = fields.find((fd) => fd.key === 'value');
      const cbDesc    = fields.find((fd) => fd.key === 'costBasis');
      if (valueDesc && fieldInputs.value) {
        const r = readField(valueDesc, fieldInputs.value);
        if (!r.error) pendingValue = r.value;
      }
      if (cbDesc && fieldInputs.costBasis) {
        const r = readField(cbDesc, fieldInputs.costBasis);
        if (!r.error) pendingCB = r.value;
      }
      // Single combined lots rewrite, applied once.
      if (pendingValue !== undefined || pendingCB !== undefined) {
        Object.assign(patch, buildLotsPatch(asset, pendingValue, pendingCB));
      }
    }
    for (const f of fields) {
      // The lot-bearing inputs were already folded into `patch.lots`
      // above; skip them here so we don't double-process them.
      if (lotBearing && (f.key === 'value' || f.key === 'costBasis')) continue;
      const input = fieldInputs[f.key];
      if (!input) continue;
      const r = readField(f, input);
      if (r.error) continue; // skip invalid fields, keep prior value
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
