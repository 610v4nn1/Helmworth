# Implementation Tasks — Financial Independence & Retirement Planner

## Architecture principle: strict calculation/UI separation

The codebase is split into two layers with a **one-way dependency**:

```
        +---------------------+
        |   UI layer (src/ui) |   <-- depends on engine
        +----------+----------+
                   |
                   v
        +---------------------+
        | Calculation layer   |   <-- pure, no DOM
        | (src/model,         |
        |  src/engine,        |
        |  src/state,         |
        |  src/data)          |
        +---------------------+
```

**Calculation layer rules (enforced by tests):**
- No `document`, `window`, `localStorage` references inside `src/model/*`,
  `src/engine/*`, `src/data/*`. (Persistence in `src/state.js` is the *only* allowed
  user of `localStorage`, and it must be injectable for tests — see C3.)
- No imports from `src/ui/**`.
- All functions in `src/engine/**` are **pure**: same input → same output, no
  side effects, no time/`Date.now()`/`Math.random()`. Where randomness/time is needed,
  it is passed in.
- The calculation layer exposes a stable public API consumed by the UI (defined in C4).

**Build order:** the entire calculation layer (C1–C4) is implemented and tested
before any UI work (U1–U4) begins. UI milestones depend on a frozen engine API.

## Engine documentation requirement

The calculation layer is the source of truth for *what the app computes*. It must be
documented at two levels:

1. **In-code JSDoc** on every exported function in `src/model/`, `src/engine/`,
   `src/data/`, and `src/state.js`. JSDoc must include:
   - One-line summary.
   - `@param` and `@returns` with types and units (e.g. `rate: number — yearly rate
     as a decimal (0.07 = 7%)`).
   - `@formula` block (custom tag) for every step / scenario / drawdown function,
     written in LaTeX-style or plain math, stating the exact equation used.
   - `@assumptions` listing any v1 simplifications (e.g. "bond principal stays flat").
   - `@example` for non-trivial functions, including expected output.
   - `@pure` tag on engine functions to declare absence of side effects.
2. **`webapp/docs/engine.md`** — a single human-readable reference covering:
   - Time stepping (the within-year order of operations).
   - Inflation formula.
   - Per-asset-class yearly update formulas (one section each, with variable
     definitions).
   - Passive income calculation (per class + aggregation).
   - Drawdown algorithm (HIFO + proportional allocation, with worked example).
   - Coast FIRE check (4% rule + passive income vs. inflated expenses).
   - FIRE check (search procedure + monotonicity claim).
   - Sale events (proceeds formula for RE and PB, conversion semantics).
   - Net worth definition.
   - Stats table semantics.
   - Cross-references: every formula in `engine.md` cites the function that
     implements it (`src/engine/...`); every `@formula` JSDoc cites a section in
     `engine.md`.

Both docs are written before or alongside each milestone's implementation and are
covered by tests in **Milestone C6**.

## Testing approach

- **Unit tests** for the calculation layer live in `webapp/tests/unit/` as ES
  modules. They run in the browser via `webapp/tests/runner.html`, which imports each
  test file and prints pass/fail. No Node, no build step.
  - Helpers in `webapp/tests/assert.js`: `assert(cond, msg)`,
    `assertClose(a, b, eps, msg)`, `assertDeepEqual(a, b, msg)`, `assertThrows(fn, msg)`.
  - Each test file: `export default async function run({ test })` and uses
    `test('name', fn)`.
- **Architectural tests** verify the calculation/UI separation by static-scanning
  source files (regex over file contents loaded with `fetch`).
- **Manual UI tests** are checklists under each UI milestone, with specific actions
  and expected observable results.

---

# PART A — CALCULATION LAYER (build first)

## Milestone C1 — Data model (pure)

### Implementation
- [ ] **C1.1** Create directory structure: `webapp/src/{model,engine,data}/`,
  `webapp/tests/{unit}/`, `webapp/tests/runner.html`, `webapp/tests/assert.js`,
  `webapp/docs/`.
- [ ] **C1.2** `src/model/userInfo.js`: factory `createUserInfo({ age, country,
  monthlyExpenses, inflationRate })` with defaults and validation.
- [ ] **C1.3** `src/model/assets.js`: 8 class factories (`createStocks`, `createBonds`,
  `createCrypto`, `createCash`, `createRealEstate`, `createPrivateBusiness`,
  `createPension`, `createPersonalDebt`) per `plan.md` §2.3.
- [ ] **C1.4** `src/model/assets.js`: `createLot({ value, costBasis, year })`,
  helpers `assetNetValue(asset)`, `liquidValue(asset)`, `isLiquid(asset)`.
- [ ] **C1.5** `src/model/assets.js`: `validateAsset(asset)` returns
  `{ ok, errors }` (used by both engine and UI).
- [ ] **C1.6** UUID utility `src/model/id.js` with `newId()` (uses
  `crypto.randomUUID()` if available, else fallback). Inject the source for testability.
