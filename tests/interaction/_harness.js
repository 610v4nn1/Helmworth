/**
 * @fileoverview JSDOM harness for UI interaction tests.
 *
 * These tests exercise the click/typing paths that the calculation-layer
 * suite does not touch (asset picker, asset form, expanded asset card,
 * help-tip popup, user-info form). They run only under Node — the
 * browser runner skips them via `SKIP_IN_BROWSER` so `runner.html`
 * stays the same.
 *
 * Each test that needs a DOM calls `await setupApp()`, which:
 *   1. Boots a fresh JSDOM document built from a small inline HTML scaffold
 *      that mirrors the parts of `index.html` the UI mounts to (the
 *      handful of element ids that `app.js` looks up).
 *   2. Wires the JSDOM `window` / `document` / event globals into the Node
 *      global scope so the UI modules — which use bare `document.…`
 *      references — work without modification.
 *   3. Imports the UI modules with a unique query-string suffix so each
 *      test file gets a *fresh* module graph (no shared module-level
 *      state across suites; the persistence-singleton inside `state.js`
 *      uses an injected adapter anyway, so this is belt-and-braces).
 *   4. Builds a fresh `store` with an in-memory storage adapter so
 *      nothing leaks between tests.
 *   5. Mounts the `+` button click handler exactly the way `app.js` does,
 *      so tests interact with the real wiring.
 *
 * The harness deliberately does NOT mount the chart / stats / coverage /
 * import-export modules — those depend on Chart.js (loaded via CDN) and
 * are out of scope for the click-path tests we care about. They aren't
 * required by the picker → form → card paths.
 *
 * @module tests/interaction/_harness
 */

/** True when we're running inside a browser (the runner.html context). */
export const SKIP_IN_BROWSER = typeof window !== 'undefined' && typeof document !== 'undefined';

// ─────────────────────────────────────────────────────────────────────────
// Sequential test wrapper.
//
// The Node test runner (`tests/run-node.mjs`) is fire-and-forget: it queues
// every async `test(name, fn)` call's promise in `pendingAsync` and moves on
// to the next `test()` immediately. That works for the calc-layer suites
// because they don't share global state — but it's lethal here, where every
// test installs JSDOM globals on `globalThis.document` / `globalThis.window`.
// Two interaction tests running concurrently would clobber each other's
// document, race their teardowns, and fail in non-deterministic ways.
//
// `seqTest(test, name, fn)` ensures interaction tests in a single file run
// strictly one after another by chaining each onto a shared promise.
// ─────────────────────────────────────────────────────────────────────────

let __seqTail = Promise.resolve();

/**
 * Wrap a test with a sequential gate. Use as a drop-in for `test(name, fn)`
 * in interaction suites:
 *
 *   import { seqTest } from './_harness.js';
 *   seqTest(test, 'TI1.1: ...', async () => { ... });
 *
 * @param {Function} test - The runner's `test()` registrar.
 * @param {string} name
 * @param {() => Promise<void>} fn - Test body. Must be async.
 */
export function seqTest(test, name, fn) {
  test(name, async () => {
    // Wait for the previous interaction test (across all I-suites in this
    // process) to fully finish — including its teardown — before starting.
    const prev = __seqTail;
    let release;
    __seqTail = new Promise((r) => { release = r; });
    try {
      await prev;
      await fn();
    } finally {
      release();
    }
  });
}

/**
 * Minimal HTML scaffold replicating the ids the UI mounts to. Anything not
 * listed here is irrelevant to interaction tests and would just couple the
 * harness to incidental layout details.
 */
const SCAFFOLD = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
  <div id="user-info-form"></div>
  <div id="asset-list"></div>
  <button id="add-asset-btn" type="button"><span class="plus">+</span></button>
  <div id="nw-value"></div>
  <div id="modal-root" hidden></div>
