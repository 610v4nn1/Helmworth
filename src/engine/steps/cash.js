/**
 * @fileoverview Yearly step for Cash — pure.
 * @module src/engine/steps/cash
 */

/**
 * Advances a Cash asset by one year. Cash has no return, no contribution,
 * no income, no tax.
 *
 * @pure
 * @param {Object} asset - Cash asset
 * @param {Object} _ctx - Step context (ignored)
 * @returns {{asset: Object, passiveIncome: number}}
 *
 * @formula
 *   value' = value
 *   passiveIncome = 0
 *
 * @assumptions Cash earns no interest in v1 (deliberately simple).
 *
 * Cross-reference: see "Cash" in [engine.md](../../../docs/engine.md#cash).
 */
export function stepCash(asset, _ctx) {
  return {
    asset: { ...asset },
    passiveIncome: 0,
  };
}