- [ ] **C1.7** `src/data/countries.js`: EU countries with `defaults` per `plan.md` §4.5.

### Documentation (Milestone C1)
- [ ] **D1.1** JSDoc on every export of `userInfo.js`, `assets.js`, `id.js`,
  `countries.js`: summary, `@param`, `@returns` with units, `@example` for each
  factory.
- [ ] **D1.2** Document every asset-class field in JSDoc on its factory (name, type,
  unit, default, plan reference).
- [ ] **D1.3** Add `webapp/docs/engine.md` skeleton with sections listed in the
  "Engine documentation requirement" preamble; fill the **Data model** and
  **Net worth definition** sections now (formulas not needed yet — they belong to C2).

### Tests (Milestone C1) — `tests/unit/c1.model.test.js`

**User info**
- [ ] **TC1.1** `createUserInfo({})` → `{ age: 30, country: <first>,
  monthlyExpenses: 0, inflationRate: 0.02 }`.
- [ ] **TC1.2** `createUserInfo({ age: -1 })` throws (or clamps — pin chosen behavior).
- [ ] **TC1.3** `createUserInfo({ inflationRate: 0.5 })` is accepted.

**Asset factories**
- [ ] **TC1.4** `createStocks({...})` returns object with `class === 'stocks'`,
  string `id` of length > 0, `lots.length === 1` for given input.
- [ ] **TC1.5** `createStocks` with no lots throws an error mentioning "lot".
- [ ] **TC1.6** Two consecutive `createStocks(...)` produce different `id`s.
- [ ] **TC1.7** `createCash({ value: 1000 })` → `{ class:'cash', value:1000 }`,
  no `lots`/`avgReturnRate`/tax fields.
- [ ] **TC1.8** `createPension({...})` defaults `startingAge` to `67`.
- [ ] **TC1.9** `createPersonalDebt({ balance:10000, interestRate:0.05,
  monthlyPayment:300 })` → `class:'personalDebt'`, `balance:10000`.
- [ ] **TC1.10** `createRealEstate({ value:300000, mortgageBalance:100000 })`:
  `assetNetValue(asset) === 200000`.
- [ ] **TC1.11** Each of the 8 factories with valid minimal input → expected `class`
  literal.

**Lots & helpers**
- [ ] **TC1.12** `createLot({ value:100, costBasis:100, year:0 })` survives
  `JSON.parse(JSON.stringify(...))` deep-equal.
- [ ] **TC1.13** `isLiquid` returns true for stocks/bonds/crypto/cash/pension(after
  start)/personalDebt; false for realEstate/privateBusiness. Pin behavior for pension
  in test.
- [ ] **TC1.14** `validateAsset` on a malformed stocks asset (no lots) returns
  `{ ok:false, errors:[...non-empty]}`.

**Countries**
- [ ] **TC1.15** `countries` array length ≥ 10; each entry has `code`, `name`,
  `defaults` with all 8 expected keys.
- [ ] **TC1.16** All numeric defaults are in `[0, 1]` (rates, not percentages).

---

## Milestone C2 — Simulation engine (pure)

### Implementation

#### Helpers
- [ ] **C2.1** `src/engine/inflation.js`: `inflateExpenses(monthly, rate, years)`.

#### Yearly per-asset updates (each pure, no state mutation — return a new asset)
- [ ] **C2.2** `src/engine/steps/stocks.js`: `stepStocks(asset, ctx) → { asset',
  passiveIncome }`.
- [ ] **C2.3** `src/engine/steps/bonds.js`: `stepBonds`.
- [ ] **C2.4** `src/engine/steps/crypto.js`: `stepCrypto`.
- [ ] **C2.5** `src/engine/steps/cash.js`: `stepCash`.
- [ ] **C2.6** `src/engine/steps/realEstate.js`: `stepRealEstate` (appreciation,
  mortgage update, net rental income).
- [ ] **C2.7** `src/engine/steps/privateBusiness.js`: `stepPrivateBusiness`.
- [ ] **C2.8** `src/engine/steps/pension.js`: `stepPension`.
- [ ] **C2.9** `src/engine/steps/personalDebt.js`: `stepPersonalDebt` (12 monthly
  iterations).

#### Aggregation
- [ ] **C2.10** `src/engine/passiveIncome.js`: `computePassiveIncome(assets, year,
  currentAge)` → `{ total, byClass }`.
- [ ] **C2.11** `src/engine/netWorth.js`: `computeNetWorth(assets)` =
  `sum(positives) − sum(debts) − sum(mortgages)`.

#### Top-level simulation
- [ ] **C2.12** `src/engine/simulate.js`: `simulateStandard(state, { horizonAge=100 })`
  returning `[{ age, year, netWorth, byClass, passiveIncome, expenses }, ...]`.
  Pure: deep-clones input, never mutates.

