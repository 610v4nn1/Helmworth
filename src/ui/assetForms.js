/**
 * @fileoverview Per-class modal form for creating a new asset.
 * Shares its field rendering with the inline edit panel on each card
 * (see fieldEditor.js).
 * @module src/ui/assetForms
 */

import { h } from './dom.js';
import { closeModal, openModal } from './modal.js';
import { FIELDS, FACTORY_NAMES, getClassDef, TAX_FIELD_MAP } from './classDefs.js';
import { renderField, readField } from './fieldEditor.js';
import {
  createStocks, createBonds, createCrypto, createCash,
  createRealEstate, createPrivateBusiness, createPension, createPersonalDebt,
  validateAsset,
} from '../model/assets.js';
import { getDefaultsByCountry } from '../data/countries.js';

const FACTORIES = {
  stocks: createStocks,
  bonds: createBonds,
  crypto: createCrypto,
  cash: createCash,
  realEstate: createRealEstate,
  privateBusiness: createPrivateBusiness,
  pension: createPension,
  personalDebt: createPersonalDebt,
};

/**
 * Opens a modal form for creating an asset of the given class.
 * Pre-fills tax fields from country defaults.
 * @param {Object} store
 * @param {string} clsKey - One of the 8 class keys
 */
export function openAssetForm(store, clsKey) {
  const def = getClassDef(clsKey);
  const fields = FIELDS[clsKey];
  const country = store.getState().userInfo.country;
  const taxDefaults = getDefaultsByCountry(country) ?? {};
  const taxMap = TAX_FIELD_MAP[clsKey] ?? {};

  // Build initial values from defaults, with tax pre-fill
  const initial = {};
  for (const f of fields) {
    if (f.tax && taxMap[f.key] && taxDefaults[taxMap[f.key]] != null) {
      initial[f.key] = taxDefaults[taxMap[f.key]];
    } else {
      initial[f.key] = f.default;
    }
  }

  const inputs = {};
  const setErrors = {};
  const fieldEls = {};
  const formError = h('div', { className: 'form-error', attrs: { 'aria-live': 'polite' } });

  // Helper: read the *current* value of a (possibly typed) input. Falls back
  // to readField on parse so we apply the same coercion the form would on
  // submit. Used by `applyConditionalVisibility` to evaluate `showWhen` rules.
  function readCurrentValue(f) {
    const input = inputs[f.key];
    if (!input) return undefined;
    if (f.type === 'option') return input.value;
    const r = readField(f, input);
    return r.error ? undefined : r.value;
  }

  // Hide/show fields whose `showWhen` no longer matches. A field with
  // `showWhen: { otherKey: 'someValue' }` is shown only when the current
  // value of `otherKey` equals 'someValue'.
  function applyConditionalVisibility() {
    for (const f of fields) {
      if (!f.showWhen) continue;
      const matches = Object.entries(f.showWhen).every(
        ([k, v]) => readCurrentValue({ key: k, type: fields.find((ff) => ff.key === k)?.type }) === v
      );
      const el = fieldEls[f.key];
      if (el) el.style.display = matches ? '' : 'none';
    }
  }

  const form = h('form', {
    className: 'asset-form',
    attrs: { novalidate: 'true' },
    on: { submit: (e) => {
      e.preventDefault();
      handleSubmit();
    }},
    children: [
      ...fields.map((f) => {
        const wrap = renderField(f, initial[f.key], { store });
        inputs[f.key] = wrap.input;
        setErrors[f.key] = wrap.setError;
        fieldEls[f.key] = wrap.field;
        // Re-evaluate visibility whenever any "controller" field changes.
        wrap.input.addEventListener('change', applyConditionalVisibility);
        wrap.input.addEventListener('input', applyConditionalVisibility);
        return wrap.field;
      }),
      formError,
      h('div', { className: 'form-actions', children: [
        h('button', { className: 'btn-secondary', attrs: { type: 'button' }, on: { click: closeModal }, children: 'Cancel' }),
        h('button', { className: 'btn-primary', attrs: { type: 'submit' }, children: 'Create' }),
      ]}),
    ],
  });

  // Initial visibility pass.
  applyConditionalVisibility();

  function handleSubmit() {
    formError.textContent = '';
    const params = {};
    let firstInvalid = null;
    let hasError = false;

    for (const f of fields) {
      setErrors[f.key]('');
      // Skip fields hidden by showWhen — they don't apply to this asset variant.
      if (fieldEls[f.key] && fieldEls[f.key].style.display === 'none') continue;
      const v = readField(f, inputs[f.key]);
      if (v.error) {
        setErrors[f.key](v.error);
        hasError = true;
        if (!firstInvalid) firstInvalid = inputs[f.key];
      } else {
        params[f.key] = v.value;
      }
    }
    if (hasError) {
      formError.textContent = 'Please fix the highlighted fields.';
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    let asset;
    try {
      asset = FACTORIES[clsKey](params);
    } catch (err) {
      formError.textContent = err.message;
      return;
    }

    const v = validateAsset(asset);
    if (!v.ok) {
      formError.textContent = v.errors.join('; ');
      return;
    }

    store.addAsset(asset);
    closeModal();
  }

  openModal({ title: `Add ${def.label}`, body: form });

  // Focus the first non-text input (usually "value") for fast entry
  const focusKey = fields.find((f) => f.type !== 'text')?.key;
  if (focusKey && inputs[focusKey]) {
    setTimeout(() => inputs[focusKey].focus(), 0);
  }
}
