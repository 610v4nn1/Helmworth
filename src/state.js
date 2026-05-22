/**
 * @fileoverview State management: pure reducers + injectable persistence.
 *
 * The store holds `{ userInfo, assets }`. Mutations go through pure reducers
 * (`reduceAddAsset`, `reduceUpdateAsset`, `reduceRemoveAsset`,
 * `reduceApplyCountryDefaults`); the store is a thin imperative wrapper that
 * applies the reducer, persists, and notifies subscribers.
 *
 * Persistence is abstracted via a storage adapter (`{ getItem, setItem }`),
 * allowing tests to inject a fake. The default adapter wraps `localStorage`
 * (the *only* place in the calculation layer that touches `localStorage`).
 *
 * @module src/state
 */

import { createUserInfo } from './model/userInfo.js';
import { defaultCountry, getDefaultsByCountry } from './data/countries.js';

/** Storage key in localStorage / fake storage. */
export const STORAGE_KEY = 'fire-planner-state-v1';

/** Default debounce window for persistence saves (ms). */
export const SAVE_DEBOUNCE_MS = 200;

// ---------------------------------------------------------------------------
// DEFAULT STATE
// ---------------------------------------------------------------------------

/**
 * Builds a fresh, default state object.
 * @returns {{userInfo: Object, assets: Array}}
 */
export function defaultState() {
  return {
    userInfo: createUserInfo({ country: defaultCountry?.code ?? '' }),
    assets: [],
  };
}

// ---------------------------------------------------------------------------
// PURE REDUCERS — return a new state, never mutate the input.
// ---------------------------------------------------------------------------

/**
 * Returns a new state with `asset` appended.
 *
 * @pure
 * @param {Object} state - Current state
 * @param {Object} asset - Asset to add
 * @returns {Object} New state
 */
export function reduceAddAsset(state, asset) {
  return {
    ...state,
    assets: [...state.assets, asset],
  };
}

/**
 * Returns a new state with the asset matching `id` updated by merging `patch`.
 *
 * @pure
 * @param {Object} state - Current state
 * @param {string} id - Asset id
 * @param {Object} patch - Partial fields to merge into the asset
 * @returns {Object} New state (unchanged if id not found)
 */
export function reduceUpdateAsset(state, id, patch) {
  return {
    ...state,
    assets: state.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
  };
}

/**
 * Returns a new state with the asset matching `id` removed.
 *
 * @pure
 * @param {Object} state - Current state
 * @param {string} id - Asset id
 * @returns {Object} New state
 */
export function reduceRemoveAsset(state, id) {
  return {
    ...state,
    assets: state.assets.filter((a) => a.id !== id),
  };
}

/**
 * Returns a new state with all asset tax fields overwritten by the given
 * country's defaults. Non-tax fields are preserved.
 *
 * @pure
 * @param {Object} state - Current state
 * @param {string} countryCode - ISO country code
 * @returns {Object} New state with userInfo.country set and tax fields overwritten
 *
 * @formula
 *   For each asset a:
 *     stocks:          capitalGainsTaxRate ← stocksCapitalGainsTax
 *     bonds:           capitalGainsTaxRate ← bondsCapitalGainsTax
 *                      yieldTaxRate        ← bondsYieldTax
 *     crypto:          capitalGainsTaxRate ← cryptoCapitalGainsTax
 *     realEstate:      saleCapitalGainsTaxRate ← realEstateSaleCapitalGainsTax
 *     privateBusiness: dividendTaxRate         ← privateBusinessDividendTax
 *                      saleCapitalGainsTaxRate ← privateBusinessSaleCapitalGainsTax
 *     others (cash, pension, personalDebt): unchanged
 */
