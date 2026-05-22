/**
 * @fileoverview Aggregates passive income across all assets for a given year.
 * @module src/engine/passiveIncome
 */

import { stepStocks } from './steps/stocks.js';
import { stepBonds } from './steps/bonds.js';
import { stepCrypto } from './steps/crypto.js';
import { stepCash } from './steps/cash.js';
import { stepRealEstate } from './steps/realEstate.js';
import { stepPrivateBusiness } from './steps/privateBusiness.js';
import { stepPension } from './steps/pension.js';
import { stepPersonalDebt } from './steps/personalDebt.js';

/**
 * Computes passive income from a SNAPSHOT of assets, *without* mutating them.
 * Internally calls each class's step function purely to obtain its `passiveIncome`
 * for the given context, then sums the results by class.
 *
 * Note: this is a *read-only* helper. The full simulation uses the step
 * functions directly (so it gets the updated assets too).
 *
 * @pure
 * @param {Array} assets - List of assets
 * @param {Object} ctx - Context: { year, currentAge }
 * @returns {{total: number, byClass: Object<string, number>}}
 *
 * @formula
 *   byClass[c] = Σ stepC(a, ctx).passiveIncome   for each asset a of class c
 *   total      = Σ byClass[c]
 *
 * Cross-reference: see "Passive income" in
 *   [engine.md](../../docs/engine.md#passive-income).
 */
export function computePassiveIncome(assets, ctx) {
  const byClass = {};
  let total = 0;

  for (const a of assets) {
    let pi = 0;
    switch (a.class) {
      case 'stocks':          pi = stepStocks(a, ctx).passiveIncome; break;
      case 'bonds':           pi = stepBonds(a, ctx).passiveIncome; break;
      case 'crypto':          pi = stepCrypto(a, ctx).passiveIncome; break;
      case 'cash':            pi = stepCash(a, ctx).passiveIncome; break;
      case 'realEstate':      pi = stepRealEstate(a, ctx).passiveIncome; break;
      case 'privateBusiness': pi = stepPrivateBusiness(a, ctx).passiveIncome; break;
      case 'pension':         pi = stepPension(a, ctx).passiveIncome; break;
      case 'personalDebt':    pi = stepPersonalDebt(a, ctx).passiveIncome; break;
      default:                pi = 0;
    }
    byClass[a.class] = (byClass[a.class] || 0) + pi;
    total += pi;
  }

  return { total, byClass };
}
