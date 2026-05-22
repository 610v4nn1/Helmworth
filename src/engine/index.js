/**
 * @fileoverview FROZEN public engine API consumed by the UI layer.
 *
 * The UI **must import only from this file**. Adding/removing an export here
 * is a breaking change and must be reflected in:
 *   - `engine.md` → "Public engine API" section
 *   - architectural test `tests/arch/engine-public-api.test.js` (C5)
 *
 * @module src/engine
 */

export { simulateStandard } from './simulate.js';
export { simulateCoastFire, findCoastFireAge } from './scenarios.js';
export { simulateFire, findFireAge } from './fire.js';
export { computeNetWorth, computeNetWorthByClass } from './netWorth.js';
export { computePassiveIncome } from './passiveIncome.js';
export { computeStatsTable } from './stats.js';
export { validateAsset } from '../model/assets.js';
