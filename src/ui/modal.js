/**
 * @fileoverview Tiny modal helper. Single-modal-at-a-time. Backdrop click
 * and Escape key both close. Body element is provided by caller.
 *
 * Also exposes `confirmDialog(message, opts)` — a Promise-based replacement
 * for `window.confirm` that respects the Tron theme.
 *
 * @module src/ui/modal
 */

import { h, setChildren } from './dom.js';

/** @type {HTMLElement|null} */
let modalRoot = null;

function ensureMounted() {
  modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    modalRoot = h('div', { attrs: { id: 'modal-root', hidden: true }, className: 'modal-root' });
    document.body.appendChild(modalRoot);
  }
}

let escListener = null;

/**
 * Opens the modal with the given title + body element.
 * @param {{ title: string, body: HTMLElement, onClose?: () => void }} opts
 */
export function openModal({ title, body, onClose }) {
  ensureMounted();
  const dialog = h('div', { className: 'modal', attrs: { role: 'dialog', 'aria-label': title }, children: [
    h('div', { className: 'modal-header', children: [
      h('h3', { children: title }),
      h('button', {
        className: 'close-btn', attrs: { type: 'button', 'aria-label': 'Close' },
        on: { click: closeModal }, children: '✕',
      }),
    ]}),
    body,
  ]});

  setChildren(modalRoot, dialog);
  modalRoot.hidden = false;

  // Backdrop click closes
  modalRoot.onclick = (e) => { if (e.target === modalRoot) closeModal(); };

  // Esc closes
  escListener = (e) => { if (e.key === 'Escape') closeModal(); };
  document.addEventListener('keydown', escListener);

  // Focus trap: focus the first focusable element inside the dialog
  setTimeout(() => {
    const focusable = dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
  }, 0);

  modalCloseHandler = onClose ?? null;
}

/** Closes the modal, if open. */
export function closeModal() {
  if (!modalRoot) return;
  modalRoot.hidden = true;
  setChildren(modalRoot, []);
  modalRoot.onclick = null;
  if (escListener) {
    document.removeEventListener('keydown', escListener);
    escListener = null;
  }
  if (modalCloseHandler) {
    const handler = modalCloseHandler;
    modalCloseHandler = null;
    try { handler(); } catch { /* ignore */ }
  }
}

/**
 * Promise-based confirm dialog. Returns a Promise<boolean>: true if the user
 * clicked the confirm button, false on cancel/close/Esc.
 *
 * @param {string} message
 * @param {Object} [opts]
 * @param {string} [opts.title='Are you sure?']
 * @param {string} [opts.confirmLabel='Confirm']
 * @param {string} [opts.cancelLabel='Cancel']
 * @param {boolean} [opts.danger=false] - Style confirm button as destructive
 * @returns {Promise<boolean>}
 */
export function confirmDialog(message, opts = {}) {
  const {
    title = 'Are you sure?',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
  } = opts;

  return new Promise((resolve) => {
    let decided = false;
    const decide = (v) => {
      if (decided) return;
      decided = true;
      resolve(v);
      closeModal();
    };

    const body = h('div', { className: 'confirm-body', children: [
      h('p', { children: message }),
      h('div', { className: 'form-actions', children: [
        h('button', {
          className: 'btn-secondary',
          attrs: { type: 'button' },
          on: { click: () => decide(false) },
          children: cancelLabel,
        }),
        h('button', {
          className: danger ? 'btn-danger' : 'btn-primary',
          attrs: { type: 'button' },
          on: { click: () => decide(true) },
          children: confirmLabel,
        }),
      ]}),
    ]});

    openModal({ title, body, onClose: () => decide(false) });
  });
}

let modalCloseHandler = null;