### Documentation (Milestone C2)
- [ ] **D2.1** `@formula` JSDoc on every step function in `src/engine/steps/*.js`
  stating the exact equation. Examples:
  - `stepStocks`: `lot.value' = lot.value · (1 + avgReturnRate)`; new contribution lot
    `{value: c, costBasis: c, year: y}`.
  - `stepBonds`: `passiveIncome = value · yieldRate · (1 − yieldTaxRate)`;
    `value' = value` (v1 simplification).
  - `stepRealEstate`: pin the chosen mortgage formula explicitly (e.g.
    `mortgageBalance' = mortgageBalance + mortgageBalance · interestRate −
    mortgageYearlyRepayment`); document any rounding.
  - `stepPersonalDebt`: monthly recurrence `bal_{m+1} = bal_m · (1 + r/12) − payment`,
    iterated 12 times; payoff condition `bal ≤ 0 ⇒ bal = 0` and stop payments.
- [ ] **D2.2** `@formula` on `inflateExpenses`, `computePassiveIncome`,
  `computeNetWorth`, `simulateStandard` (yearly step order).
- [ ] **D2.3** `@assumptions` blocks for: bond principal flat, stocks pay no separate
  dividends, cost basis of pre-existing assets equals initial value, simulation horizon
  default = 100.
- [ ] **D2.4** Fill `webapp/docs/engine.md` sections: **Time stepping**,
  **Inflation**, **Per-asset-class yearly updates** (one subsection per class with
  variable table + formula + worked example), **Passive income**, **Net worth**.
- [ ] **D2.5** Each formula in `engine.md` cross-references the implementing function
  (e.g. `[stepStocks](../src/engine/steps/stocks.js)`); each step file's JSDoc
  references the corresponding `engine.md` anchor.

### Tests (Milestone C2) — `tests/unit/c2.engine.test.js`

**Inflation**
- [ ] **TC2.1** `inflateExpenses(1000, 0.02, 0) === 1000`.
- [ ] **TC2.2** `inflateExpenses(1000, 0.02, 10) ≈ 1218.99` (±0.01).
- [ ] **TC2.3** `inflateExpenses(1000, 0, 50) === 1000`.

**Stocks**
- [ ] **TC2.4** Stocks with one lot `value=10000`, `avgReturnRate=0.10`,
  `yearlyContribution=0` → after 1 step: lot `value === 11000`, `costBasis === 10000`.
- [ ] **TC2.5** Same with `yearlyContribution=1000` → 2 lots: original at `11000`,
  new lot `{ value:1000, costBasis:1000, year:1 }`.
- [ ] **TC2.6** Stocks 10 years @ 7%, start `10000`, no contribution → `≈19671.51`
  (±0.01).
- [ ] **TC2.7** Purity: input asset object is unchanged after `stepStocks` (deep-equal
  vs a snapshot taken before).

**Bonds**
- [ ] **TC2.8** Bond `value=100000`, `yieldRate=0.04`, `yieldTaxRate=0.20` →
  passive income = `3200`.
- [ ] **TC2.9** Bond principal flat after 1 step → `value === 100000`.

**Cash**
- [ ] **TC2.10** Cash `value=5000` over 5 steps → still `5000`.

**Real estate**
- [ ] **TC2.11** RE `value=300000`, `appreciationRate=0.03`, `monthlyRent=1500`,
  `yearlyCosts=2000`, `mortgageBalance=0`, `rentalIncomeTaxRate=0.25` → after 1 step:
  `value === 309000`, passive income = `12000`.
- [ ] **TC2.12** Mortgage `100000 @ 0.04`, `mortgageYearlyRepayment=5000` →
  `mortgageBalance` after 1 year matches the formula chosen and pinned in
  `stepRealEstate` (assert exact number; document the formula in source).
- [ ] **TC2.13** Net contribution to net worth `= value − mortgageBalance` post-step.

**Private business**
- [ ] **TC2.14** PB `value=200000 @ 0.05`, `yearlyDividend=10000 @ growth 0.03`,
  `dividendTaxRate=0.26` → passive income year 1 = `7400`; year-2 pre-tax dividend =
  `10300`.

**Pension**
- [ ] **TC2.15** Pension `yearlyAmount=20000 @ 0.02`, `startingAge=67`, current age 60
  → years 0–6 passive income = `0`.
- [ ] **TC2.16** At year 7 (age 67) → income = `20000`. Year 8 → `20400`.

**Personal debt**
- [ ] **TC2.17** Debt `balance=10000`, `interestRate=0.12`, `monthlyPayment=500` →
  after 1 year, `balance ≈ 4734.26` (±0.01) using `bal = bal·(1 + r/12) − payment`,
  12 iterations.
- [ ] **TC2.18** Same debt simulated to payoff: balance reaches `0` and no further
  payments accrue.

**Passive income aggregation**
- [ ] **TC2.19** Mixed portfolio (bonds + RE + PB + pension active) → `byClass` keys
  sum to `total`.
