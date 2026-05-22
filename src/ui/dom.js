/**
 * @fileoverview Tiny DOM helpers used by all UI modules. Keeps imports minimal
 * and avoids a runtime framework dependency.
 * @module src/ui/dom
 */

import { createIcon } from './icons.js';
export { createIcon };

/**
 * Creates an HTMLElement with attributes / classes / children.
 * @param {string} tag
 * @param {Object} [opts]
 * @param {string} [opts.className]
 * @param {Object<string, string>} [opts.attrs]
 * @param {Object<string, EventListener>} [opts.on]
 * @param {Array<Node|string>|Node|string} [opts.children]
 * @returns {HTMLElement}
 */
export function h(tag, opts = {}) {
  const el = document.createElement(tag);
  if (opts.className) el.className = opts.className;
  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) {
      if (v === false || v == null) continue;
      if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  if (opts.on) {
    for (const [evt, fn] of Object.entries(opts.on)) {
      el.addEventListener(evt, fn);
    }
  }
  if (opts.children != null) appendChildren(el, opts.children);
  return el;
}

/** @private */
function appendChildren(el, children) {
  if (Array.isArray(children)) {
    for (const c of children) appendChildren(el, c);
    return;
  }
  if (children == null || children === false) return;
  if (typeof children === 'string' || typeof children === 'number') {
    el.appendChild(document.createTextNode(String(children)));
  } else if (children instanceof Node) {
    el.appendChild(children);
  }
}

/** Replace all children of `parent` with `children`. */
export function setChildren(parent, children) {
  parent.textContent = '';
  appendChildren(parent, children);
}

/**
 * Inserts an inline SVG icon into the given slot element. Synchronous —
 * no CDN, no retries. See `src/ui/icons.js` for the registry.
 *
 * @param {HTMLElement} el - Slot element
 * @param {string} name - Icon name (kebab-case)
 * @param {string} [className] - Extra class to apply to the SVG
 */
export function icon(el, name, className = 'icon') {
  el.innerHTML = '';
  const svg = createIcon(name, className);
  el.appendChild(svg);
}

/**
 * No-op kept for backwards compatibility with existing call sites that used
 * to ask the lazy Lucide CDN renderer to re-run. Inline SVG icons are now
 * created synchronously by `createIcon()`, so there is nothing to refresh.
 */
export function refreshIcons() { /* no-op */ }