export function reduceApplyCountryDefaults(state, countryCode) {
  const defaults = getDefaultsByCountry(countryCode);
  if (!defaults) return state; // unknown code → no-op

  const newAssets = state.assets.map((a) => {
    switch (a.class) {
      case 'stocks':
        return { ...a, capitalGainsTaxRate: defaults.stocksCapitalGainsTax };
      case 'bonds':
        return {
          ...a,
          capitalGainsTaxRate: defaults.bondsCapitalGainsTax,
          yieldTaxRate: defaults.bondsYieldTax,
        };
      case 'crypto':
        return { ...a, capitalGainsTaxRate: defaults.cryptoCapitalGainsTax };
      case 'realEstate':
        return {
          ...a,
          saleCapitalGainsTaxRate: defaults.realEstateSaleCapitalGainsTax,
        };
      case 'privateBusiness':
        return {
          ...a,
          dividendTaxRate: defaults.privateBusinessDividendTax,
          saleCapitalGainsTaxRate: defaults.privateBusinessSaleCapitalGainsTax,
        };
      default:
        return a;
    }
  });

  return {
    ...state,
    userInfo: { ...state.userInfo, country: countryCode },
    assets: newAssets,
  };
}

// ---------------------------------------------------------------------------
// MIGRATIONS
// ---------------------------------------------------------------------------

/**
 * Migrates a loaded state object so it conforms to the current schema.
 *
 * Handles:
 *  - Real-estate refactor: drops the now-unused `mortgageInterestRate`,
 *    `monthlyRent`, `rentalIncomeTaxRate` fields, defaults `propertyKind`
 *    to `'investment'`, ensures `cashFlow` / `yearlyCosts` are present,
 *    and migrates `mortgageYearlyRepayment` (currency amount) to
 *    `mortgageRepaymentRate` (decimal fraction of the outstanding balance).
 *  - Backfills `userInfo.retirementAge` (default 67) for states persisted
 *    before this field existed. Re-runs `createUserInfo` on the loaded
 *    `userInfo`, which fills in any missing defaults and re-validates.
 *
 * Idempotent: applying it twice yields the same result.
 *
 * @pure
 * @param {Object} state
 * @returns {Object} A migrated copy (input is not mutated)
 */
export function migrateState(state) {
  if (!state || typeof state !== 'object') return state;
  const assets = Array.isArray(state.assets) ? state.assets.map(migrateAsset) : state.assets;
  // Backfill missing userInfo fields (e.g. retirementAge on pre-v0.2 states).
  // createUserInfo will throw on truly malformed values; in that case fall
  // back to the persisted userInfo as-is so we don't silently lose data.
  let userInfo = state.userInfo;
  if (userInfo && typeof userInfo === 'object') {
    try {
      userInfo = createUserInfo(userInfo);
    } catch (_err) {
      // Leave userInfo untouched; the load path will re-detect bad shape.
    }
  }
  return { ...state, userInfo, assets };
}

/**
 * Migrates a single asset to the current schema.
 * @pure
 * @param {Object} a
 * @returns {Object}
 */
function migrateAsset(a) {
  if (!a || typeof a !== 'object') return a;
  if (a.class !== 'realEstate') return a;

  // Strip removed fields and ensure new ones exist with sensible defaults.
  const {
    mortgageInterestRate: _mIR,
    monthlyRent: _mR,
    rentalIncomeTaxRate: _rIT,
    mortgageYearlyRepayment: _mYR, // legacy currency amount — drop in favour of mortgageRepaymentRate
    ...rest
  } = a;

  const propertyKind = a.propertyKind === 'residence' ? 'residence' : 'investment';
  const isInvestment = propertyKind === 'investment';

  // Migrate mortgageYearlyRepayment (a currency amount) → mortgageRepaymentRate (decimal).
  // We can't safely compute the equivalent rate from a one-time amount, so we
  // default to 0 and let the user re-enter as a percentage.
  const mortgageRepaymentRate =
    typeof a.mortgageRepaymentRate === 'number' ? a.mortgageRepaymentRate : 0;

  return {
    ...rest,
    propertyKind,
    mortgageRepaymentRate,
    cashFlow: isInvestment ? (typeof a.cashFlow === 'number' ? a.cashFlow : 0) : 0,
    yearlyCosts: isInvestment ? 0 : (typeof a.yearlyCosts === 'number' ? a.yearlyCosts : 0),
  };
}

// ---------------------------------------------------------------------------
// STORAGE ADAPTER (injectable)
// ---------------------------------------------------------------------------

