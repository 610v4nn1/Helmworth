/**
 * @fileoverview Unit tests for Milestone C3 — State management.
 * Covers TC3.1–TC3.10.
 */
import {
  createStore,
  defaultState,
  reduceAddAsset,
  reduceUpdateAsset,
  reduceRemoveAsset,
  reduceApplyCountryDefaults,
  STORAGE_KEY,
} from '../../src/state.js';
import {
  createStocks,
  createBonds,
  createCash,
} from '../../src/model/assets.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

/** Builds a fake storage with in-memory map. Spies via .calls. */
function makeFakeStorage(initial = {}) {
  const data = { ...initial };
  const calls = { getItem: [], setItem: [] };
  return {
    data,
    calls,
    getItem(k) { calls.getItem.push(k); return data[k] ?? null; },
    setItem(k, v) { calls.setItem.push([k, v]); data[k] = v; },
  };
}

/** A logger that records calls. */
function makeLogger() {
  const messages = [];
  const fn = (msg) => messages.push(msg);
  fn.messages = messages;
  return fn;
}

export default function run({ test, assert, assertClose, assertDeepEqual }) {
  // -------------------------------------------------------------------------
  // CORE STORE
  // -------------------------------------------------------------------------
  test('TC3.1: fresh store getState() returns default state', () => {
    const storage = makeFakeStorage();
    const store = createStore({ storage });
    const s = store.getState();
    assert(s.userInfo && typeof s.userInfo === 'object', 'has userInfo');
    assert(Array.isArray(s.assets), 'has assets array');
    assert(s.assets.length === 0, 'no assets initially');
  });

  test('TC3.2: subscribe is invoked on setState; unsubscribe stops invocations', () => {
    const storage = makeFakeStorage();
    const store = createStore({ storage });
    let calls = 0;
    const unsub = store.subscribe(() => { calls++; });

    store.addAsset(createStocks({ value: 1000 }));
    assert(calls === 1, `expected 1 call, got ${calls}`);

    store.addAsset(createStocks({ value: 2000 }));
    assert(calls === 2, `expected 2 calls, got ${calls}`);

    unsub();
    store.addAsset(createStocks({ value: 3000 }));
    assert(calls === 2, `unsubscribed: still 2 calls, got ${calls}`);
  });

  test('TC3.3: addAsset → assets.length 1; pre-call snapshot unchanged', () => {
    const storage = makeFakeStorage();
    const store = createStore({ storage });
    const before = clone(store.getState());
    const stocks = createStocks({ value: 5000 });
    store.addAsset(stocks);
    assert(store.getState().assets.length === 1, 'one asset');
    // The pre-call snapshot we captured should still be deep-equal to the OLD state
    assert(before.assets.length === 0, 'snapshot.assets unchanged length');
  });

  test('TC3.4: updateAsset only mutates the matched asset', () => {
    const storage = makeFakeStorage();
    const store = createStore({ storage });
    const a = createStocks({ name: 'A', value: 1000 });
    const b = createStocks({ name: 'B', value: 2000 });
    store.addAsset(a);
    store.addAsset(b);

    const beforeB = clone(store.getState().assets.find((x) => x.id === b.id));
    store.updateAsset(a.id, { name: 'A-updated' });

    const aAfter = store.getState().assets.find((x) => x.id === a.id);
    const bAfter = store.getState().assets.find((x) => x.id === b.id);
    assert(aAfter.name === 'A-updated', 'a updated');
    assertDeepEqual(bAfter, beforeB, 'b unchanged');
  });

  test('TC3.5: removeAsset removes only the matching asset', () => {
    const storage = makeFakeStorage();
    const store = createStore({ storage });
    const a = createStocks({ value: 1000 });
    const b = createBonds({ value: 2000 });
    const c = createCash({ value: 500 });
    store.addAsset(a);
    store.addAsset(b);
    store.addAsset(c);

    store.removeAsset(b.id);
    const ids = store.getState().assets.map((x) => x.id);
    assert(ids.includes(a.id), 'a kept');
    assert(!ids.includes(b.id), 'b removed');
    assert(ids.includes(c.id), 'c kept');
  });

  test('TC3.6: applyCountryDefaults("DE") overwrites tax fields, keeps non-tax', () => {
    const storage = makeFakeStorage();
    const store = createStore({ storage });
    const stocks = createStocks({ name: 'VTI', value: 10000, capitalGainsTaxRate: 0.50, avgReturnRate: 0.07 });
    const bonds  = createBonds({  name: 'B',   value: 50000, capitalGainsTaxRate: 0.50, yieldTaxRate: 0.50, yieldRate: 0.04 });
    store.addAsset(stocks);
    store.addAsset(bonds);

    store.applyCountryDefaults('DE');

    const sNow = store.getState().assets.find((x) => x.id === stocks.id);
    const bNow = store.getState().assets.find((x) => x.id === bonds.id);

    // Tax fields overwritten (DE stocks CGT = 0.26375)
    assertClose(sNow.capitalGainsTaxRate, 0.26375, 1e-6, 'stocks CGT overwritten');
    assertClose(bNow.capitalGainsTaxRate, 0.26375, 1e-6, 'bonds CGT overwritten');
    assertClose(bNow.yieldTaxRate,        0.26375, 1e-6, 'bonds yield tax overwritten');

    // Non-tax fields preserved
    assert(sNow.name === 'VTI', 'name preserved');
    assertClose(sNow.avgReturnRate, 0.07, 1e-9, 'avgReturnRate preserved');
    assertClose(bNow.yieldRate,     0.04, 1e-9, 'yieldRate preserved');

    // userInfo.country set
    assert(store.getState().userInfo.country === 'DE', 'country set');
  });

  test('TC3.7: pure reducer returns new object, original unchanged', () => {
    const s0 = defaultState();
    const snap = clone(s0);
    const stocks = createStocks({ value: 1000 });
    const s1 = reduceAddAsset(s0, stocks);
    assert(s0 !== s1, 'returned a new object');
    assert(s0.assets !== s1.assets, 'returned a new assets array');
    assertDeepEqual(s0, snap, 'original state unchanged');
    assert(s1.assets.length === 1, 'new state has the asset');
  });

  // -------------------------------------------------------------------------
  // PERSISTENCE
  // -------------------------------------------------------------------------
  test('TC3.8: setState → debounced JSON written to storage', async () => {
    const storage = makeFakeStorage();
    const store = createStore({ storage, debounceMs: 5 });
    store.addAsset(createStocks({ value: 1234 }));

    // Wait past debounce window
    await new Promise((r) => setTimeout(r, 20));

    const raw = storage.data[STORAGE_KEY];
    assert(typeof raw === 'string', 'storage has serialized state');
    const parsed = JSON.parse(raw);
    assert(parsed.assets.length === 1, 'persisted state has the asset');
    assertClose(parsed.assets[0].lots[0].value, 1234, 1e-9);
  });

  test('TC3.9: pre-seeded storage → store loads it', () => {
    const storage = makeFakeStorage();
    const seeded = {
      userInfo: { age: 45, country: 'IT', monthlyExpenses: 2500, inflationRate: 0.025 },
      assets: [{ id: 'x', name: 'Seeded', class: 'cash', value: 1234 }],
    };
    storage.data[STORAGE_KEY] = JSON.stringify(seeded);

    const store = createStore({ storage });
    const s = store.getState();
    assert(s.userInfo.age === 45, 'seeded age loaded');
    assert(s.userInfo.country === 'IT', 'seeded country loaded');
    assert(s.assets.length === 1, 'seeded asset loaded');
    assert(s.assets[0].value === 1234, 'seeded value loaded');
  });

  test('TC3.10: corrupt JSON → defaults + logger called', () => {
    const storage = makeFakeStorage();
    storage.data[STORAGE_KEY] = 'not json';
    const logger = makeLogger();

    const store = createStore({ storage, logger });
    const s = store.getState();
    assert(s.assets.length === 0, 'fallback to default state');
    assert(logger.messages.length > 0, 'logger called');
    assert(logger.messages[0].toLowerCase().includes('parse'), 'message mentions parse error');
  });

  // -------------------------------------------------------------------------
  // EXTRA SAFETY TESTS
  // -------------------------------------------------------------------------
  test('flush() writes synchronously', () => {
    const storage = makeFakeStorage();
    const store = createStore({ storage, debounceMs: 10000 });
    store.addAsset(createStocks({ value: 999 }));
    // Without flush, the timer is still pending — storage might be empty
    store.flush();
    const raw = storage.data[STORAGE_KEY];
    assert(typeof raw === 'string', 'flush wrote synchronously');
  });

  test('reduceUpdateAsset on missing id is a no-op', () => {
    const s0 = reduceAddAsset(defaultState(), createStocks({ value: 100 }));
    const s1 = reduceUpdateAsset(s0, 'nonexistent', { name: 'X' });
    // Nothing matches → assets list deep-equal to s0.assets
    assertDeepEqual(s1.assets, s0.assets);
  });

  test('reduceApplyCountryDefaults with unknown code is a no-op', () => {
    const s0 = reduceAddAsset(defaultState(), createStocks({ value: 100, capitalGainsTaxRate: 0.99 }));
    const s1 = reduceApplyCountryDefaults(s0, 'ZZ');
    assertDeepEqual(s1, s0, 'unknown country code → no change');
  });
}
