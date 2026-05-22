/**
 * @fileoverview JSON import/export buttons. Lives in the header (right-aligned).
 *
 * Export: serialises the current state and triggers a file download.
 * Import: opens a file picker, parses the JSON, validates the basic shape,
 *         and replaces the in-memory state via store.setState.
 *
 * @module src/ui/importExport
 */

import { h, setChildren } from './dom.js';
import { defaultState, migrateState } from '../state.js';
import { confirmDialog } from './modal.js';

const SCHEMA_VERSION = 1;

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Mounts a small toolbar with Export / Import buttons inside `mountEl`.
 * @param {HTMLElement} mountEl
 * @param {Object} store
 */
export function mountImportExport(mountEl, store) {
  const fileInput = h('input', {
    attrs: { type: 'file', accept: 'application/json,.json' },
  });
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-importing the same file works
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const next = normaliseImported(parsed);
      store.setState(migrateState(next));
      flash('Imported state.', 'ok');
    } catch (err) {
      flash(`Import failed: ${err.message}`, 'err');
    }
  });

  const exportBtn = h('button', {
    className: 'btn-secondary',
    attrs: { type: 'button', 'aria-label': 'Export state as JSON' },
    on: { click: () => doExport(store.getState()) },
    children: 'Export',
  });

  const importBtn = h('button', {
    className: 'btn-secondary',
    attrs: { type: 'button', 'aria-label': 'Import state from JSON' },
    on: { click: () => fileInput.click() },
    children: 'Import',
  });

  const resetBtn = h('button', {
    className: 'btn-secondary',
    attrs: { type: 'button', 'aria-label': 'Reset to empty state' },
    on: { click: async () => {
      const ok = await confirmDialog(
        'Reset all data? This cannot be undone.',
        { title: 'Reset', confirmLabel: 'Reset', danger: true }
      );
      if (ok) {
        store.setState(defaultState());
        flash('Reset.', 'ok');
      }
    }},
    children: 'Reset',
  });

  const flashEl = h('span', { className: 'io-flash', attrs: { 'aria-live': 'polite' } });
  let flashTimer = null;
  function flash(msg, kind = 'ok') {
    flashEl.textContent = msg;
    flashEl.className = `io-flash ${kind}`;
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashEl.textContent = ''; }, 3500);
  }

  setChildren(mountEl, [exportBtn, importBtn, resetBtn, fileInput, flashEl]);
}

function doExport(state) {
  const payload = {
    schema: 'fire-planner',
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fire-planner-${nowStamp()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and unwraps an imported payload. Accepts either:
 *   - The wrapped envelope: `{ schema, version, exportedAt, state }`.
 *   - A bare state object:  `{ userInfo, assets }`.
 *
 * @param {*} parsed
 * @returns {{userInfo: Object, assets: Array}} state ready for setState
 * @throws {Error} on bad shape
 */
export function normaliseImported(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('not an object');
  }
  let state;
  if ('state' in parsed && parsed.state && typeof parsed.state === 'object') {
    state = parsed.state;
  } else {
    state = parsed;
  }
  if (!state.userInfo || typeof state.userInfo !== 'object') {
    throw new Error('missing userInfo');
  }
  if (!Array.isArray(state.assets)) {
    throw new Error('missing assets array');
  }
  return state;
}