- [ ] **TC2.20** Stocks/crypto contribute `0` to passive income regardless of state.

**Net worth**
- [ ] **TC2.21** Stocks `100000` + cash `5000` + debt `10000` + RE `300000` /
  mortgage `100000` → `computeNetWorth = 295000`.

**simulateStandard end-to-end**
- [ ] **TC2.22** Empty state → array length `horizonAge − age + 1`, all
  `netWorth === 0`.
- [ ] **TC2.23** Single stocks asset, `value=10000 @ 0.10`, `age=30`, `horizonAge=32`
  → `netWorth` per year = `[10000, 11000, 12100]`.
- [ ] **TC2.24** Result objects include `byClass` with non-zero values only for asset
  classes present in state.
- [ ] **TC2.25** Purity: deep-equal of `state` before and after `simulateStandard`
  (no mutation).
- [ ] **TC2.26** Determinism: calling `simulateStandard` twice on the same input
  produces deep-equal output.

---

## Milestone C3 — State management (pure logic + injectable persistence)

### Implementation
- [ ] **C3.1** `src/state.js`: in-memory store `{ userInfo, assets:[] }` with
  `getState`, `setState(patch)`, `subscribe(fn)` returning unsubscribe.
- [ ] **C3.2** Mutation helpers: `addAsset`, `updateAsset(id, patch)`,
  `removeAsset(id)`, `applyCountryDefaults(countryCode)` — all expressed as pure
  reducers over state, with a thin imperative wrapper.
- [ ] **C3.3** Persistence: `createStorageAdapter({ getItem, setItem })` so tests can
  inject a fake. Default export uses the real `localStorage`. Save is debounced.
- [ ] **C3.4** Resilient load: invalid/corrupt stored JSON → return default state and
  call an injected logger (no `console.error` in pure layer; tests assert the logger
  was called).

### Documentation (Milestone C3)
- [ ] **D3.1** JSDoc on `getState`, `setState`, `subscribe`, `addAsset`,
  `updateAsset`, `removeAsset`, `applyCountryDefaults`, `createStorageAdapter`.
- [ ] **D3.2** Document the storage-adapter contract (`getItem(key) → string|null`,
  `setItem(key, value) → void`) in JSDoc and in `engine.md` under a new
  **State & persistence** section.
- [ ] **D3.3** Document the debounce window (default ms) and the storage key
  constant.

### Tests (Milestone C3) — `tests/unit/c3.state.test.js`

- [ ] **TC3.1** Fresh store `getState()` → default `{ userInfo, assets:[] }`.
- [ ] **TC3.2** `subscribe(fn)` invoked exactly once per `setState`; after
  `unsubscribe()`, no further invocations.
- [ ] **TC3.3** `addAsset(stocks)` → `assets.length === 1`; original snapshot
  unchanged.
- [ ] **TC3.4** `updateAsset(id, { name:'X' })` mutates only that asset; siblings
  deep-equal pre-update.
- [ ] **TC3.5** `removeAsset(id)` removes only the matching asset.
- [ ] **TC3.6** `applyCountryDefaults('DE')` overwrites all tax fields with German
  defaults; non-tax fields unchanged.
- [ ] **TC3.7** Pure reducer test: `reduceAddAsset(state, asset)` returns a *new*
  object; original `state` is deep-equal to its pre-call snapshot.

**Persistence (with fake storage)**
- [ ] **TC3.8** Inject `fakeStorage`. `setState({...})`, await debounce → `fakeStorage`
  contains a JSON string round-tripping to the new state.
- [ ] **TC3.9** Pre-seed `fakeStorage`, init store → `getState()` reflects seeded data.
- [ ] **TC3.10** `fakeStorage` returns `"not json"` → store starts at default state,
  injected logger called with a parse-error message.

---

## Milestone C4 — Scenarios, drawdown, sale events (pure)

### Implementation

**Scenarios**
- [ ] **C4.1** `src/engine/scenarios.js: simulateCoastFire(state, opts)` —
  Standard step with all `yearlyContribution` zeroed.
- [ ] **C4.2** `findCoastFireAge(state)` — earliest age ≥ min pension `startingAge`
  where `passiveIncome + 4%·liquidInvestable ≥ inflatedYearlyExpenses`. Returns
  number or `null`.

**Drawdown (FIRE)**
- [ ] **C4.3** `src/engine/drawdown.js: sellLotsHIFO(lots, proceedsNeeded, cgt)` →
  `{ updatedLots, grossSold, netProceeds, taxPaid }`.
- [ ] **C4.4** `drawdownYear(assets, shortfall)` → proportional across stocks/bonds/
  crypto, then cash; returns `{ updatedAssets, success }`.
- [ ] **C4.5** `simulateFire(state, { startAge, horizonAge })` — Standard until
  `startAge`, then no contributions + `drawdownYear` each year. Sets `failedAtAge` on
  failure.