/**
 * Wraps a `{ getItem, setItem }` pair into a storage adapter.
 * The adapter contract:
 *   - getItem(key) → string | null
 *   - setItem(key, value) → void
 *
 * @param {Object} impl
 * @param {(key:string) => (string|null)} impl.getItem
 * @param {(key:string, value:string) => void} impl.setItem
 * @returns {{getItem: Function, setItem: Function}}
 */
export function createStorageAdapter({ getItem, setItem }) {
  return { getItem, setItem };
}

/**
 * Default storage adapter backed by `localStorage`.
 * This is the *only* place in the calculation layer that touches `localStorage`.
 *
 * Falls back to a no-op adapter if `localStorage` is unavailable (e.g. Node / SSR).
 * @returns {{getItem: Function, setItem: Function}}
 */
export function defaultStorageAdapter() {
  // eslint-disable-next-line no-undef
  const ls = typeof localStorage !== 'undefined' ? localStorage : null;
  if (!ls) {
    return {
      getItem: () => null,
      setItem: () => {},
    };
  }
  return {
    getItem: (k) => ls.getItem(k),
    setItem: (k, v) => ls.setItem(k, v),
  };
}

// ---------------------------------------------------------------------------
// STORE (imperative wrapper around reducers + persistence)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} StoreOptions
 * @property {{getItem:Function, setItem:Function}} [storage] - Storage adapter
 * @property {(msg:string) => void} [logger] - Logger for parse errors etc.
 * @property {number} [debounceMs] - Save debounce window
 * @property {string} [storageKey]
 */

/**
 * Creates a state store: in-memory state + reducers + persistence + subscribers.
 *
 * @param {StoreOptions} [opts={}]
 * @returns {{
 *   getState: () => Object,
 *   setState: (next: Object) => void,
 *   subscribe: (fn: Function) => Function,
 *   addAsset: (asset: Object) => void,
 *   updateAsset: (id: string, patch: Object) => void,
 *   removeAsset: (id: string) => void,
 *   applyCountryDefaults: (countryCode: string) => void,
 *   flush: () => void,
 *   _saveTimer: any,
 * }}
 */
export function createStore(opts = {}) {
  const storage = opts.storage ?? defaultStorageAdapter();
  const logger = opts.logger ?? (() => {});
  const debounceMs = opts.debounceMs ?? SAVE_DEBOUNCE_MS;
  const storageKey = opts.storageKey ?? STORAGE_KEY;

  // Load initial state
  let state;
  try {
    const raw = storage.getItem(storageKey);
    if (raw == null) {
      state = defaultState();
    } else {
      const parsed = JSON.parse(raw);
      // Basic shape check
      if (parsed && typeof parsed === 'object' && 'userInfo' in parsed && 'assets' in parsed) {
        state = migrateState(parsed);
      } else {
        logger(`State load: bad shape, using defaults`);
        state = defaultState();
      }
    }
  } catch (err) {
    logger(`State load: parse error (${err.message}), using defaults`);
    state = defaultState();
  }

  const subscribers = new Set();
  let saveTimer = null;

  function notify() {
    subscribers.forEach((fn) => {
      try { fn(state); } catch (err) { logger(`subscriber error: ${err.message}`); }
    });
  }

  function scheduleSave() {
    if (saveTimer != null) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      try {
        storage.setItem(storageKey, JSON.stringify(state));
      } catch (err) {
        logger(`State save error: ${err.message}`);
      }
      saveTimer = null;
    }, debounceMs);
  }

  function setState(next) {
    state = next;
    scheduleSave();
    notify();
  }

  function flush() {
    // Force-write any pending save synchronously (used by tests)
    if (saveTimer != null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      storage.setItem(storageKey, JSON.stringify(state));
    } catch (err) {
      logger(`State save error: ${err.message}`);
    }
  }

  return {
    getState: () => state,
    setState,
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    addAsset(asset) {
      setState(reduceAddAsset(state, asset));
    },
    updateAsset(id, patch) {
      setState(reduceUpdateAsset(state, id, patch));
    },
    removeAsset(id) {
      setState(reduceRemoveAsset(state, id));
    },
    applyCountryDefaults(countryCode) {
      setState(reduceApplyCountryDefaults(state, countryCode));
    },
    flush,
  };
}
