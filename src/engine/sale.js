/**
 * @fileoverview Sale events for illiquid assets (real estate, private business)
 * and proceeds-conversion into another asset.
 * @module src/engine/sale
 */

import { newId } from '../model/id.js';
import { createLot } from '../model/assets.js';

/**
 * Computes the net proceeds from selling an illiquid asset (real estate or
 * private business) at its current value (i.e. *after* the year's growth has
 * already been applied by the step function).
 *
 * @pure
 *
 * @param {Object} asset - Real estate or private business asset
 * @param {number} _year - Simulation year (currently unused; reserved for future)
 * @returns {number} Net cash to be invested elsewhere
 *
 * @formula
 *   For Real Estate:
 *     fees       = saleFeesPct · value
 *     gain       = max(0, value − originalValue)
 *     tax        = saleCapitalGainsTaxRate · gain
 *     proceeds   = value − fees − tax − mortgageBalance
 *
 *   For Private Business:
 *     fees       = saleFeesPct · value
 *     gain       = max(0, value − originalValue)
 *     tax        = saleCapitalGainsTaxRate · gain
 *     proceeds   = value − fees − tax
 *
 * @assumptions
 *   - `originalValue` was captured at asset creation; v1 doesn't track
 *     subsequent improvements/refinancings.
 *   - Capital loss does not produce a tax credit (clamped at 0).
 *
 * Cross-reference: see "Sale events" in
 *   [engine.md](../../docs/engine.md#sale-events).
 */
export function computeSaleProceeds(asset, _year) {
  const fees = (asset.saleFeesPct ?? 0) * asset.value;
  const gain = Math.max(0, asset.value - (asset.originalValue ?? asset.value));
  const tax = (asset.saleCapitalGainsTaxRate ?? 0) * gain;
  let proceeds = asset.value - fees - tax;
  if (asset.class === 'realEstate') {
    proceeds -= asset.mortgageBalance ?? 0;
  }
  return proceeds;
}

/**
 * Applies a sale conversion: removes the source asset and either:
 *   - merges proceeds as a new lot into an existing target asset, or
 *   - creates a brand-new asset from `inlineParams`.
 *
 * @pure  Returns a new assets list; never mutates inputs.
 *
 * @param {Array} assets       - Full asset list (will not be mutated)
 * @param {string} sourceAssetId
 * @param {number} proceeds
 * @param {number} saleYear    - Year (offset from start) the sale occurred
 * @returns {Array} Updated asset list
 *
 * @formula
 *   Locate sourceAsset by id. Read its `saleConversion`:
 *     - if targetAssetId is set:
 *         find target (must be lot-bearing: stocks/bonds/crypto)
 *         append { value: proceeds, costBasis: proceeds, year: saleYear } to target.lots
 *     - else if inlineParams is set:
 *         create a new asset of `inlineParams.class` with the given fields,
 *         seeded with one lot { value: proceeds, costBasis: proceeds, year: saleYear }
 *         (or set value=proceeds for cash-class)
 *     - else (no conversion specified):
 *         create a new cash asset holding the proceeds. Proceeds never disappear.
 *
 *   Remove the source asset from the list.
 *
 * Cross-reference: see "Sale events" in
 *   [engine.md](../../docs/engine.md#sale-events).
 */
export function applySaleConversion(assets, sourceAssetId, proceeds, saleYear) {
  const source = assets.find((a) => a.id === sourceAssetId);
  if (!source) return assets.map(deepClone);

  const conv = source.saleConversion;
  let result = assets.filter((a) => a.id !== sourceAssetId).map(deepClone);

  if (!conv) {
    // No conversion specified → proceeds become a new cash asset.
    // Proceeds never disappear; the user can manually move them later.
    result.push(buildAssetFromInline(
      { class: 'cash', name: `${source.name || 'Sale'} proceeds` },
      proceeds,
      saleYear,
    ));
    return result;
  }

  if (conv.targetAssetId) {
    result = result.map((a) => {
      if (a.id !== conv.targetAssetId) return a;
      // Target must be lot-bearing (stocks/bonds/crypto)
      if (!Array.isArray(a.lots)) return a;
      return {
        ...a,
        lots: [...a.lots, createLot({ value: proceeds, costBasis: proceeds, year: saleYear })],
      };
    });
  } else if (conv.inlineParams) {
    result.push(buildAssetFromInline(conv.inlineParams, proceeds, saleYear));
  }

  return result;
}

/**
 * Builds a new asset from inlineParams, seeded with the proceeds.
 * @private
 */
function buildAssetFromInline(params, proceeds, saleYear) {
  const cls = params.class;
  const base = {
    id: newId(),
    name: params.name ?? 'Sale proceeds',
    class: cls,
  };

  switch (cls) {
    case 'stocks':
      return {
        ...base,
        lots: [createLot({ value: proceeds, costBasis: proceeds, year: saleYear })],
        avgReturnRate: params.avgReturnRate ?? 0.07,
        yearlyContribution: params.yearlyContribution ?? 0,
        capitalGainsTaxRate: params.capitalGainsTaxRate ?? 0.26,
      };
    case 'bonds':
      return {
        ...base,
        lots: [createLot({ value: proceeds, costBasis: proceeds, year: saleYear })],
        yieldRate: params.yieldRate ?? 0.04,
        yearlyContribution: params.yearlyContribution ?? 0,
        capitalGainsTaxRate: params.capitalGainsTaxRate ?? 0.26,
        yieldTaxRate: params.yieldTaxRate ?? 0.26,
      };
    case 'crypto':
      return {
        ...base,
        lots: [createLot({ value: proceeds, costBasis: proceeds, year: saleYear })],
        avgReturnRate: params.avgReturnRate ?? 0.10,
        yearlyContribution: params.yearlyContribution ?? 0,
        capitalGainsTaxRate: params.capitalGainsTaxRate ?? 0.26,
      };
    case 'cash':
      return {
        ...base,
        value: proceeds,
      };
    default:
      // Illiquid targets aren't supported for inline conversion in v1;
      // fall back to cash so proceeds aren't lost.
      return { ...base, class: 'cash', value: proceeds };
  }
}

function deepClone(a) {
  return JSON.parse(JSON.stringify(a));
}
