/**
 * @fileoverview Reusable in-line "?" help affordance.
 *
 * Exposes two things:
 *   1. `createHelpTip(text, opts)` — returns a small `<button>` with a "?"
 *      glyph that, when clicked, opens an accessible explainer popup.
 *   2. `openHelpPopup({ title, body })` — directly opens the popup. Useful
 *      when a help trigger is needed somewhere other than a field label.
 *
 * The popup is intentionally implemented independently of `modal.js`:
 *   - `modal.js` is single-modal-at-a-time (closing one closes everything),
 *     and we need the help popup to stack on top of the asset-creation
 *     modal or the expanded-card overlay without dismissing them.
 *   - The popup mounts to its own root (`#help-popup-root`) at a higher
 *     z-index than both the modal-root and the expanded card.
 *
 * Accessibility notes:
 *   - Trigger is a real `<button>` (focusable, Enter/Space activated).
 *   - Popup has `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
 *     pointing at the title node.
 *   - Esc closes; backdrop click closes; X button closes.
 *   - On open, focus moves to the X button. On close, focus is returned
 *     to the trigger that opened it.
 *
 * @module src/ui/helpTip
 */

import { h, setChildren } from './dom.js';

/** @type {HTMLElement|null} */
let popupRoot = null;
/** @type {HTMLElement|null} */
let lastTrigger = null;
/** @type {((e: KeyboardEvent) => void) | null} */
let escHandler = null;

/**
 * Lazily create — and return — the dedicated mount point for help popups.
 * Sits above modal-root (z-index 50) and the expanded asset card overlay
 * (z-index 60) so it can be invoked from inside either of them.
 */
function ensurePopupRoot() {
  if (popupRoot && document.body.contains(popupRoot)) return popupRoot;
  popupRoot = document.getElementById('help-popup-root');
  if (!popupRoot) {
    popupRoot = h('div', {
      attrs: { id: 'help-popup-root', hidden: true },
      className: 'help-popup-root',
    });
    document.body.appendChild(popupRoot);
  }
  return popupRoot;
}

/**
 * Build a small inline "?" button suitable for placing next to a form-field
 * label. The button stops click/mousedown from bubbling so it never toggles
 * a parent click-to-expand container (e.g. the collapsed asset-card click
 * handler) by accident.
 *
 * `text` may be either a string (rendered as a paragraph) or an array of
 * strings (each rendered as its own paragraph — useful for multi-paragraph
 * explanations that match a methodology subsection layout).
 *
 * @param {string|string[]} text - Explanation copy. Plain text (no HTML).
 * @param {Object} [opts]
 * @param {string} [opts.title='What is this?'] - Heading of the popup.
 * @param {string} [opts.label] - Accessible name for the trigger button.
 *   Defaults to `Help: ${title}` so screen-reader users know what it pertains to.
 * @returns {HTMLButtonElement}
 */
export function createHelpTip(text, opts = {}) {
  const title = opts.title ?? 'What is this?';
  const ariaLabel = opts.label ?? `Help: ${title}`;

  const btn = h('button', {
    className: 'help-tip',
    attrs: {
      type: 'button',
      'aria-label': ariaLabel,
      'aria-haspopup': 'dialog',
      tabindex: '0',
    },
    children: '?',
  });

  // Stop propagation aggressively: if this button lives inside the collapsed
  // asset card (which has its own click-to-expand listener), or inside any
  // <label>/<form> ancestor that might react to clicks, we don't want any of
  // those side effects.
  const stop = (e) => e.stopPropagation();
  btn.addEventListener('mousedown', stop);
  btn.addEventListener('click', (e) => {
    stop(e);
    e.preventDefault();
    openHelpPopup({ title, text, returnFocusTo: btn });
  });

  return btn;
}

/**
 * Open the help popup directly (without going through a trigger button).
 *
 * @param {Object} args
 * @param {string} args.title
 * @param {string|string[]} args.text - Plain text content.
 * @param {HTMLElement} [args.returnFocusTo] - Element to refocus on close.
 */
export function openHelpPopup({ title, text, returnFocusTo }) {
  const root = ensurePopupRoot();
  lastTrigger = returnFocusTo ?? document.activeElement;

  const titleId = `help-popup-title-${Math.random().toString(36).slice(2, 8)}`;

  const closeBtn = h('button', {
    className: 'help-popup-close',
    attrs: { type: 'button', 'aria-label': 'Close' },
    on: { click: closeHelpPopup },
    children: '\u00d7', // multiplication sign — the same glyph used elsewhere as an X
  });

  const titleEl = h('h3', {
    className: 'help-popup-title',
    attrs: { id: titleId },
    children: title,
  });

  // Body: each paragraph as its own <p>. Always rendered as text nodes — never
  // as innerHTML — so the explanation copy can't be used to inject markup.
  const paragraphs = (Array.isArray(text) ? text : [text])
    .filter((p) => typeof p === 'string' && p.length > 0)
    .map((p) => h('p', { className: 'help-popup-para', children: p }));

  const dialog = h('div', {
    className: 'help-popup',
    attrs: {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
    },
    on: {
      // Don't let clicks inside the dialog reach the backdrop (which closes).
      click: (e) => e.stopPropagation(),
      mousedown: (e) => e.stopPropagation(),
    },
    children: [
      h('div', { className: 'help-popup-header', children: [titleEl, closeBtn] }),
      h('div', { className: 'help-popup-body', children: paragraphs }),
    ],
  });

  setChildren(root, dialog);
  root.hidden = false;

  // Backdrop click closes.
  root.onclick = (e) => { if (e.target === root) closeHelpPopup(); };

  // Esc closes.
  escHandler = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation(); // don't also close an underlying modal
      closeHelpPopup();
    }
  };
  // Use capture so we run before any other listener (e.g. the modal's Esc).
  document.addEventListener('keydown', escHandler, true);

  // Focus the close button so keyboard users can dismiss immediately.
  setTimeout(() => closeBtn.focus(), 0);
}

/** Close the help popup if it is open. Safe to call when already closed. */
export function closeHelpPopup() {
  if (!popupRoot || popupRoot.hidden) return;
  popupRoot.hidden = true;
  setChildren(popupRoot, []);
  popupRoot.onclick = null;
  if (escHandler) {
    document.removeEventListener('keydown', escHandler, true);
    escHandler = null;
  }
  // Return focus to whoever opened the popup, if it's still in the DOM.
  if (lastTrigger && document.contains(lastTrigger)) {
    try { lastTrigger.focus(); } catch { /* noop */ }
  }
  lastTrigger = null;
}