- [ ] **C4.6** `findFireAge(state)` — earliest age where `failedAtAge === null`, or
  `null` if never.

**Sale events**
- [ ] **C4.7** `src/engine/sale.js: computeSaleProceeds(asset, year)` per `plan.md`
  §2.4.
- [ ] **C4.8** `applySaleConversion(state, sourceAssetId, proceeds)` — merges into
  `targetAssetId` asset (new lot) OR creates a new asset from `inlineParams`.
- [ ] **C4.9** Wire sale triggering into `simulateStandard`/`simulateCoastFire`/
  `simulateFire` (year `N == saleYearsFromNow`).

**Stats**
- [ ] **C4.10** `src/engine/stats.js: computeStatsTable(state, { horizons:[0,5,10,20]
  })` returning rows per class + total + monthly/yearly inflated expenses.

**Public engine API**
- [ ] **C4.11** `src/engine/index.js` re-exports the **frozen** UI-facing API:
  `simulateStandard`, `simulateCoastFire`, `findCoastFireAge`, `simulateFire`,
  `findFireAge`, `computeNetWorth`, `computePassiveIncome`, `computeStatsTable`,
  `validateAsset`. UI imports only from here.

### Documentation (Milestone C4)
- [ ] **D4.1** `@formula` JSDoc on `simulateCoastFire`, `findCoastFireAge`,
  `sellLotsHIFO`, `drawdownYear`, `simulateFire`, `findFireAge`,
  `computeSaleProceeds`, `applySaleConversion`, `computeStatsTable`.
- [ ] **D4.2** `findCoastFireAge` JSDoc states the exact predicate:
  `passiveIncome(age) + 0.04 · liquidInvestable(age) ≥ inflatedYearlyExpenses(age)`,
  with definitions for `liquidInvestable` (stocks + bonds + crypto, *excluding cash*).
- [ ] **D4.3** `sellLotsHIFO` JSDoc states the lot-ordering rule (descending
  `costBasis`, ties broken by ascending `year`) and the per-lot tax formula
  `tax = max(0, value − costBasis) · cgt`.
- [ ] **D4.4** `drawdownYear` JSDoc states proportional allocation by current value
  across stocks/bonds/crypto, then cash fallback, plus the gross-up rule used to
  cover the per-lot CGT.
- [ ] **D4.5** `findFireAge` JSDoc documents the search procedure (linear scan from
  current age) and the **monotonicity assumption** (if FIRE works at X, it works at
  X+k for k≥0) that justifies returning the first hit.
- [ ] **D4.6** `computeSaleProceeds` JSDoc gives both formulas:
  - Real estate: `proceeds = value − feesPct·value − tax · max(0, value − originalValue) − mortgageBalance`
  - Private business: `proceeds = value − feesPct·value − tax · max(0, value − originalValue)`
- [ ] **D4.7** `applySaleConversion` JSDoc states: if `targetAssetId` is set, append a
  new lot `{value: proceeds, costBasis: proceeds, year: saleYear}` to the target's
  `lots` (target must be liquid and lot-bearing); else create a new asset from
  `inlineParams`, with the same lot semantics.
- [ ] **D4.8** Fill `webapp/docs/engine.md` sections: **Drawdown algorithm** (with a
  worked numeric example matching TC4.6 / TC4.11), **Coast FIRE check**,
  **FIRE check**, **Sale events**, **Stats table semantics**.
- [ ] **D4.9** `webapp/docs/engine.md` contains a **Public engine API** section
  listing the C4.11 exports, their signatures, and one-line descriptions. This is
  the contract the UI consumes.

### Tests (Milestone C4)

**Coast FIRE — `tests/unit/c4.coastfire.test.js`**
- [ ] **TC4.1** Stocks `100000 @ 7%` no contributions, age 30, expenses `2000/mo`,
  inflation 2%, pension `20000 @ startingAge 67`. Stock value at age 67 ≈
  `100000·1.07^37 ≈ 1207003` (±1).
- [ ] **TC4.2** Same setup → `findCoastFireAge` returns `67` (passive
  `20000 + 4%·1207003 = 68280` ≥ inflated expenses `≈50087`).
- [ ] **TC4.3** Reduce stocks to `50000` → returned age > 67 (or `null`); assert exact.
- [ ] **TC4.4** No pension, stocks `10000` → returns `null`.
- [ ] **TC4.5** `simulateCoastFire` with non-zero `yearlyContribution` produces output
  identical to running with contributions zeroed (deep-equal trajectories).

**Drawdown / FIRE — `tests/unit/c4.fire.test.js`**
- [ ] **TC4.6** `sellLotsHIFO`: lots `[{v:1000, cb:600}, {v:1000, cb:900}]`,
  `need=500`, `cgt=0.20` → consumes from cb=900 lot first; `taxPaid` reflects gain on
  that lot only.
