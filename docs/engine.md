# Engine Reference — Financial Independence Planner

This document is the human-readable specification of the calculation layer.
Every formula here cites the function in `src/` that implements it; every
`@formula` JSDoc block in source cites a section here.

> **Status:** filled progressively per milestone. Sections marked _(C2)_, _(C3)_,
> _(C4)_ will be added in the corresponding milestones.

---

## Data model

The state held by the application is:

```js
{
  userInfo: {
    age: number,            // integer years
    country: string,        // ISO code, e.g. "DE"
    monthlyExpenses: number,// today's currency, ≥ 0
    inflationRate: number,  // decimal, e.g. 0.02 = 2 %
  },
  assets: Asset[],
}
```

Eight asset classes are supported. Their factories live in
[`src/model/assets.js`](../src/model/assets.js).

> **Rates convention.** All numeric *rates* in the **calculation layer** are stored
> as **decimals** (`0.07` = 7 %). The **UI layer** is the only place where rates
> are shown or accepted as percentages (`7 %`, not `0.07`). Conversion happens at
> the UI/engine boundary in [`src/ui/format.js`](../src/ui/format.js) via
> `formatPercent` (decimal → "X %") and `parsePercent` ("X %" → decimal).
> Engine code never multiplies/divides by 100.

| Class             | Liquid? | Lot-bearing? | Net-worth contribution                |
|-------------------|---------|--------------|---------------------------------------|
| `stocks`          | yes     | yes          | `Σ lot.value`                         |
| `bonds`           | yes     | yes          | `Σ lot.value`                         |
| `crypto`          | yes     | yes          | `Σ lot.value`                         |
| `cash`            | yes     | no           | `value`                               |
| `realEstate`      | no      | no           | `value − mortgageBalance`             |
| `privateBusiness` | no      | no           | `value`                               |
| `pension`         | n/a     | no           | `0` (income-only)                     |
| `personalDebt`    | n/a     | no           | `−balance`                            |

A **lot** (`{ value, costBasis, year }`) records one purchase; new
contributions append a new lot at the current price (cost basis = value).
Lots are required for HIFO drawdown later (see _Drawdown algorithm_, C4).

Country tax defaults live in [`src/data/countries.js`](../src/data/countries.js)
and are applied to every asset on country selection.

## Net worth definition

Implemented by `computeNetWorth(assets)` (C2 — see `src/engine/netWorth.js`).

```
netWorth = Σ assetNetValue(a) for a in assets
```

where `assetNetValue` is the per-class formula in the table above. Equivalently:

```
netWorth = (stocks + bonds + crypto + cash
           + realEstateValue + privateBusinessValue)
           − (debtBalances + mortgageBalances)
```

## Time stepping

Implemented by [`simulateStandard`](../src/engine/simulate.js).

The simulation is **discrete and yearly**, from `userInfo.age` up to a
configurable horizon (default: 100). The output is an array
`[{ age, year, netWorth, byClass, passiveIncome, expenses, debtPayments }, …]`
of length `horizonAge − age + 1`. Index 0 is the starting snapshot (no growth
applied yet); index *y* is the end of year *y*.

Within each year *y* (1 ≤ y ≤ horizonAge − startAge):

1. For each asset *a*, call `stepClass(a, ctx)` where `ctx = { year: y,
   currentAge: startAge + y, applyContribution }`.
