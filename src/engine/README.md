# `src/engine/` — Calculation Engine

The **pure calculation core** of the planner. Every function here is
referentially transparent: same input → same output, no I/O, no `Date.now()`,
no DOM, no `localStorage`. The UI consumes it exclusively through the frozen
public API in [`index.js`](./index.js).

> If you change a formula in this directory, you **must** also update the
> corresponding section in this README and the worked examples in
> [`docs/engine.md`](../../docs/engine.md). The architectural test suite
> (`tests/arch/`) and doc tests (`tests/docs/`) enforce the link between code
> and prose.

---

## 1. Conventions

| Convention                | Rule                                                                                        |
|---------------------------|---------------------------------------------------------------------------------------------|
| **Rates**                 | Stored as **decimals** in the engine (`0.07` ≡ 7 %). Conversion to/from `%` happens in the UI layer only. |
| **Time**                  | Discrete, **yearly**. Year `0` is the starting snapshot; year `y ≥ 1` is the end of year *y*. |
| **Age**                   | Integer years. `currentAge = startAge + y`.                                                 |
| **Purity**                | All exports tagged `@pure`. They deep-clone their inputs and return new objects.            |
| **Currency**              | Single, unspecified currency. The engine never formats numbers.                             |
| **Capital losses**        | Do **not** create a tax credit; gains are clamped at 0 before applying CGT.                 |
| **Default horizon age**   | `100`. Override with `opts.horizonAge`.                                                     |
| **Default retirement age**| `65` (when no pension exists). Otherwise `min(pension.startingAge)`.                        |
| **Safe withdrawal rate**  | `0.04` (the "4 % rule"), exported as `SAFE_WITHDRAWAL_RATE`.                                |

### Notation used in this README

- `Σ X over A` — sum of `X` over the elements of set `A`.
- `x'` — the value of `x` after the yearly step.
- `(1 + r)^n` — `Math.pow(1 + r, n)`.
- `max(0, …)`, `min(a, b)` — element-wise min/max.
- `ε` — numerical tolerance, `1e-6` (drawdown) or `1e-9` (HIFO loop guard).

---

## 2. Module map

```
src/engine/
├── index.js          ← FROZEN public API (10 exports, see §11)
├── simulate.js       ← simulateStandard  (Standard scenario)
├── scenarios.js      ← simulateCoastFire, findCoastFireAge
├── fire.js           ← simulateFire, findFireAge
├── drawdown.js       ← sellLotsHIFO, drawdownYear
├── sale.js           ← computeSaleProceeds, applySaleConversion
├── netWorth.js       ← computeNetWorth, computeNetWorthByClass
├── passiveIncome.js  ← computePassiveIncome
├── inflation.js      ← inflateExpenses
├── stats.js          ← computeStatsTable
└── steps/            ← Per-asset-class yearly step functions (eight)
    ├── stocks.js
    ├── bonds.js
    ├── crypto.js
    ├── cash.js
    ├── realEstate.js
    ├── privateBusiness.js
    ├── pension.js
    └── personalDebt.js
```

---

## 3. Data model (engine-facing)

The engine consumes the state shape produced by `src/model/` and `src/state.js`:

```ts
state = {
  userInfo: {
    age:             number,   // integer years
    country:         string,   // ISO code, only used for defaults at form time
    monthlyExpenses: number,   // today's currency, ≥ 0
    inflationRate:   number,   // decimal, e.g. 0.02
  },
  assets: Asset[],
}
```

Eight asset classes, with the following **net-worth contribution**:

| Class             | Liquid? | Lots? | `assetNetValue(a)`                |
|-------------------|---------|-------|------------------------------------|
| `stocks`          | yes     | yes   | `Σ lot.value`                      |
| `bonds`           | yes     | yes   | `Σ lot.value`                      |
| `crypto`          | yes     | yes   | `Σ lot.value`                      |
| `cash`            | yes     | no    | `value`                            |
| `realEstate`      | no      | no    | `value − mortgageBalance`          |
| `privateBusiness` | no      | no    | `value`                            |
| `pension`         | n/a     | no    | `0`                                |
| `personalDebt`    | n/a     | no    | `−balance`                         |

A **lot** records one purchase: `{ value, costBasis, year }`. New
contributions append a new lot at the current price (cost basis = value).
Lots are required for HIFO drawdown.