- [ ] **TC4.7** `need == lot.value` exactly → only that lot consumed.
- [ ] **TC4.8** `need > total` → all consumed, `netProceeds < need` (returned actual).
- [ ] **TC4.9** `cgt=0` → `taxPaid=0`, `netProceeds=grossSold`.
- [ ] **TC4.10** Untouched lots preserve `costBasis` and `year`.
- [ ] **TC4.11** `drawdownYear`: stocks `100000`, bonds `100000`, crypto `0`,
  cash `10000`, shortfall `8000` → `4000` from stocks, `4000` from bonds, cash
  unchanged.
- [ ] **TC4.12** Shortfall exceeds liquid + cash → `success=false`.
- [ ] **TC4.13** Cash-only `5000`, shortfall `3000` → cash drained by `3000`,
  `success=true`.
- [ ] **TC4.14** `simulateFire` with `5M @ 7%` stocks, expenses `3000/mo`,
  `startAge=50` → `failedAtAge === null`.
- [ ] **TC4.15** `simulateFire` with insufficient assets → `failedAtAge` defined and
  ≤ 100.
- [ ] **TC4.16** `simulateFire` years ≥ `startAge` add no new contribution lots.
- [ ] **TC4.17** `findFireAge` (success case) returns earliest valid age.
- [ ] **TC4.18** `findFireAge` (failure case) returns `null`.
- [ ] **TC4.19** Monotonicity: if FIRE works at X, it works at X+1, X+5, X+10
  (sample 3 ages).

**Sale events — `tests/unit/c4.sale.test.js`**
- [ ] **TC4.20** RE `value=300000`, original `300000`, `saleYearsFromNow=5`,
  `saleFeesPct=0.05`, `saleCGT=0.20`, `appreciationRate=0.03`, `mortgageBalance=0`,
  conversion to existing stocks. Expected:
  - `value@5 ≈ 347782.18`, `fees ≈ 17389.11`, `gain ≈ 47782.18`, `tax ≈ 9556.44`,
    `proceeds ≈ 320836.63`.
  - Target stocks gains a new lot with `value === costBasis ≈ 320836.63`, `year=5`.
- [ ] **TC4.21** Same with `targetAssetId=null` + `inlineParams` for crypto → new
  crypto asset with one lot of `value === costBasis ≈ 320836.63`.
- [ ] **TC4.22** Mortgage `50000` → proceeds reduced by `50000`; assert exact number.
- [ ] **TC4.23** PB `value=200000 @ 0.05`, `saleYearsFromNow=10`, fees 2%, CGT 26% →
  exact `value@10`, fees, gain, tax, proceeds per formula.
- [ ] **TC4.24** `saleYearsFromNow=null` → asset persists across full simulation;
  trajectory deep-equal to running with sale fields stripped.
- [ ] **TC4.25** Same RE with sale at year 5 → year-5 net worth in
  `simulateStandard`, `simulateCoastFire`, `simulateFire(startAge >= age+5)` are equal
  (sale logic shared).

**Stats — `tests/unit/c4.stats.test.js`**
- [ ] **TC4.26** State: stocks `100000 @ 7%`, expenses `2000/mo`, inflation 2%,
  age 30, horizons `[0,5,10,20]` → stocks row `[100000, 140255.17, 196715.14,
  386968.45]` (±0.01).
- [ ] **TC4.27** Monthly expenses row `[2000, 2208.16, 2437.99, 2971.89]`; yearly
  row = monthly × 12.
- [ ] **TC4.28** Total row = column-wise sum of class rows.

---

## Milestone C5 — Architectural & API tests

### Implementation
- [ ] **C5.1** `tests/arch/forbidden-imports.test.js`: fetches each file under
  `src/{model,engine,data}/**` and `src/state.js`, asserts no occurrence of
  `\bdocument\b`, `\bwindow\b`, `\blocalStorage\b` (state.js exempt for
  `localStorage`, but only in the default-adapter section).
- [ ] **C5.2** `tests/arch/no-ui-imports.test.js`: same files contain no
  `from ['"].*\\/ui\\/`.
- [ ] **C5.3** `tests/arch/engine-public-api.test.js`: imports `src/engine/index.js`
  and asserts the exact named exports listed in C4.11. Adding/removing one fails the
  test (so the API stays frozen).
- [ ] **C5.4** `tests/arch/purity.test.js`: for each `src/engine/steps/*.js` step
  function, snapshot input via deep clone, call the function, deep-equal input vs
  snapshot.

### Tests (Milestone C5)
- [ ] **TC5.1** All four arch tests pass.
- [ ] **TC5.2** Negative control: temporarily insert `document` into a model file →
  C5.1 fails. Remove and confirm green.

**Gate:** UI work (Part B) does not begin until all C1–C6 tests pass.

---

## Milestone C6 — Documentation tests

### Implementation
- [ ] **C6.1** `tests/docs/jsdoc-coverage.test.js`: fetches each file under
  `src/{model,engine,data}/**` and `src/state.js`, scans for `export` declarations
  and asserts each is preceded by a JSDoc block (`/** ... */`).
