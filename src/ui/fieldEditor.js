/**
 * @fileoverview Renders + reads the value of a single typed form field.
 * Used by both the asset creation form and the inline-edit panel on cards.
 *
 * Supported types: 'text', 'currency', 'percent', 'number', 'integer', 'option',
 * 'saleConversion' (a complex composite field; see renderSaleConversion).
 *
 * @module src/ui/fieldEditor
 */

import { h } from './dom.js';
import { formatCurrency, parseCurrency, formatPercent, parsePercent } from './format.js';
import { CLASSES } from './classDefs.js';
import { getFieldHelp } from './fieldHelp.js';
import { createHelpTip } from './helpTip.js';

/**
 * Build the inner content of a field <label>: the visible label text plus an
 * optional inline "?" help-tip button that opens an explainer popup.
 *
 * Looking up help is centralised here so all callers (asset creation form +
 * inline edit panel on cards) get help icons for free, with no extra wiring.
 *
 * @param {FieldDescriptor} field
 * @param {Object} [ctx]
 * @param {string} [ctx.assetClass] - One of the eight class keys; required
 *   to scope class-specific help (e.g. stocks vs crypto avgReturnRate).
 * @returns {Array<Node|string>}
 */
function buildLabelChildren(field, ctx) {
  const children = [field.label];
  // Help is opt-in via fieldHelp.js. Composite types (saleConversion) handle
  // their own labelling via this same path, so they get help too if registered.
  const help = ctx?.assetClass ? getFieldHelp(ctx.assetClass, field.key) : null;
  if (help) {
    children.push(' ');
    children.push(createHelpTip(help.text, { title: help.title, label: `Help: ${field.label}` }));
  }
  return children;
}

/**
 * @typedef {Object} FieldDescriptor
 * @property {string} key
 * @property {string} label
 * @property {('text'|'currency'|'percent'|'number'|'integer'|'option')} type
 * @property {boolean} [required]
 * @property {boolean} [full]   // span the full row in a grid form
 * @property {Array<{value:string,label:string}>} [options]
 */

/**
 * Builds a labelled input for `field`, pre-filled with `value`.
 * Returns `{ field: HTMLElement, input: HTMLInputElement, error: HTMLElement, setError }`.
 *   - `setError(msg)` shows or clears the inline error message under the input.
 * @param {FieldDescriptor} field
 * @param {*} value - Initial value (decimal for percent fields)
 * @param {Object} [ctx] - Extra context (store, currentAssetId) for composite fields
 */
export function renderField(field, value, ctx = {}) {
  // Composite field: saleConversion has its own renderer
  if (field.type === 'saleConversion') {
    return renderSaleConversion(field, value, ctx);
  }

  let input;
  let displayValue;

  switch (field.type) {
    case 'currency':
      displayValue = value == null || value === '' ? '' : formatCurrency(Number(value), { digits: 0 });
      input = h('input', { attrs: { type: 'text', inputmode: 'decimal', placeholder: '0', value: displayValue, 'data-type': 'currency' } });
      input.addEventListener('blur', () => {
        const v = parseCurrency(input.value);
        input.value = Number.isFinite(v) ? formatCurrency(v, { digits: 0 }) : input.value;
      });
      break;

    case 'percent':
      displayValue = value == null || value === '' ? '' : formatPercent(Number(value), { digits: 2, withSymbol: true });
      input = h('input', { attrs: { type: 'text', inputmode: 'decimal', placeholder: '0%', value: displayValue, 'data-type': 'percent' } });
      input.addEventListener('blur', () => {
        const v = parsePercent(input.value);
        input.value = Number.isFinite(v) ? formatPercent(v) : input.value;
      });
      break;

    case 'integer':
      displayValue = value == null || value === '' ? '' : String(Math.floor(Number(value)));
      input = h('input', { attrs: { type: 'number', step: '1', value: displayValue, 'data-type': 'integer' } });
      break;

    case 'number':
      displayValue = value == null || value === '' ? '' : String(value);
      input = h('input', { attrs: { type: 'number', step: 'any', value: displayValue, 'data-type': 'number' } });
      break;

    case 'option':
      input = h('select', {
        attrs: { 'data-type': 'option' },
        children: (field.options || []).map((o) =>
          h('option', { attrs: { value: o.value, selected: o.value === value }, children: o.label })
        ),
      });
      break;

    default: // 'text'
      input = h('input', { attrs: { type: 'text', value: value == null ? '' : String(value), 'data-type': 'text' } });
  }

  const errorEl = h('div', { className: 'error', attrs: { 'aria-live': 'polite' } });

  /** Show/hide the inline error under this field. */
  const setError = (msg) => {
    errorEl.textContent = msg ?? '';
    if (msg) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };

  // Clear error on input
  input.addEventListener('input', () => setError(''));

  const fieldEl = h('div', {
    className: 'field' + (field.full ? ' full' : ''),
    children: [
      h('label', { children: buildLabelChildren(field, ctx) }),
      input,
      errorEl,
    ],
  });

  return { field: fieldEl, input, error: errorEl, setError };
}