---

## 4. Net worth

> Implemented in [`netWorth.js`](./netWorth.js).

$$
\text{netWorth}(A) = \sum_{a \in A} \text{assetNetValue}(a)
$$

Equivalently, expanding the per-class formulas:

$$
\text{netWorth} \;=\; \Big(\text{stocks} + \text{bonds} + \text{crypto} + \text{cash} + \text{REvalue} + \text{PBvalue}\Big) \;-\; \Big(\text{debtBalances} + \text{mortgageBalances}\Big)
$$

`computeNetWorthByClass(assets)` returns the same sum bucketed by class
(used by the chart and stats table).

---

## 5. Inflation

> Implemented in [`inflation.js`](./inflation.js).

$$
\text{inflated}(m, r, y) \;=\; m \cdot (1 + r)^{y}
$$

Used to grow `userInfo.monthlyExpenses` across the horizon. **No global
inflation multiplier is applied to asset values** — class-specific growth
rates (appreciation, dividend growth, pension revaluation) are applied
inside their step functions instead.

---

## 6. Time-stepping (Standard scenario)

> Implemented in [`simulate.js`](./simulate.js) — `simulateStandard`.

The simulation is **discrete and yearly** from `userInfo.age` to
`opts.horizonAge` (default 100). It returns an array

```ts
YearResult[] of length (horizonAge − startAge + 1)
YearResult = { age, year, netWorth, byClass,
               passiveIncome, expenses, debtPayments }
```

Index `0` is the starting snapshot (no growth applied). Index `y` is the end
of year `y`.

### Year 0 (snapshot)

$$
\begin{aligned}
\text{netWorth}_0 &= \sum_a \text{assetNetValue}(a) \\
\text{passiveIncome}_0 &= 0 \\
\text{expenses}_0 &= \text{monthlyExpenses}_0 \cdot 12 \\
\text{debtPayments}_0 &= 0
\end{aligned}
$$

### Year `y ∈ [1, horizonAge − startAge]`

Let `ctx = { year: y, currentAge: startAge + y, applyContribution }`.

For each asset `a`:

$$
(a',\, \pi_a,\, \kappa_a,\, \delta_a) \;=\; \mathrm{stepClass}(a,\, ctx)
$$

where `π` is `passiveIncome`, `κ` is `extraExpense` (only set by residence
real-estate; defaults to 0), and `δ` is `yearlyPayments` (only set by
`personalDebt`; defaults to 0).

After stepping, **trigger sales** scheduled for this year (see §10):

$$
A' \;=\; \mathrm{applyYearSales}(A',\, y)
$$

Aggregate:

$$
\begin{aligned}
\Pi_y     &= \sum_a \pi_a \\
D_y       &= \sum_{a:\, \text{class}=\text{personalDebt}} \delta_a \\
K_y       &= \sum_{a:\, \text{residence}} \kappa_a \\
m_y       &= \text{monthlyExpenses}_0 \cdot (1 + \text{inflationRate})^{y} \\
E_y       &= 12 \cdot m_y + K_y \\
W_y       &= \text{computeNetWorth}(A')
\end{aligned}
$$

The `applyContribution` flag is `true` for Standard, controlled per-year for
Coast FIRE (§8), and toggled at `startAge` for FIRE (§9).

---

## 7. Per-asset-class step functions

Each `stepX(asset, ctx)` is **pure** and returns
`{ asset, passiveIncome[, extraExpense, yearlyPayments] }`.

### 7.1 Stocks  ·  [`steps/stocks.js`](./steps/stocks.js)

Variables: `r = avgReturnRate`, `c = yearlyContribution`.

For every existing lot `ℓ`:

$$
\ell.\text{value}' = \ell.\text{value} \cdot (1 + r), \qquad
\ell.\text{costBasis}' = \ell.\text{costBasis}, \qquad
\ell.\text{year}' = \ell.\text{year}
$$

If `applyContribution ∧ c > 0`, append:

$$
\ell_{\text{new}} = \{\, \text{value}: c,\ \text{costBasis}: c,\ \text{year}: \text{ctx.year}\,\}
$$

$$
\pi = 0 \quad \text{(dividends not modelled separately in v1)}
$$

**Worked example.** 10 years at 7 % from 10 000 with no contribution:
$10{,}000 \cdot 1.07^{10} \approx 19{,}671.51$.

### 7.2 Bonds  ·  [`steps/bonds.js`](./steps/bonds.js)

Variables: `y = yieldRate`, `t = yieldTaxRate`, `c = yearlyContribution`.

Yield is computed on the **value before** the new contribution lot is added
(the new lot doesn't pay yield in its first year):

$$
V \;=\; \sum_{\ell} \ell.\text{value}, \qquad
\pi \;=\; V \cdot y \cdot (1 - t)
$$

Existing lots are kept flat (no appreciation in v1):

$$
\ell.\text{value}' = \ell.\text{value}, \quad
\ell.\text{costBasis}' = \ell.\text{costBasis}
$$

If `applyContribution ∧ c > 0`, append a new lot
`{ value: c, costBasis: c, year: ctx.year }`.

**Worked example.** 100 000 at 4 % yield with 20 % yield tax:
$100{,}000 \cdot 0.04 \cdot 0.80 = 3{,}200$.

### 7.3 Crypto  ·  [`steps/crypto.js`](./steps/crypto.js)

**Mathematically identical to Stocks** — same growth and contribution rules,
`π = 0`. Kept as a separate file for clarity and for future class-specific
extensions (staking, etc.).

### 7.4 Cash  ·  [`steps/cash.js`](./steps/cash.js)

$$
\text{value}' = \text{value}, \qquad \pi = 0
$$

Cash earns no interest in v1 (deliberately conservative).

### 7.5 Real Estate  ·  [`steps/realEstate.js`](./steps/realEstate.js)

Variables: `a = appreciationRate`, `m = mortgageBalance`,
`ρ = mortgageRepaymentRate`, `CF = cashFlow`, `K = yearlyCosts`,
`κ = propertyKind ∈ {investment, residence}` (default `investment`).

Always:

$$
\text{value}' = \text{value} \cdot (1 + a), \qquad
\text{mortgageBalance}' = \max\!\big(0,\, m \cdot (1 - \rho)\big)
$$

Income / expense splits by kind:

$$
\pi \;=\;
\begin{cases}
CF & \text{if } \kappa = \text{investment} \\
0  & \text{if } \kappa = \text{residence}
\end{cases}
\qquad
\kappa_{\text{extra}} \;=\;
\begin{cases}
0 & \text{if } \kappa = \text{investment} \\
K & \text{if } \kappa = \text{residence}
\end{cases}
$$

Net-worth contribution is `value − mortgageBalance` for both kinds.

Notes:
- The mortgage has **no interest accrual** in this model — a fraction `ρ` of
  the outstanding balance is repaid each year. Any interest the user
  actually pays on an investment property is expected to be already netted
  into `CF`.
- `CF` may be negative (rents below costs); it directly subtracts from the
  year's passive income.

**Worked example (investment).** value 300 000 (+3 %), mortgage 100 000
with `ρ = 5 %`, CF = 6 000 → `value' = 309 000`, `mortgageBalance' = 95 000`,
`π = 6 000`, `κ_extra = 0`.

**Worked example (residence).** value 400 000 (+2 %), mortgage 250 000
(`ρ = 4 %`), `K = 4 000` → `value' = 408 000`, `mortgageBalance' = 240 000`,
`π = 0`, `κ_extra = 4 000`.

### 7.6 Private Business  ·  [`steps/privateBusiness.js`](./steps/privateBusiness.js)

Variables: `g = valueGrowthRate`, `D = yearlyDividend`,
`g_d = dividendGrowthRate`, `τ = dividendTaxRate`.

Dividend for the **current** year is paid at the *old* `D`; growth is
applied afterward so the next year pays `D · (1 + g_d)`:

$$
\pi = D \cdot (1 - \tau), \qquad
\text{value}' = \text{value} \cdot (1 + g), \qquad
D' = D \cdot (1 + g_d)
$$

**Worked example.** value 200 000 (+5 %), `D = 10 000` (+3 % growth),
`τ = 26 %` → year-1 income $7{,}400$, `value' = 210 000`, `D' = 10 300`.

### 7.7 Pension  ·  [`steps/pension.js`](./steps/pension.js)

Variables: `A = yearlyAmount`, `r = revaluationRate`, `s = startingAge`,
`age = ctx.currentAge`.

$$
\pi \;=\;
\begin{cases}
0 & \text{if } age < s \\[3pt]
A \cdot (1 + r)^{\,age - s} & \text{if } age \ge s
\end{cases}
\qquad \text{asset}' = \text{asset}
$$

Notes:
- Pension contributes **0** to net worth (income-only — no balance to sell).
- Pension is treated as **net of tax** in v1; users lower `A` to reflect
  their take-home rate.
- Multiple pensions are allowed; each is summed independently.

**Worked example.** `A = 20 000`, `r = 2 %`, `s = 67`:
`age = 60` → 0; `age = 67` → 20 000; `age = 68` → 20 400.

### 7.8 Personal Debt  ·  [`steps/personalDebt.js`](./steps/personalDebt.js)

Variables: `b = balance`, `r = interestRate`, `P = monthlyPayment`,
`r_m = r / 12`.

The balance is updated **monthly** (12 sub-steps per simulation year).
For each month `m ∈ {0, …, 11}` while `b > 0`:

$$
b_{\text{grown}} \;=\; b \cdot (1 + r_m)
$$

$$
\text{actualPayment}_m \;=\;
\begin{cases}
b_{\text{grown}} & \text{if } b_{\text{grown}} \le P \quad \text{(final partial payment)} \\
P                & \text{otherwise}
\end{cases}
$$

$$
b_{m+1} \;=\;
\begin{cases}
0                       & \text{if } b_{\text{grown}} \le P \\
b_{\text{grown}} - P    & \text{otherwise}
\end{cases}
$$

Yearly aggregates:

$$
\delta = \sum_{m=0}^{11} \text{actualPayment}_m, \qquad \pi = 0
$$

`δ` (yearly debt payments) is reported separately — it is **not** passive
income; it is a *drag* on cash flow. Once the balance reaches 0, no further
payments accrue.

**Worked example.** `b = 10 000`, `r = 12 %` (so `r_m = 1 %`), `P = 500`:
after 12 monthly steps `b ≈ 4 734.26`.

---

## 8. Coast FIRE

> Implemented in [`scenarios.js`](./scenarios.js).

### 8.1 `simulateCoastFire(state, { horizonAge, coastAge })`

Piecewise simulation: contribute as in Standard while
`currentAge ≤ coastAge`, then stop:

$$
\text{applyContribution}(y) \;=\; \big(\text{startAge} + y \le \text{coastAge}\big)
$$

If `coastAge` is omitted, defaults to `startAge − 1` so contributions are
**off** for the entire trajectory (the legacy "stop now" definition).
If `coastAge ≥ horizonAge`, this reduces to `simulateStandard`.

### 8.2 `findCoastFireAge(state, opts)` — earliest feasible stop-age

**Definition.** The Coast FIRE age is the earliest `X ≥ currentAge` such that:

1. Contribute normally up to and including age `X`.
2. Stop contributing afterward; assets compound on their own.
3. At retirement age `R`, the **4 % rule** holds.

Retirement age:

$$
R \;=\;
\begin{cases}
\min \{\,\text{startingAge} : a.\text{class} = \text{pension}\,\} & \text{if any pension exists} \\
65 & \text{otherwise}
\end{cases}
\quad \text{(override via opts.retirementAge)}
$$

Let `simulateCoastFire(state, { coastAge: X })` evolve the assets to age `R`.
Define:

$$
\text{netWorth}(R; X) \;=\; \text{stocks}(R) + \text{bonds}(R) + \text{crypto}(R) + \text{cash}(R) + \text{REvalue}(R) + \text{PBvalue}(R)
$$

(pension contributes 0; personal debt is a liability already netted in.)

$$
\text{passiveIncome}(R; X) \;=\; \text{computePassiveIncome}\big(A(R; X),\, \{ \text{year}: R - \text{startAge},\, \text{currentAge}: R \}\big).\text{total}
$$

$$
\text{expenses}(R) \;=\; 12 \cdot \text{monthlyExpenses}_0 \cdot (1 + \text{inflationRate})^{R - \text{startAge}} \;+\; \sum_{\text{residence } a} a.\text{yearlyCosts}
$$

The 4 %-rule feasibility at retirement:

$$
\boxed{\;\text{feasible}(X) \;\Longleftrightarrow\; \text{passiveIncome}(R; X) \;+\; 0.04 \cdot \text{netWorth}(R; X) \;\ge\; \text{expenses}(R)\;}
$$

**Search.** Linear scan over `X ∈ [startAge, min(R, horizonAge)]`; return the
smallest feasible `X`, or `null` if none exists.

**Monotonicity.** If stopping at `X` works, stopping later than `X` also
works (more accumulation, same retirement target). The search exits on the
first `true`.

---

## 9. FIRE

> Implemented in [`fire.js`](./fire.js).

### 9.1 `simulateFire(state, { startAge, horizonAge })`

Returns `{ trajectory, failedAtAge }`. Each `FireYearResult` extends the
`YearResult` with `{ drawnDown, drawdownOk }`.

For year `y ∈ [1, horizonAge − age]`:

1. `inDecumulation = (currentAge ≥ startAge)`.
2. `ctx = { year: y, currentAge, applyContribution: ¬inDecumulation }` —
   contributions are **on** before `startAge` and **off** at/after.
3. Step every asset; aggregate `Π_y` (passive income), `D_y` (debt payments),
   `K_y` (residence extra-expense).
4. `applyYearSales(assets, y)` (sales fire **before** drawdown so newly
   converted proceeds are immediately drawdown-eligible).
5. Compute expenses:
   $E_y = 12 \cdot m_0 \cdot (1 + r)^{y} + K_y$.
6. If `inDecumulation`, compute the **shortfall**:

   $$
   S_y \;=\; E_y \;+\; D_y \;-\; \Pi_y
   $$

   If $S_y > 0$, call `drawdownYear(assets, S_y)` (§9.3). If `success === false`,
   set `failedAtAge = currentAge` and **stop** the simulation.

### 9.2 `findFireAge(state, opts)`

Linear scan from `currentAge` to `horizonAge`:

```
for A in startAge..horizonAge:
  if simulateFire(state, { startAge: A }).failedAtAge === null:
    return A
return null
```

Relies on the **monotonicity assumption**: if FIRE succeeds at age `X`, it
succeeds at `X + k` for all `k ≥ 0` (more accumulation, shorter
decumulation). Holds for typical inputs.

### 9.3 `drawdownYear(assets, shortfall)`  ·  [`drawdown.js`](./drawdown.js)

Covers a yearly net-cash shortfall `S` by selling liquid assets.

**Step 1 — Liquid investable.** Aggregate by current value over
`{stocks, bonds, crypto}` (cash excluded):

$$
V_c \;=\; \sum_{a:\, a.\text{class}=c} \sum_{\ell \in a.\text{lots}} \ell.\text{value}, \qquad
V_{\text{liq}} \;=\; V_{\text{stocks}} + V_{\text{bonds}} + V_{\text{crypto}}
$$

**Step 2 — Allocate proportionally** by class share:

$$
T_c \;=\; S \cdot \frac{V_c}{V_{\text{liq}}} \quad \text{(if } V_{\text{liq}} > 0\text{)}
$$

Within each class, distribute `T_c` across that class's assets in proportion
to each asset's value:

$$
T_{a} \;=\; T_c \cdot \frac{V_a}{\sum_{a' \in c} V_{a'}}
$$

**Step 3 — Per-asset HIFO sale** (§9.4):

```
sale = sellLotsHIFO(asset.lots, T_a, asset.capitalGainsTaxRate ?? 0)
asset.lots = sale.updatedLots
drawn += sale.netProceeds
taxPaid += sale.taxPaid
```

**Step 4 — Drain cash** to cover any remaining shortfall, in asset list
order:

$$
\text{take} = \min(a.\text{value},\, S - \text{drawn}), \qquad a.\text{value}' = a.\text{value} - \text{take}
$$

**Step 5 — Success.**

$$
\text{success} \;\Longleftrightarrow\; (S - \text{drawn}) \le \varepsilon, \quad \varepsilon = 10^{-6}
$$

If `success === false`, the calling FIRE simulator records `failedAtAge` and
stops.

### 9.4 `sellLotsHIFO(lots, proceedsNeeded, cgt)`  ·  [`drawdown.js`](./drawdown.js)

Sells from a single lot-bearing asset to net `proceedsNeeded` cash, in
**HIFO** order — highest cost basis first; ties broken by **ascending year**
(older first) for determinism.

For each lot `ℓ` in HIFO order, while
`netProceeds < proceedsNeeded − 10⁻⁹`:

Per-unit gain ratio (gain dollars per dollar of *value* sold from this lot):

$$
\gamma \;=\; \max\!\left(0,\; \frac{\ell.\text{value} - \ell.\text{costBasis}}{\ell.\text{value}}\right)
$$

Effective tax rate on each unit of value sold:

$$
\tau_{\text{eff}} \;=\; \gamma \cdot \text{cgt}, \qquad
\eta \;=\; 1 - \tau_{\text{eff}} \quad \text{(net ratio)}
$$

If `η ≤ 0` skip the lot (pathological — taxes wipe out proceeds).

Gross-up: how much value to sell so the *net* equals what's still needed:

$$
v \;=\; \min\!\left(\ell.\text{value},\; \frac{\,S - \text{netProceeds}\,}{\eta}\right)
$$

Per-lot accounting:

$$
\begin{aligned}
\text{gainSold}_\ell  &= v \cdot \gamma \\
\text{taxOnLot}_\ell  &= \text{gainSold}_\ell \cdot \text{cgt} \\
\text{netFromLot}_\ell &= v - \text{taxOnLot}_\ell
\end{aligned}
$$

Update accumulators:

$$
\text{grossSold} \mathrel{+}= v, \qquad
\text{taxPaid} \mathrel{+}= \text{taxOnLot}_\ell, \qquad
\text{netProceeds} \mathrel{+}= \text{netFromLot}_\ell
$$

Update the lot in place:

- If `|v − ℓ.value| < 10⁻⁹` → **drop** the lot (fully consumed).
- Otherwise the **remaining** slice keeps its cost basis proportionally:

$$
\ell.\text{value}' \;=\; \ell.\text{value} - v, \qquad
\ell.\text{costBasis}' \;=\; \ell.\text{costBasis} \cdot \frac{\ell.\text{value} - v}{\ell.\text{value}}
$$

Output: `{ updatedLots, grossSold, netProceeds, taxPaid }`. Surviving and
partially-sold lots are returned in **original input order** (only
*sale order* is HIFO).

**Worked example (TC4.6).** Lots `[{v:1000, cb:600}, {v:1000, cb:900}]`,
need 500 net at `cgt = 0.20`:

1. HIFO picks the `cb = 900` lot first (lower per-unit gain).
2. $\gamma = 100 / 1000 = 0.10$; $\tau_{\text{eff}} = 0.02$; $\eta = 0.98$.
3. $v = 500 / 0.98 \approx 510.20$. Tax $= 510.20 \cdot 0.10 \cdot 0.20 \approx 10.20$.
4. Net $= 510.20 - 10.20 = 500.00$. The `cb = 600` lot is untouched.

---

## 10. Sale events

> Implemented in [`sale.js`](./sale.js).

Sales fire for **real-estate** and **private-business** assets that have
`saleYearsFromNow !== null` and `saleYearsFromNow === y`. The simulators
call `applyYearSales(assets, y)` after the per-class step (and before
drawdown in FIRE).

### 10.1 `computeSaleProceeds(asset, year)`

Let `f = saleFeesPct`, `ζ = saleCapitalGainsTaxRate`,
`V_0 = originalValue` (captured at asset creation),
`m = mortgageBalance` (real estate only).

$$
\text{fees} = f \cdot \text{value}, \qquad
\text{gain} = \max(0,\, \text{value} - V_0), \qquad
\text{tax} = \zeta \cdot \text{gain}
$$

$$
\text{proceeds} \;=\;
\begin{cases}
\text{value} - \text{fees} - \text{tax} - m & \text{if class} = \text{realEstate} \\
\text{value} - \text{fees} - \text{tax}     & \text{if class} = \text{privateBusiness}
\end{cases}
$$

Capital losses (`value < V_0`) do **not** generate a tax credit (the `max`
clamps gain at 0).

### 10.2 `applySaleConversion(assets, sourceAssetId, proceeds, saleYear)`

The source asset's `saleConversion` field controls where proceeds go:

| `saleConversion` shape   | Behaviour                                                                                                                                                  |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `{ targetAssetId, … }`   | Append `{ value: proceeds, costBasis: proceeds, year: saleYear }` to the target's `lots` (target must be lot-bearing: stocks/bonds/crypto).                |
| `{ inlineParams, … }`    | Create a brand-new asset of `inlineParams.class`, seeded with the proceeds (one lot for liquid classes; `value = proceeds` for cash). Default rates apply. |
| `null` / unset           | Proceeds become a **new cash asset** (named `"<source.name> proceeds"`). Value is never lost; user can re-allocate later.                                  |

The source asset is **removed** from the list in all cases.

---

## 11. Public engine API

The UI consumes only [`./index.js`](./index.js). The exports are **frozen**;
adding/removing one is a breaking change and must update the architectural
test `tests/arch/engine-public-api.test.js`.

| Export                   | Source                                       | Purpose                                              |
|--------------------------|----------------------------------------------|------------------------------------------------------|
| `simulateStandard`       | [`simulate.js`](./simulate.js)               | Standard scenario trajectory                         |
| `simulateCoastFire`      | [`scenarios.js`](./scenarios.js)             | Coast FIRE trajectory                                |
| `findCoastFireAge`       | [`scenarios.js`](./scenarios.js)             | Earliest Coast FIRE age (or `null`)                  |
| `simulateFire`           | [`fire.js`](./fire.js)                       | FIRE trajectory + `failedAtAge`                      |
| `findFireAge`            | [`fire.js`](./fire.js)                       | Earliest FIRE age (or `null`)                        |
| `computeNetWorth`        | [`netWorth.js`](./netWorth.js)               | `Σ assetNetValue`                                    |
| `computeNetWorthByClass` | [`netWorth.js`](./netWorth.js)               | Per-class breakdown (chart)                          |
| `computePassiveIncome`   | [`passiveIncome.js`](./passiveIncome.js)     | `{ total, byClass }` for a year                      |
| `computeStatsTable`      | [`stats.js`](./stats.js)                     | Time-horizon snapshot table                          |
| `validateAsset`          | `../model/assets.js` (re-export)             | Asset validation for UI forms                        |

---

## 12. Stats table

> Implemented in [`stats.js`](./stats.js) — `computeStatsTable(state, { horizons })`.

Default horizons: `[0, 5, 10, 20]`. Internally runs `simulateStandard` once
to `horizonAge = startAge + max(horizons)`, then samples year `h` for each
`h ∈ horizons`:

$$
\begin{aligned}
\text{rows}[c][i]                &\;=\; \text{trajectory}[h_i].\text{byClass}[c]    && \text{(per class } c\text{)} \\
\text{rows.total}[i]             &\;=\; \text{trajectory}[h_i].\text{netWorth} \\
\text{rows.yearlyExpenses}[i]    &\;=\; \text{trajectory}[h_i].\text{expenses}      && \text{(includes residence costs)} \\
\text{rows.monthlyExpenses}[i]   &\;=\; \text{rows.yearlyExpenses}[i] / 12
\end{aligned}
$$

The `total` row equals the column-wise sum of all eight class rows by
construction.

---

## 13. Architectural & documentation invariants

Enforced by automated tests:

- `tests/arch/forbidden-imports.test.js` — engine references no `document`,
  no `window`, and `localStorage` only inside `src/state.js`.
- `tests/arch/no-ui-imports.test.js` — engine never imports from `src/ui/`.
- `tests/arch/engine-public-api.test.js` — `index.js` exports exactly the
  10 names listed in §11.
- `tests/arch/purity.test.js` — every `src/engine/steps/*` function leaves
  its input deeply unchanged.
- `tests/docs/jsdoc-coverage.test.js` — every named export has a JSDoc block.
- `tests/docs/jsdoc-formula.test.js` — every formula-bearing function has
  an `@formula` tag.
- `tests/docs/jsdoc-pure.test.js` — every export in `src/engine/**` has a
  `@pure` tag.
- `tests/docs/cross-refs.test.js` — each step file references
  `docs/engine.md`; each `### Class` subsection mentions the corresponding
  step-function name.

If you change the calculation layer, run the tests:

```bash
node tests/run-node.mjs
# or, in the browser:
python3 -m http.server 8765 && open http://localhost:8765/tests/runner.html
```

---

## 14. See also

- [`docs/engine.md`](../../docs/engine.md) — narrative companion to this
  README, kept in lock-step by the doc tests.
- [`src/model/`](../model/) — asset factories, validation, and
  `assetNetValue`.
- [`src/state.js`](../state.js) — pure reducers + persistence adapter.