- [ ] **C6.2** `tests/docs/jsdoc-formula.test.js`: asserts that every function in
  `src/engine/steps/*.js`, plus `simulateStandard`, `simulateCoastFire`,
  `findCoastFireAge`, `sellLotsHIFO`, `drawdownYear`, `simulateFire`,
  `findFireAge`, `computeSaleProceeds`, `applySaleConversion`, `computePassiveIncome`,
  `computeNetWorth`, `inflateExpenses`, `computeStatsTable` has a JSDoc block
  containing an `@formula` tag.
- [ ] **C6.3** `tests/docs/jsdoc-pure.test.js`: every exported function in
  `src/engine/**` has an `@pure` tag in its JSDoc.
- [ ] **C6.4** `tests/docs/engine-md.test.js`: fetches `webapp/docs/engine.md` and
  asserts the presence of all required section headings (exact strings):
  - `## Time stepping`
  - `## Inflation`
  - `## Per-asset-class yearly updates`
  - `### Stocks`, `### Bonds`, `### Crypto`, `### Cash`, `### Real estate`,
    `### Private business`, `### Pension`, `### Personal debt`
  - `## Passive income`
  - `## Net worth`
  - `## Drawdown algorithm`
  - `## Coast FIRE check`
  - `## FIRE check`
  - `## Sale events`
  - `## Stats table semantics`
  - `## State & persistence`
  - `## Public engine API`
- [ ] **C6.5** `tests/docs/api-doc-sync.test.js`: cross-checks that every name
  exported by `src/engine/index.js` (per C4.11) appears in `engine.md`'s **Public
  engine API** section, and vice versa. Drift fails the test.
- [ ] **C6.6** `tests/docs/cross-refs.test.js`: every step file under
  `src/engine/steps/` includes a link or anchor reference to `engine.md`; every
  `### <Class>` subsection in `engine.md` mentions the corresponding step function
  name.

### Tests (Milestone C6)
- [ ] **TC6.1** All six docs tests pass.
- [ ] **TC6.2** Negative control: temporarily strip the JSDoc from one engine
  function → C6.1 (and C6.2/C6.3 if applicable) fail. Restore and confirm green.
- [ ] **TC6.3** Negative control: rename one export in `src/engine/index.js` without
  updating `engine.md` → C6.5 fails.

---

# PART B — UI LAYER (built on top of frozen engine)

## Milestone U1 — UI scaffolding & user info / asset forms

### Implementation
- [ ] **U1.1** `index.html` skeleton: header, `#user-info`, `#net-worth`, `#assets`,
  `#chart`, `#stats`, modal container. Loads `styles.css` and `app.js` (module).
- [ ] **U1.2** `styles.css` Tron/neon tokens (CSS variables) per `plan.md` §4.0.1.
- [ ] **U1.3** Add Google Fonts (Orbitron/Rajdhani + Inter), Lucide, Chart.js via CDN.
- [ ] **U1.4** `app.js` entry: import state + engine public API; bootstrap empty UI.
- [ ] **U1.5** `src/ui/userInfoForm.js` with two-way state binding and country-change
  notice.
- [ ] **U1.6** `src/ui/assetPicker.js` "+" button → 8-class picker.
- [ ] **U1.7** `src/ui/assetForms.js` per-class modal forms with country-default
  pre-fill. Uses `validateAsset` from engine.
- [ ] **U1.8** `src/ui/assetCard.js` collapsed/expanded with live edit.
- [ ] **U1.9** `src/ui/assetList.js` cards grid.
- [ ] **U1.10** Live net worth header (uses `computeNetWorth`).
- [ ] **U1.11** Tron/neon polish.

### Tests (Milestone U1) — manual UI checklist
- [ ] **TU1.1** Empty state → User Info form, "+" button, empty grid, net worth `0`.
- [ ] **TU1.2** Set Age `35` → `getState().userInfo.age === 35`.
- [ ] **TU1.3** Switch country to Germany → notice appears AND every existing asset's
  CGT shows German default.
- [ ] **TU1.4** Click "+" → 8 class buttons; left-border colors match per-class CSS
  variables.
- [ ] **TU1.5** Stocks form pre-fills CGT from current country; submit valid form →
  modal closes, card appears, net worth = lot value.
- [ ] **TU1.6** Click card → expands; rename `name` → header updates live AND state
  reflects.
- [ ] **TU1.7** Add personal debt `10000` → net worth − `10000`.
- [ ] **TU1.8** Add RE `value=300000`, mortgage `100000` → net worth + `200000`.
- [ ] **TU1.9** Delete card → removed from grid + state; net worth updates.
- [ ] **TU1.10** Reload → state restored.
- [ ] **TU1.11** Submit empty `name` → inline error, modal stays open.
- [ ] **TU1.12** Hover card → glow intensifies (visual).

---