/**
 * Reads the value of an input, applying the appropriate parse for its type.
 * Returns `{ value, error }`. Empty optional fields return `{ value: defaultForType }`.
 * @param {FieldDescriptor} field
 * @param {HTMLInputElement|HTMLSelectElement|HTMLElement} input
 */
export function readField(field, input) {
  if (field.type === 'saleConversion') {
    // Composite — value is read from the attached `__getValue()` callback.
    if (typeof input.__getValue === 'function') {
      try {
        return { value: input.__getValue() };
      } catch (err) {
        return { error: err.message };
      }
    }
    return { value: null };
  }

  const raw = input.value.trim();

  switch (field.type) {
    case 'currency': {
      if (raw === '') return field.required ? { error: 'required' } : { value: 0 };
      const v = parseCurrency(raw);
      if (!Number.isFinite(v)) return { error: 'invalid amount' };
      if (!field.signed && v < 0) return { error: 'invalid amount' };
      return { value: v };
    }
    case 'percent': {
      if (raw === '') return { value: 0 };
      const v = parsePercent(raw);
      if (!Number.isFinite(v)) return { error: 'invalid percentage' };
      return { value: v };
    }
    case 'integer': {
      if (raw === '') return { value: null };
      const v = Number(raw);
      if (!Number.isFinite(v)) return { error: 'invalid number' };
      return { value: Math.floor(v) };
    }
    case 'number': {
      if (raw === '') return { value: 0 };
      const v = Number(raw);
      if (!Number.isFinite(v)) return { error: 'invalid number' };
      return { value: v };
    }
    case 'option':
    case 'text':
    default:
      if (field.required && raw === '') return { error: 'required' };
      return { value: raw };
  }
}

// ---------------------------------------------------------------------------
// SALE CONVERSION COMPOSITE FIELD
// ---------------------------------------------------------------------------

/**
 * Lot-bearing classes that can receive merged sale proceeds. (Cash is also
 * acceptable as an inline target but cannot host new lots — proceeds become
 * its `value`.)
 */
const TARGET_CLASSES_LOT_BEARING = ['stocks', 'bonds', 'crypto'];

/** Classes valid for an inline-created target. */
const INLINE_TARGET_CLASSES = ['stocks', 'bonds', 'crypto', 'cash'];

/**
 * Renders the sale-conversion composite field. Returns the standard
 * { field, input, error, setError } shape, but `input` is a synthetic
 * wrapper element with a `__getValue()` method used by `readField`.
 *
 * Three modes selected via radio buttons:
 *   - "Don't reinvest" → null (proceeds disappear; current default)
 *   - "Existing asset" → { targetAssetId, inlineParams: null }
 *   - "New asset"      → { targetAssetId: null, inlineParams: { class, name } }
 *
 * @private
 */
