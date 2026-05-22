/**
 * @fileoverview Renders the User Info form and binds it two-way to the store.
 *
 * The app is Germany-only: country selection has been removed from the UI
 * and the country is forced to 'DE' so the German tax defaults are always
 * applied to assets.
 *
 * @module src/ui/userInfoForm
 */

import { h, setChildren } from './dom.js';
import { formatPercent, parsePercent, formatCurrency, parseCurrency } from './format.js';

/** Country code this app is locked to. */
const FIXED_COUNTRY = 'DE';

/**
 * Mounts the user info form and wires it to the store.
 * @param {HTMLElement} mountEl - Form container
 * @param {Object} store - Store from src/state.js
 */
export function mountUserInfoForm(mountEl, store) {
  // Lock the country to Germany. If the persisted state is missing or has a
  // different country, normalize it once on mount so all asset tax defaults
  // come from the German entry in countries.js.
  const current = store.getState().userInfo;
  if (current.country !== FIXED_COUNTRY) {
    store.applyCountryDefaults(FIXED_COUNTRY);
  }

  function render() {
    const ui = store.getState().userInfo;

    setChildren(mountEl, [
      // Age
      h('div', { className: 'field', children: [
        h('label', { attrs: { for: 'ui-age' }, children: 'Age' }),
        h('input', {
          attrs: { id: 'ui-age', type: 'number', min: '0', max: '120', step: '1', value: String(ui.age) },
          on: { input: (e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 0) {
              store.setState({ ...store.getState(), userInfo: { ...store.getState().userInfo, age: Math.floor(v) } });
            }
          }},
        }),
      ]}),

      // Monthly expenses
      h('div', { className: 'field', children: [
        h('label', { attrs: { for: 'ui-expenses' }, children: 'Monthly expenses' }),
        h('input', {
          attrs: {
            id: 'ui-expenses', type: 'text', inputmode: 'decimal',
            value: formatCurrency(ui.monthlyExpenses, { digits: 0 }),
          },
          on: { change: (e) => {
            const v = parseCurrency(e.target.value);
            if (Number.isFinite(v) && v >= 0) {
              store.setState({ ...store.getState(), userInfo: { ...store.getState().userInfo, monthlyExpenses: v } });
            } else {
              e.target.value = formatCurrency(store.getState().userInfo.monthlyExpenses, { digits: 0 });
            }
          }},
        }),
      ]}),

      // Inflation rate
      h('div', { className: 'field', children: [
        h('label', { attrs: { for: 'ui-inflation' }, children: 'Expected inflation' }),
        h('input', {
          attrs: {
            id: 'ui-inflation', type: 'text', inputmode: 'decimal',
            value: formatPercent(ui.inflationRate, { digits: 2, withSymbol: true }),
          },
          on: { change: (e) => {
            const v = parsePercent(e.target.value);
            if (Number.isFinite(v) && v >= 0 && v <= 1) {
              store.setState({ ...store.getState(), userInfo: { ...store.getState().userInfo, inflationRate: v } });
            } else {
              e.target.value = formatPercent(store.getState().userInfo.inflationRate);
            }
          }},
        }),
      ]}),
    ]);
  }

  render();
  // Re-render on relevant state changes.
  store.subscribe(() => render());
}