## Milestone U2 — Chart (Standard, Coast FIRE, FIRE)

### Implementation
- [ ] **U2.1** `src/ui/chart.js`: render Chart.js line chart from
  `simulateStandard` result (X = age, Y = net worth), Tron styling.
- [ ] **U2.2** Subscribe to state; on change, recompute Standard and update chart.
- [ ] **U2.3** Add Coast FIRE line via `simulateCoastFire`; render Coast FIRE age
  marker from `findCoastFireAge` (or "Not achievable by age 100" annotation).
- [ ] **U2.4** Add FIRE line via `simulateFire(state, { startAge: findFireAge(state)
  })` and FIRE age marker (or "Not achievable").

### Tests (Milestone U2) — manual + tiny unit
- [ ] **TU2.1** Stocks `10000 @ 7%`, age 30 → Standard line rises from `10000` to
  `≈54274` at age 50 (visual ±1%).
- [ ] **TU2.2** Edit `avgReturnRate` → chart updates, no reload.
- [ ] **TU2.3** Coast FIRE setup from TC4.2 → second line visible + marker at age 67.
- [ ] **TU2.4** Setup from TC4.4 (stocks `10000`, no pension) → "Not achievable by age
  100" text near chart.
- [ ] **TU2.5** FIRE setup from TC4.14 → third line visible + FIRE age marker.
- [ ] **TU2.6** Spy adapter test: replace engine API with fakes returning canned data,
  verify chart receives exactly that data (proves UI is engine-agnostic).

---

## Milestone U3 — Sale events UI & stats table

### Implementation
- [ ] **U3.1** Extend RE and PB forms with `saleYearsFromNow`, `saleFeesPct`,
  `saleCapitalGainsTaxRate`, and `saleConversion` sub-form (target existing OR define
  inline).
- [ ] **U3.2** Card affordance: "Sale @ year N" badge when configured; opens sale
  edit panel.
- [ ] **U3.3** `src/ui/statsTable.js` rendering `computeStatsTable` rows for horizons
  `[0,5,10,20]` (and `+30` if age ≤ 70).

### Tests (Milestone U3) — manual
- [ ] **TU3.1** RE card: configure sale year 5 + conversion to existing stocks. Save →
  badge appears; chart updates with a kink at age = current + 5.
- [ ] **TU3.2** Inline-params sale: configure new crypto target with the parameters
  from TC4.21 → after save, year-5 chart point matches expected proceeds.
- [ ] **TU3.3** Stats table rows match the values from TC4.26 / TC4.27 within ±0.01.
- [ ] **TU3.4** Stats updates live on input change.

---

## Milestone U4 — Polish, import/export, accessibility

### Implementation
- [ ] **U4.1** `src/ui/importExport.js`: JSON export (download) + import (file picker
  with validation via `validateAsset` for each asset).
- [ ] **U4.2** Responsive layout (≤ 768px stacks; asset grid 1 col; chart resizes).
- [ ] **U4.3** Form validation: positive-numeric where required, tax rates in `[0,1]`,
  required-text not empty; inline neon-red errors.
- [ ] **U4.4** Optional ambient animated grid background.
- [ ] **U4.5** "About / how this works" panel listing `plan.md` §7 items.
- [ ] **U4.6** Keyboard accessibility (focus order, Esc to close modals, Enter to
  expand cards).

### Tests (Milestone U4) — manual
- [ ] **TU4.1** Export → JSON file downloaded; contents include `userInfo` + `assets`.
- [ ] **TU4.2** Import the just-exported file → state deep-equal to pre-export.
- [ ] **TU4.3** Import invalid JSON → inline error, state unchanged.
- [ ] **TU4.4** Import with unknown asset class → rejected with specific class-name
  error, state unchanged.
- [ ] **TU4.5** Resize to 375px wide → sections stack, no horizontal scroll.
- [ ] **TU4.6** Negative numeric in any positive-only field → inline error, submit
  blocked.
- [ ] **TU4.7** Tax rate `1.5` rejected; `0` and `0.5` accepted.
- [ ] **TU4.8** Required text empty → submit blocked.
- [ ] **TU4.9** Tab order traverses User Info → "+" → cards in DOM order.
- [ ] **TU4.10** Esc closes any open modal; Enter on a focused card expands it.
- [ ] **TU4.11** "About" panel lists each model assumption from `plan.md` §7
  (verify count and titles).
- [ ] **TU4.12** End-to-end QA: add one of every asset class, verify chart (3 lines +
  markers), stats table populated, export+reimport reproduces state.

---

## Cross-cutting / non-blocking

- [ ] **X.1** Populate real EU tax-rate defaults; spot-check DE/IT/FR against an
  external reference. Test: TC1.15/TC1.16 still pass.
- [ ] **X.2** Engine performance smoke: `simulateStandard` over 70 years with 20
  assets completes in < 50ms (loose bound, just to catch accidental O(n²) regressions).
