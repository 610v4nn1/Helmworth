/**
 * @fileoverview HIFO lot-sale logic + proportional drawdown across asset classes.
 * @module src/engine/drawdown
 */

/**
 * Sells lots from a lot-bearing asset (stocks/bonds/crypto) using HIFO
 * (Highest cost basis First-Out) to minimise realised gains.
 *
 * @pure
 * @param {Array<{value:number, costBasis:number, year:number}>} lots
 * @param {number} proceedsNeeded - Net amount of cash the seller needs (after tax)
 * @param {number} cgt - Capital gains tax rate (decimal, e.g. 0.26)
 * @returns {{updatedLots: Array, grossSold: number, netProceeds: number, taxPaid: number}}
 *   - updatedLots: surviving / partially-sold lots; consumed lots removed
 *   - grossSold:   sum of lot value sold (pre-tax cash from sale)
 *   - netProceeds: grossSold − taxPaid
 *   - taxPaid:     sum of capital-gains tax on each (partially) sold lot
 *
 * @formula
 *   Sort lots by costBasis DESCENDING (HIFO); ties broken by year ASCENDING
 *   (older lots first) for determinism.
 *
 *   For each lot in sorted order, while still need cash:
 *     unrealizedGainPerUnit = max(0, (lot.value − lot.costBasis) / lot.value)
 *     effectiveTaxRate      = unrealizedGainPerUnit · cgt
 *
 *     // Net proceeds per unit of *value* sold from this lot
 *     netRatio = 1 − effectiveTaxRate
 *
 *     remainingNet = proceedsNeeded − (cumulativeNetProceeds)
 *     valueToSell  = remainingNet / netRatio   // gross-up
 *     valueToSell  = min(valueToSell, lot.value)   // can't sell more than we have
 *
 *     gainSold     = max(0, valueToSell − valueToSell · costBasis/lot.value)
 *                  = max(0, valueToSell · (1 − costBasis/lot.value))
 *     taxOnLot     = gainSold · cgt
 *     netFromLot   = valueToSell − taxOnLot
 *
 *     grossSold     += valueToSell
 *     taxPaid       += taxOnLot
 *     netProceeds   += netFromLot
 *
 *     If valueToSell == lot.value: drop the lot
 *     Else: lot.value' = lot.value − valueToSell
 *           lot.costBasis' = lot.costBasis · (1 − valueToSell/lot.value)
 *
 *   Stops when netProceeds ≥ proceedsNeeded OR all lots consumed.
 *
 * Cross-reference: see "Drawdown algorithm" in
 *   [engine.md](../../docs/engine.md#drawdown-algorithm).
 *
 * @example
 *   sellLotsHIFO(
 *     [{value:1000, costBasis:600, year:0}, {value:1000, costBasis:900, year:1}],
 *     500,   // need 500 net
 *     0.20   // 20% CGT
 *   )
 *   // The cb=900 lot has lower per-unit gain → consumed first.
 */
export function sellLotsHIFO(lots, proceedsNeeded, cgt) {
  if (proceedsNeeded <= 0) {
    return { updatedLots: lots.map(cloneLot), grossSold: 0, netProceeds: 0, taxPaid: 0 };
  }

  // Stable sort: HIFO (highest cost basis first), tie-break by ascending year.
  const sorted = lots
    .map((l, i) => ({ lot: cloneLot(l), originalIdx: i }))
    .sort((a, b) => {
      if (b.lot.costBasis !== a.lot.costBasis) return b.lot.costBasis - a.lot.costBasis;
      return a.lot.year - b.lot.year;
    });

  let grossSold = 0;
  let taxPaid = 0;
  let netProceeds = 0;
  const consumed = new Set();

  for (const entry of sorted) {
    if (netProceeds >= proceedsNeeded - 1e-9) break;
    const lot = entry.lot;
    if (lot.value <= 0) continue;

    // Per-unit gain ratio (gain dollars per dollar of *value* sold)
    const gainRatio = lot.value > 0 ? Math.max(0, (lot.value - lot.costBasis) / lot.value) : 0;
    const effectiveTax = gainRatio * cgt;
    const netRatio = 1 - effectiveTax;
    if (netRatio <= 0) continue; // pathological: tax wipes out proceeds

    const remainingNet = proceedsNeeded - netProceeds;
    let valueToSell = remainingNet / netRatio;
    if (valueToSell > lot.value) valueToSell = lot.value;

    const gainSold = valueToSell * gainRatio;
    const taxOnLot = gainSold * cgt;
    const netFromLot = valueToSell - taxOnLot;

    grossSold += valueToSell;
    taxPaid += taxOnLot;
    netProceeds += netFromLot;

    // Update or drop the lot
    if (Math.abs(valueToSell - lot.value) < 1e-9) {
      consumed.add(entry.originalIdx);
    } else {
      const remainingValueRatio = (lot.value - valueToSell) / lot.value;
      lot.costBasis = lot.costBasis * remainingValueRatio;
      lot.value = lot.value - valueToSell;
    }
  }

  // Reconstruct the lot list in the original order (skipping consumed)
  const updatedLots = [];
  for (let i = 0; i < lots.length; i++) {
    if (consumed.has(i)) continue;
    const found = sorted.find((e) => e.originalIdx === i);
    updatedLots.push(found.lot);
  }

  return { updatedLots, grossSold, netProceeds, taxPaid };
}

