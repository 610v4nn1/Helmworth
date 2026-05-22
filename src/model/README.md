# `src/model/` — Data Model

Plain-data factories, validators, and structural helpers for the planner's
state. Pure JavaScript — no DOM, no I/O.

This layer is consumed by:

- [`src/state.js`](../state.js) — for the default state and reducers.
- [`src/engine/`](../engine/) — for `assetNetValue` (net-worth formulas)
  and asset shape assumptions in step functions.
- [`src/ui/`](../ui/) — for form rendering and `validateAsset` from
  the engine's frozen public API.

## Files

| File           | Exports                                                                                                                                            | Purpose                                                                                  |
|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| `assets.js`    | `createLot`, `createStocks`, `createBonds`, `createCrypto`, `createCash`, `createRealEstate`, `createPrivateBusiness`, `createPension`, `createPersonalDebt`, `assetNetValue`, `liquidValue`, `isLiquid`, `validateAsset` | Factories + classifiers + validation for the eight asset classes.                        |
| `userInfo.js`  | `createUserInfo`, `validateUserInfo`                                                                                                               | User profile (age, country, monthly expenses, inflation rate).                           |
| `id.js`        | `newId`                                                                                                                                            | UUID v4 generator (uses `crypto.randomUUID` if available, else a fallback).              |

## Conventions

- **Rates are decimals** (`0.07` ≡ 7 %). Conversion to/from `%` happens only
  in the UI layer (`src/ui/format.js`).
- **`id`** is a UUID assigned by `newId()` at creation time and never reused.
- **`class`** is one of the literal strings:
  `"stocks" | "bonds" | "crypto" | "cash" | "realEstate" | "privateBusiness" | "pension" | "personalDebt"`.
- **Lots** (only on `stocks`/`bonds`/`crypto`) have shape
  `{ value: number, costBasis: number, year: number }`. New lots default
  `costBasis = value` and `year = 0`.
- **Capture-once fields**: `originalValue` on real-estate / private-business
  assets is set at creation time and *not* updated by the engine; it is the
  basis used by `computeSaleProceeds` (see engine §10.1).

## Asset shapes (summary)

The exact field set per class is:

| Class             | Required fields (besides `id`, `name`, `class`)                                                                                                                 |
|-------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `stocks`          | `lots`, `avgReturnRate`, `yearlyContribution`, `capitalGainsTaxRate`                                                                                            |
| `bonds`           | `lots`, `yieldRate`, `yearlyContribution`, `capitalGainsTaxRate`, `yieldTaxRate`                                                                                |
| `crypto`          | `lots`, `avgReturnRate`, `yearlyContribution`, `capitalGainsTaxRate`                                                                                            |
| `cash`            | `value`                                                                                                                                                          |
| `realEstate`      | `value`, `originalValue`, `propertyKind ∈ {investment, residence}`, `appreciationRate`, `mortgageBalance`, `mortgageRepaymentRate`, `cashFlow` (investment), `yearlyCosts` (residence), sale fields (`saleYearsFromNow`, `saleFeesPct`, `saleCapitalGainsTaxRate`, `saleConversion`) |
| `privateBusiness` | `value`, `originalValue`, `valueGrowthRate`, `yearlyDividend`, `dividendGrowthRate`, `dividendTaxRate`, sale fields                                            |
| `pension`         | `yearlyAmount`, `revaluationRate`, `startingAge`                                                                                                                 |
| `personalDebt`    | `balance`, `interestRate`, `monthlyPayment`                                                                                                                      |

For the **mathematical meaning** of each field see
[`src/engine/README.md`](../engine/README.md) §7.

## Validation

`validateAsset(asset)` throws `Error` on:

- unknown `class`
- negative numbers in fields that must be `≥ 0`
- rates outside `[0, 1]` where applicable
- malformed `lots` (non-array, or lots failing `createLot`)

`validateUserInfo(userInfo)` enforces:

- `age` is a non-negative finite integer
- `inflationRate ∈ [0, 1]`
- `monthlyExpenses ≥ 0`

Validators are used both at factory time (`createX(…)` calls them implicitly
through the same checks) and at re-hydration from `localStorage`.

## `assetNetValue(asset)` — used by the engine

Per-class net-worth contribution:

| Class             | `assetNetValue`                       |
|-------------------|---------------------------------------|
| `stocks`          | `Σ lot.value`                         |
| `bonds`           | `Σ lot.value`                         |
| `crypto`          | `Σ lot.value`                         |
| `cash`            | `value`                               |
| `realEstate`      | `value − mortgageBalance`             |
| `privateBusiness` | `value`                               |
| `pension`         | `0`                                   |
| `personalDebt`    | `−balance`                            |

`liquidValue(asset)` returns the same value for `stocks/bonds/crypto/cash`
and `0` for everything else. `isLiquid(asset)` is the boolean projection.