</body></html>`;

/**
 * Walks the JSDOM `window` and copies the DOM globals UI modules touch
 * (directly or indirectly) onto `globalThis`. Returns a function that
 * undoes the assignment.
 *
 * Node 22 ships some of these as read-only globals (notably `navigator`)
 * so we use `Object.defineProperty` with `configurable: true` and skip
 * keys that can't be configured.
 */
function installGlobals(window) {
  const keys = [
    'document', 'window', 'navigator',
    'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLSelectElement',
    'HTMLFormElement', 'HTMLLabelElement',
    'Node', 'Element', 'Event', 'KeyboardEvent', 'MouseEvent',
    'SVGElement', 'getComputedStyle',
    'requestAnimationFrame', 'cancelAnimationFrame',
  ];
  const previous = {};
  const installed = [];
  for (const k of keys) {
    if (window[k] === undefined) continue;
    const desc = Object.getOwnPropertyDescriptor(globalThis, k);
    previous[k] = desc;
    try {
      Object.defineProperty(globalThis, k, {
        value: window[k],
        writable: true,
        configurable: true,
        enumerable: false,
      });
      installed.push(k);
    } catch {
      // Non-configurable global — skip silently. The UI modules don't
      // actually need every key in this list (e.g. `navigator` is only
      // used incidentally by JSDOM internals).
    }
  }
  return () => {
    for (const k of installed) {
      if (previous[k]) {
        Object.defineProperty(globalThis, k, previous[k]);
      } else {
        delete globalThis[k];
      }
    }
  };
}

/** In-memory storage adapter — fresh per call, never touches localStorage. */
function makeFakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    _map: map,
  };
}

/** Cache-buster suffix used so each setup gets a fresh module graph. */
let __setupSeq = 0;
function nextSeq() {
  __setupSeq += 1;
  return __setupSeq;
}

/**
 * Create a fresh sandboxed app. Returns helpers + a teardown function.
 *
 * @returns {Promise<{
 *   window: any,
 *   document: any,
 *   store: any,
 *   storage: any,
 *   modules: Object,
 *   click: (el: any) => void,
 *   type: (el: any, value: string) => void,
 *   change: (el: any) => void,
 *   submit: (formOrButton: any) => void,
 *   pressKey: (key: string, target?: any) => void,
 *   tick: (ms?: number) => Promise<void>,
 *   teardown: () => void,
 * }>}
 */
export async function setupApp() {
  if (SKIP_IN_BROWSER) {
    throw new Error('setupApp() called in a browser; this harness is Node-only.');
  }

  // Lazy-import jsdom so this file stays evaluable in browsers (where
  // SKIP_IN_BROWSER short-circuits before we get here).
  const { JSDOM } = await import('jsdom');

  const dom = new JSDOM(SCAFFOLD, {
    url: 'http://localhost/',           // gives us a real localStorage origin
    pretendToBeVisual: true,
  });
  const { window } = dom;

  const restoreGlobals = installGlobals(window);

  // Cache-bust query so each setup() call re-evaluates the UI modules from
  // scratch. We DON'T bust calc-layer modules (state, model) — they're
  // already factory-based per `createStore()`, so a singleton import is
  // fine and keeps tests fast.
  const seq = nextSeq();
  const cb = `?t=${seq}`;
  const ui = await import(`../../src/ui/assetPicker.js${cb}`);
  const dom2 = await import(`../../src/ui/dom.js${cb}`);
  const card = await import(`../../src/ui/assetCard.js${cb}`);
  const list = await import(`../../src/ui/assetList.js${cb}`);
  const userInfo = await import(`../../src/ui/userInfoForm.js${cb}`);
  const helpTip = await import(`../../src/ui/helpTip.js${cb}`);
  const modal = await import(`../../src/ui/modal.js${cb}`);
  const state = await import('../../src/state.js');

  const storage = makeFakeStorage();
  const store = state.createStore({ storage, debounceMs: 0 });

  // Mount only what the click-path tests need.
  list.mountAssetList(
    window.document.getElementById('asset-list'),
    window.document.getElementById('nw-value'),
    store,
  );
  userInfo.mountUserInfoForm(
    window.document.getElementById('user-info-form'),
    store,
  );

  // Replicate the exact wiring app.js does for the + button.
  window.document.getElementById('add-asset-btn')
    .addEventListener('click', () => ui.openAssetPicker(store));

  // ──────────────────────────── helpers ─────────────────────────────────
  const click = (el) => {
    if (!el) throw new Error('click(): element is null/undefined');
    // bubbles+cancelable so listeners that check e.target still see it.
    el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  };

  const type = (el, value) => {
    if (!el) throw new Error('type(): element is null/undefined');
    el.value = String(value);
    el.dispatchEvent(new window.Event('input', { bubbles: true }));
  };

  const change = (el) => {
    if (!el) throw new Error('change(): element is null/undefined');
    el.dispatchEvent(new window.Event('change', { bubbles: true }));
  };

  const submit = (formOrButton) => {
    if (!formOrButton) throw new Error('submit(): null/undefined target');
    // If a button was passed, click it (it'll trigger the form's submit).
    if (formOrButton.tagName === 'BUTTON') {
      click(formOrButton);
      return;
    }
    formOrButton.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  };

  const pressKey = (key, target = window.document) => {
    target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
  };

  /** Wait for queued microtasks + n macrotask ticks so deferred store.update
   *  edits (the change-handler in assetCard.js queues via Promise.resolve)
   *  have time to run. */
  const tick = async (ms = 0) => {
    await Promise.resolve();
    await Promise.resolve();
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
  };

  return {
    window,
    document: window.document,
    store,
    storage,
    modules: { ui, dom: dom2, card, list, userInfo, helpTip, modal, state },
    click,
    type,
    change,
    submit,
    pressKey,
    tick,
    teardown: () => {
      window.close();
      restoreGlobals();
    },
  };
}
