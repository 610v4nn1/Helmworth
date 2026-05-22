/**
 * @fileoverview App entry point — bootstraps the store, wires UI modules,
 * and connects the "+" add-asset button.
 * @module app
 */

import { createStore } from './src/state.js';
import { mountUserInfoForm } from './src/ui/userInfoForm.js';
import { mountAssetList }    from './src/ui/assetList.js';
import { openAssetPicker }   from './src/ui/assetPicker.js';
import { mountChart }        from './src/ui/chart.js';
import { mountStatsTable }   from './src/ui/statsTable.js';
import { mountAssetsChart }  from './src/ui/assetsChart.js';
import { mountImportExport } from './src/ui/importExport.js';

const store = createStore();

// Expose for ad-hoc debugging from devtools (does not affect tests).
if (typeof window !== 'undefined') {
  window.__store = store;
}

window.addEventListener('DOMContentLoaded', () => {
  mountUserInfoForm(
    document.getElementById('user-info-form'),
    store,
  );

  mountAssetList(
    document.getElementById('asset-list'),
    document.getElementById('nw-value'),
    store,
  );

  mountChart(
    document.getElementById('projections-chart'),
    document.getElementById('chart-annotations'),
    store,
    document.getElementById('projections-range'),
  );

  mountStatsTable(
    document.getElementById('stats-table'),
    store,
  );

  mountAssetsChart(
    document.getElementById('assets-chart'),
    document.getElementById('assets-chart-legend'),
    store,
    document.getElementById('assets-range'),
  );

  mountImportExport(
    document.getElementById('io-toolbar'),
    store,
  );

  document.getElementById('add-asset-btn')
    .addEventListener('click', () => openAssetPicker(store));

  // Keyboard shortcut: 'n' (when not typing in a form field) opens the
  // asset picker. Common Gmail-style convenience shortcut.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'n' && e.key !== 'N') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target?.isContentEditable) return;
    e.preventDefault();
    openAssetPicker(store);
  });
});