function renderSaleConversion(field, value, ctx) {
  const store = ctx?.store;
  const currentAssetId = ctx?.currentAssetId; // used to exclude self when editing
  const allAssets = store ? store.getState().assets : [];

  // Eligible existing targets: lot-bearing assets that are not the source.
  const eligible = allAssets.filter(
    (a) => TARGET_CLASSES_LOT_BEARING.includes(a.class) && a.id !== currentAssetId
  );

  // Determine initial mode from the existing value
  let initialMode = 'none';
  if (value && typeof value === 'object') {
    if (value.targetAssetId) initialMode = 'target';
    else if (value.inlineParams) initialMode = 'inline';
  }
  const initialTarget = value?.targetAssetId ?? (eligible[0]?.id ?? '');
  const initialInlineClass = value?.inlineParams?.class ?? 'stocks';
  const initialInlineName = value?.inlineParams?.name ?? '';

  // Build sub-controls
  const targetSelect = h('select', {
    attrs: { 'data-role': 'sc-target' },
    children: eligible.length === 0
      ? [h('option', { attrs: { value: '' }, children: '(no eligible existing assets)' })]
      : eligible.map((a) =>
          h('option', { attrs: { value: a.id, selected: a.id === initialTarget }, children: `${labelForClass(a.class)} — ${a.name}` })
        ),
  });

  const inlineClassSelect = h('select', {
    attrs: { 'data-role': 'sc-inline-class' },
    children: INLINE_TARGET_CLASSES.map((c) =>
      h('option', { attrs: { value: c, selected: c === initialInlineClass }, children: labelForClass(c) })
    ),
  });
  const inlineNameInput = h('input', {
    attrs: { type: 'text', placeholder: 'Asset name (optional)', value: initialInlineName, 'data-role': 'sc-inline-name' },
  });

  // Radios
  const radios = ['none', 'target', 'inline'];
  const radioGroup = `sc-${Math.random().toString(36).slice(2, 8)}`;
  const radioInputs = {};
  for (const r of radios) {
    radioInputs[r] = h('input', {
      attrs: { type: 'radio', name: radioGroup, value: r, checked: r === initialMode ? '' : false },
    });
  }

  const errorEl = h('div', { className: 'error', attrs: { 'aria-live': 'polite' } });

  // Wrapper sub-rows for each mode (shown/hidden based on selection)
  const targetRow = h('div', { className: 'sc-mode-row', children: [targetSelect] });
  const inlineRow = h('div', { className: 'sc-mode-row', children: [inlineClassSelect, inlineNameInput] });

  function refreshVisibility() {
    const mode = currentMode();
    targetRow.style.display = mode === 'target' ? '' : 'none';
    inlineRow.style.display = mode === 'inline' ? '' : 'none';
  }
  function currentMode() {
    for (const r of radios) if (radioInputs[r].checked) return r;
    return 'none';
  }
  for (const r of radios) {
    radioInputs[r].addEventListener('change', refreshVisibility);
  }

  const wrapper = h('div', {
    className: 'sale-conversion',
    children: [
      h('div', { className: 'sc-options', children: [
        h('label', { className: 'sc-radio', children: [radioInputs.none,   ' Convert to cash (default)'] }),
        h('label', { className: 'sc-radio', children: [radioInputs.target, ' Add to existing asset'] }),
        targetRow,
        h('label', { className: 'sc-radio', children: [radioInputs.inline, ' Create new asset'] }),
        inlineRow,
      ]}),
    ],
  });

  refreshVisibility();

  // Read value
  wrapper.__getValue = () => {
    const mode = currentMode();
    if (mode === 'none') return null;
    if (mode === 'target') {
      const id = targetSelect.value;
      if (!id) {
        throw new Error('Pick an existing asset (or choose "Create new asset").');
      }
      return { targetAssetId: id, inlineParams: null };
    }
    // mode === 'inline'
    const cls = inlineClassSelect.value;
    if (!INLINE_TARGET_CLASSES.includes(cls)) {
      throw new Error('Pick a valid asset class for the new asset.');
    }
    const name = inlineNameInput.value.trim();
    return {
      targetAssetId: null,
      inlineParams: name ? { class: cls, name } : { class: cls },
    };
  };

  const setError = (msg) => {
    errorEl.textContent = msg ?? '';
  };

  // Clear error on any interaction
  for (const el of [targetSelect, inlineClassSelect, inlineNameInput, ...Object.values(radioInputs)]) {
    el.addEventListener('change', () => setError(''));
    el.addEventListener('input', () => setError(''));
  }

  const fieldEl = h('div', {
    className: 'field' + (field.full ? ' full' : ''),
    children: [
      h('label', { children: buildLabelChildren(field, ctx) }),
      wrapper,
      errorEl,
    ],
  });

  return { field: fieldEl, input: wrapper, error: errorEl, setError };
}

function labelForClass(cls) {
  const def = CLASSES.find((c) => c.key === cls);
  return def ? def.label : cls;
}