2. Sum `passiveIncome` across all assets → `totalPassiveIncome_y`.
3. Sum `yearlyPayments` across all `personalDebt` assets → `totalDebtPayments_y`.
4. Compute `monthlyExpenses_y = monthlyExpenses_0 · (1 + inflationRate)^y`,
   `yearlyExpenses_y = monthlyExpenses_y · 12` (see [Inflation](#inflation)).
5. Compute `netWorth_y = computeNetWorth(updatedAssets)`
   (see [Net worth](#net-worth-definition)).

Standard scenario passes `applyContribution = true`; Coast FIRE will pass
`false` (C4).

## Inflation

Implemented by [`inflateExpenses`](../src/engine/inflation.js).

```
inflated = monthly · (1 + rate)^years
```

Used to grow the user's `monthlyExpenses` across the horizon. All other
class-specific growth rates (appreciation, dividend growth, pension
revaluation) are applied **inside** their step function — no global inflation
multiplier is applied to asset values.

## Per-asset-class yearly updates

Each per-class step function is **pure** (`@pure` JSDoc tag) and returns
`{ asset, passiveIncome }` (plus `yearlyPayments` for `personalDebt`). The
step function is called **once per year** by `simulateStandard`.

### Stocks

Implemented by [`stepStocks`](../src/engine/steps/stocks.js).

Variables: `r = avgReturnRate`, `c = yearlyContribution` (decimal, currency).

```
For each existing lot l:
  l.value'     = l.value · (1 + r)
  l.costBasis' = l.costBasis      // unchanged
  l.year'      = l.year

If applyContribution and c > 0:
  newLot = { value: c, costBasis: c, year: y }

passiveIncome = 0   // dividends not modelled separately in v1
```

**Worked example** (TC2.6): 10 years at 7 % from 10 000, no contribution →
`10 000 · 1.07¹⁰ ≈ 19 671.51`.

### Bonds

Implemented by [`stepBonds`](../src/engine/steps/bonds.js).

Variables: `y = yieldRate`, `t = yieldTaxRate`, `c = yearlyContribution`.

```
totalValue     = Σ lot.value          // before adding new contribution
passiveIncome  = totalValue · y · (1 − t)

For each lot: lot' = lot               // principal flat in v1

If applyContribution and c > 0:
  newLot = { value: c, costBasis: c, year: y }
```

**Worked example** (TC2.8): 100 000 at 4 % yield, 20 % tax →
`100 000 · 0.04 · 0.80 = 3 200`.

### Crypto

Mathematically identical to [Stocks](#stocks); see
[`stepCrypto`](../src/engine/steps/crypto.js).

### Cash

Implemented by [`stepCash`](../src/engine/steps/cash.js).

```
value' = value
passiveIncome = 0
```

Cash earns no interest in v1 (deliberately conservative).

### Real estate

Implemented by [`stepRealEstate`](../src/engine/steps/realEstate.js).

Two kinds, distinguished by `propertyKind`:

- `'investment'` — rental property. The user supplies a yearly `cashFlow`
  that already nets rent against costs, interest, and tax. It becomes
  passive income (can be negative).
- `'residence'` — primary home. No cash flow; the per-year `yearlyCosts`
  is reported as an extra expense added to the year's expenses.

Variables: `a = appreciationRate`, `m = mortgageBalance`,
`r = mortgageRepaymentRate`, `CF = cashFlow`, `K = yearlyCosts`.

```
value'           = value · (1 + a)
mortgageBalance' = max(0, m · (1 − r))         // no interest accrual

if propertyKind === 'investment':
  passiveIncome  = CF                          // user-supplied; can be negative
  extraExpense   = 0
else if propertyKind === 'residence':
  passiveIncome  = 0
  extraExpense   = K                           // added to yearly expenses
```

Net worth contribution (both kinds): `value − mortgageBalance`.

**Worked example** (investment, TC2.11): value 300 000, appreciation 3 %,
cashFlow 12 000 → `value' = 309 000`, `passiveIncome = 12 000`.

**Worked example** (residence, TC2.13b): value 400 000, appreciation 2 %,
mortgage 250 000 with 4 % yearly debt reduction, yearlyCosts 4 000 →
`value' = 408 000`, `mortgageBalance' = 240 000`, `passiveIncome = 0`,
`extraExpense = 4 000`.

### Private business

Implemented by [`stepPrivateBusiness`](../src/engine/steps/privateBusiness.js).

Variables: `g = valueGrowthRate`, `D = yearlyDividend`, `gd = dividendGrowthRate`,
`τ = dividendTaxRate`.

```
passiveIncome     = D · (1 − τ)            // current-year dividend, after tax
value'            = value · (1 + g)
yearlyDividend'   = D · (1 + gd)           // grows after payout
```

**Worked example** (TC2.14): value 200 000 at 5 %, dividend 10 000 at 3 %
growth, 26 % tax → year 1 income `7 400`, value `210 000`, next dividend
`10 300`.

### Pension

Implemented by [`stepPension`](../src/engine/steps/pension.js).

Variables: `A = yearlyAmount`, `r = revaluationRate`, `s = startingAge`,
`age = currentAge`.

```
if age < s:   passiveIncome = 0
else:         passiveIncome = A · (1 + r)^(age − s)
asset' = asset
```

Pension contributes nothing to net worth (it is income-only — no balance to
sell). Pension is treated as **net of tax** in v1; users lower `yearlyAmount`
to reflect their take-home rate.

### Personal debt

Implemented by [`stepPersonalDebt`](../src/engine/steps/personalDebt.js).

Variables: `bal = balance`, `r = interestRate`, `P = monthlyPayment`,
`m_r = r/12`.

```
For m = 0..11:
  grown = bal · (1 + m_r)
  if grown ≤ P:
    actualPayment_m = grown
    bal = 0
    stop loop
  else:
    actualPayment_m = P
    bal = grown − P

balance'      = bal
yearlyPayments = Σ actualPayment_m
passiveIncome = 0
```

`yearlyPayments` is reported separately (not as passive income — it's a
*drag* on cash flow). Once the balance reaches 0, no further payments accrue.

**Worked example** (TC2.17): 10 000 at 12 %, 500/mo → balance ≈ 4 734.26
after 12 monthly steps at 1 % monthly compounding.

## Passive income

Implemented by
[`computePassiveIncome`](../src/engine/passiveIncome.js).

```
byClass[c] = Σ stepC(a, ctx).passiveIncome   for each asset a of class c
total      = Σ byClass[c]
```

This is a **read-only** convenience: the full simulation calls each step
function directly so it gets the updated asset state too.

## State & persistence

Implemented by [`src/state.js`](../src/state.js).

The store holds:

```js
{
  userInfo: { age, country, monthlyExpenses, inflationRate },
  assets: Asset[],
}
```

### Pure reducers

All mutations go through pure reducers (no side effects, return a new state):

| Reducer                          | Effect                                                       |
|----------------------------------|--------------------------------------------------------------|
| `reduceAddAsset(state, asset)`   | Append asset                                                 |
| `reduceUpdateAsset(state, id, p)`| Merge `p` into asset matching `id` (no-op if not found)     |
| `reduceRemoveAsset(state, id)`   | Drop asset matching `id`                                     |
| `reduceApplyCountryDefaults(s,c)`| Overwrite tax fields on every asset with the country defaults; preserve all other fields |

The store wraps each reducer in an imperative method (`addAsset`,
`updateAsset`, `removeAsset`, `applyCountryDefaults`) that:
1. Computes the new state via the reducer.
2. Schedules a debounced save to storage.
3. Notifies all subscribers.

### Storage adapter contract

Persistence uses an injectable adapter:

```ts
{
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
```

`createStorageAdapter({ getItem, setItem })` wraps any compatible pair.
`defaultStorageAdapter()` wraps `localStorage` (and is the *only* place in the
calculation layer that touches `localStorage`).

Tests inject a fake (in-memory) adapter — see `c3.state.test.js`.

### Storage key & debounce

- **Key:** `"fire-planner-state-v1"` (constant `STORAGE_KEY`).
- **Debounce:** `200 ms` default (`SAVE_DEBOUNCE_MS`); overridable via
  `createStore({ debounceMs })`. Multiple rapid mutations coalesce into a
  single save.
- **Synchronous flush:** `store.flush()` writes any pending save immediately
  (used by tests).

### Resilient load

On startup the store reads `STORAGE_KEY`:
- `null`            → fresh `defaultState()`.
- valid JSON of the right shape → that state.
- invalid JSON or wrong shape   → `defaultState()` + a call to the injected
  logger (no `console.error` from the calculation layer).

## Drawdown algorithm

Implemented by [`sellLotsHIFO` and `drawdownYear`](../src/engine/drawdown.js).

### `sellLotsHIFO(lots, proceedsNeeded, cgt)`

Sells from a single lot-bearing asset to net `proceedsNeeded` cash.
Lots are processed in **HIFO order** (highest cost basis first; ties broken by
ascending year for determinism). For each lot:

```
gainRatio   = max(0, (lot.value − lot.costBasis) / lot.value)
effectiveTax = gainRatio · cgt
netRatio     = 1 − effectiveTax
remainingNet = proceedsNeeded − cumulativeNetProceeds
valueToSell  = min(lot.value, remainingNet / netRatio)   // gross-up

gainSold     = valueToSell · gainRatio
taxOnLot     = gainSold · cgt
netFromLot   = valueToSell − taxOnLot
```

If a lot is fully consumed it is removed; otherwise the remaining slice keeps
its `costBasis · (remainingValue/originalValue)` proportionally.

**Worked example** (TC4.6): Lots `[{v:1000, cb:600}, {v:1000, cb:900}]`,
need 500 net at 20 % CGT:
1. HIFO picks the cb=900 lot first.
2. `gainRatio = 100/1000 = 0.10`; `effectiveTax = 0.02`; `netRatio = 0.98`.
3. `valueToSell = 500/0.98 ≈ 510.20`. Tax `= 510.20·0.10·0.20 ≈ 10.20`.
4. Net `= 510.20 − 10.20 = 500.00`. The cb=600 lot is untouched.

### `drawdownYear(assets, shortfall)`

Covers a yearly cash shortfall:

1. **Liquid investable** = `stocks + bonds + crypto` (excluding cash). Allocate
   `shortfall` proportionally to each class's share.
2. Within each class, allocate proportionally across that class's assets.
3. For each asset, call `sellLotsHIFO(asset.lots, allocation, asset.capitalGainsTaxRate)`.
4. If `drawn < shortfall`, drain `cash` assets in order until covered.
5. `success ⇔ remainingShortfall ≤ ε`. If `success === false`, the FIRE
   simulation marks the year as `failedAtAge` and stops.

## Coast FIRE check

Implemented by [`simulateCoastFire` and `findCoastFireAge`](../src/engine/scenarios.js).

### `simulateCoastFire(state, { horizonAge, coastAge })`

Piecewise simulation: contribute as in Standard while `currentAge ≤ coastAge`,
then stop contributing afterward. Equivalent to Standard when
`coastAge ≥ horizonAge`; equivalent to "stop now" when `coastAge ≤ currentAge`
(the default).

### Earliest-feasible-age search

**Coast FIRE age** = the earliest age **X** at which the user can stop
contributing and still meet the 4% rule **at retirement**.

```
retirementAge R precedence (first match wins):
  1. opts.retirementAge                  — explicit per-call override
  2. state.userInfo.retirementAge        — user setting from the form
  3. min(pension.startingAge)            — auto-detected from pensions
  4. 67                                  — default

For candidate stop-age X in [currentAge, R]:
  Run simulateCoastFire(state, { coastAge: X })
  At retirement age R:
    netWorth(R; X)             = stocks + bonds + crypto + cash + realEstate + privateBusiness
                                 (pension contributes 0; personal debt is a liability)
    passiveIncome(R; X)        = bond yield + RE net rent + PB dividend
                                 + pension (if R ≥ startingAge)
    inflatedYearlyExpenses(R)  = monthlyExpenses · 12 · (1 + inflationRate)^(R − startAge)

    feasible(X) ⇔ 0.04 · netWorth(R; X) ≥ inflatedYearlyExpenses(R) − passiveIncome(R; X)

Return the smallest feasible X, or null if even X = R isn't enough.
```

This is monotone in X: if stopping at X works, stopping later than X also
works (more accumulation, same retirement target).

The first feasible age is returned; otherwise `null`.

## FIRE check

Implemented by [`simulateFire` and `findFireAge`](../src/engine/fire.js).

`simulateFire(state, { startAge, horizonAge })`:

```
For y = 1 .. (horizonAge − age):
  inDecumulation = (age + y ≥ startAge)
  ctx = { year:y, currentAge: age+y, applyContribution: !inDecumulation }
  step each asset; aggregate passiveIncome, debtPayments
  trigger sales whose saleYearsFromNow == y
  expenses = monthlyExpenses · 12 · (1 + inflationRate)^y

  if inDecumulation:
    shortfall = expenses + debtPayments − passiveIncome
    if shortfall > 0:
      (assets', drawn, success) = drawdownYear(assets, shortfall)
      if !success → failedAtAge = age+y; break
```

### `findFireAge`

Linear scan from `currentAge` to `horizonAge`; returns the first `A` with
`failedAtAge === null`. Relies on the **monotonicity assumption**: if FIRE
succeeds at age X, it succeeds at X + k for all k ≥ 0 (more accumulation,
shorter decumulation). This holds for typical cases.

## Sale events

Implemented by [`computeSaleProceeds` and `applySaleConversion`](../src/engine/sale.js).

### `computeSaleProceeds(asset, year)`

```
fees = saleFeesPct · value
gain = max(0, value − originalValue)
tax  = saleCapitalGainsTaxRate · gain

real estate:        proceeds = value − fees − tax − mortgageBalance
private business:   proceeds = value − fees − tax
```

`originalValue` is captured at asset creation time. Capital losses do **not**
generate a tax credit (clamped at 0).

### `applySaleConversion(assets, sourceAssetId, proceeds, saleYear)`

The source asset's `saleConversion` field controls where proceeds go:

- `targetAssetId` set → append `{ value: proceeds, costBasis: proceeds, year: saleYear }`
  to the target's `lots` (target must be lot-bearing: stocks/bonds/crypto).
- `inlineParams` set → create a brand-new asset of `inlineParams.class`,
  seeded with the proceeds (a single lot for liquid classes; `value = proceeds`
  for cash).
- Neither set (`saleConversion === null`) → proceeds become a new **cash**
  asset. Value is never lost; the user can re-allocate it later.

The source asset is removed in all cases.

### Sale triggering

The simulators (`simulateStandard`, `simulateCoastFire`, `simulateFire`) call
`applyYearSales(assets, year)` after the per-class step, which inspects every
real-estate / private-business asset and triggers sales whose
`saleYearsFromNow === year`.

## Stats table semantics

Implemented by [`computeStatsTable`](../src/engine/stats.js).

Runs `simulateStandard(state, { horizonAge: maxHorizon + age })` once and
extracts year-`h` snapshots for every `h` in `horizons`.

```
rows[c][i]                = trajectory[h].byClass[c]   for class c, horizon h
rows.total[i]             = trajectory[h].netWorth
rows.monthlyExpenses[i]   = monthlyExpenses · (1 + inflationRate)^h
rows.yearlyExpenses[i]    = monthlyExpenses[i] · 12
```

Default horizons: `[0, 5, 10, 20]`. The `total` row equals the column-wise sum
of all eight class rows by construction.

## Public engine API

The UI consumes only [`src/engine/index.js`](../src/engine/index.js). The
exports are **frozen**; adding/removing an export is a breaking change and
must update the architectural test in `tests/arch/engine-public-api.test.js`.

| Export                  | Source file        | Purpose                                              |
|-------------------------|--------------------|------------------------------------------------------|
| `simulateStandard`      | `simulate.js`      | Standard scenario trajectory                         |
| `simulateCoastFire`     | `scenarios.js`     | Coast FIRE trajectory                                |
| `findCoastFireAge`      | `scenarios.js`     | Earliest Coast FIRE age (or null)                    |
| `simulateFire`          | `fire.js`          | FIRE trajectory + `failedAtAge`                      |
| `findFireAge`           | `fire.js`          | Earliest FIRE age (or null)                          |
| `computeNetWorth`       | `netWorth.js`      | Sum of `assetNetValue` across assets                 |
| `computeNetWorthByClass`| `netWorth.js`      | Per-class breakdown (used by chart)                  |
| `computePassiveIncome`  | `passiveIncome.js` | `{ total, byClass }` for a given year                |
| `computeStatsTable`     | `stats.js`         | Time-horizon snapshot table                          |
| `validateAsset`         | `model/assets.js`  | Asset validation (re-exported for UI forms)          |

### Architectural enforcement

Four architectural tests in `webapp/tests/arch/` keep the calculation/UI
separation honest:

| Test file                      | What it enforces                                                    |
|--------------------------------|---------------------------------------------------------------------|
| `forbidden-imports.test.js`    | Calculation layer references no `document`, no `window`, and `localStorage` only inside `src/state.js` |
| `no-ui-imports.test.js`        | Calculation layer imports nothing from `src/ui/`                    |
| `engine-public-api.test.js`    | `src/engine/index.js` exports exactly the 10 names listed above     |
| `purity.test.js`               | Every `src/engine/steps/*` function leaves its input deeply unchanged |

### Documentation enforcement

Six documentation tests in `webapp/tests/docs/` keep the source and this
document in lock-step:

| Test file                  | What it enforces                                                                |
|----------------------------|---------------------------------------------------------------------------------|
| `jsdoc-coverage.test.js`   | Every named export in the calculation layer has a JSDoc block immediately above it |
| `jsdoc-formula.test.js`    | Every formula-bearing engine / step function has an `@formula` tag             |
| `jsdoc-pure.test.js`       | Every export in `src/engine/**` has a `@pure` tag                              |
| `engine-md.test.js`        | This file contains every required section heading                              |
| `api-doc-sync.test.js`     | "Public engine API" listing matches `src/engine/index.js` exports              |
| `cross-refs.test.js`       | Each step file references `engine.md`; each `### Class` subsection mentions the corresponding step-function name |