function cloneLot(l) {
  return { value: l.value, costBasis: l.costBasis, year: l.year };
}

/**
 * Covers a yearly cash shortfall by drawing down liquid assets:
 *   1. **Drain `cash` assets first** (in list order) — cash earns no return,
 *      pays no tax, so it's always optimal to spend it before selling
 *      growth assets that would incur capital gains.
 *   2. Allocate the remaining shortfall proportionally across
 *      stocks/bonds/crypto by current value.
 *   3. For each class, sell lots HIFO (paying CGT per the asset's rate).
 *   4. If still short, mark `success = false`.
 *
 * @pure
 * @param {Array} assets - Full asset list
 * @param {number} shortfall - Net cash needed (yearly)
 * @returns {{updatedAssets: Array, drawn: number, success: boolean, taxPaid: number}}
 *
 * @formula
 *   remaining = shortfall
 *
 *   // Step 1: cash first
 *   for each cash asset a (in order), while remaining > 0:
 *     take = min(a.value, remaining)
 *     a.value -= take
 *     drawn   += take
 *     remaining -= take
 *
 *   // Step 2: proportional sale of stocks/bonds/crypto for the rest
 *   liquid = stocks + bonds + crypto (excluding cash)  // by current value
 *   if remaining > 0 and liquid > 0:
 *     for each class c in {stocks,bonds,crypto}:
 *       targetNet_c = remaining · (valueOf(c) / liquid)
 *       distribute targetNet_c across that class's assets proportionally to their value
 *       each asset: sellLotsHIFO(asset.lots, targetNet_assetShare, asset.capitalGainsTaxRate)
 *     drawn += Σ netProceeds; remaining = shortfall − drawn
 *
 *   success = (remaining ≤ ε)
 *
 * Cross-reference: see "Drawdown algorithm" in
 *   [engine.md](../../docs/engine.md#drawdown-algorithm).
 */
export function drawdownYear(assets, shortfall) {
  let result = assets.map(deepCloneAsset);
  let drawn = 0;
  let taxPaid = 0;

  if (shortfall <= 0) {
    return { updatedAssets: result, drawn: 0, success: true, taxPaid: 0 };
  }

  let remaining = shortfall;

  // 1. Drain cash assets first (preserves growth assets and avoids CGT).
  for (const a of result) {
    if (a.class !== 'cash' || remaining <= 1e-6) continue;
    const take = Math.min(a.value, remaining);
    a.value -= take;
    drawn += take;
    remaining -= take;
  }

  // 2. If still short, sell across stocks/bonds/crypto proportionally.
  if (remaining > 1e-6) {
    const liquidClasses = ['stocks', 'bonds', 'crypto'];
    const valueByClass = {};
    let totalLiquid = 0;
    for (const a of result) {
      if (liquidClasses.includes(a.class)) {
        const v = a.lots.reduce((s, l) => s + l.value, 0);
        valueByClass[a.class] = (valueByClass[a.class] || 0) + v;
        totalLiquid += v;
      }
    }

    if (totalLiquid > 0) {
      const targetTotal = remaining;
      let netFromLiquid = 0;
      for (const cls of liquidClasses) {
        const classValue = valueByClass[cls] ?? 0;
        if (classValue <= 0) continue;
        const targetForClass = targetTotal * (classValue / totalLiquid);
        // Allocate within the class proportionally to each asset's value
        const classAssets = result.filter((a) => a.class === cls);
        const classTotal = classAssets.reduce(
          (s, a) => s + a.lots.reduce((ss, l) => ss + l.value, 0),
          0
        );
        for (const asset of classAssets) {
          const assetValue = asset.lots.reduce((s, l) => s + l.value, 0);
          if (assetValue <= 0) continue;
          const assetShare = targetForClass * (assetValue / classTotal);
          const sale = sellLotsHIFO(asset.lots, assetShare, asset.capitalGainsTaxRate ?? 0);
          asset.lots = sale.updatedLots;
          drawn += sale.netProceeds;
          netFromLiquid += sale.netProceeds;
          taxPaid += sale.taxPaid;
        }
      }
      remaining -= netFromLiquid;
    }
  }

  const success = remaining <= 1e-6;
  return { updatedAssets: result, drawn, success, taxPaid };
}

function deepCloneAsset(a) {
  return JSON.parse(JSON.stringify(a));
}
