# Financial Independence & Retirement Planner — Implementation Plan

## 1. Overview

A single-page web application (vanilla JS/HTML/CSS, no framework for v1) that allows an
individual to model their net worth and project three retirement scenarios:

1. **Standard** — Continue contributing as today; project net worth growth.
2. **Coast FIRE** — Stop contributing now; assets compound on their own; check whether
   passive income at pension age can cover inflation-adjusted expenses.
3. **FIRE** — Stop contributing AND decumulate; check whether passive income + asset
   drawdown can cover expenses at any age.

The user inputs personal info, a list of assets (positive and negative), and the app
projects net worth and feasibility of each scenario year by year.

---

## 2. Data Model

### 2.1 User Info

| Field | Type | Description |
|-------|------|-------------|
| `age` | number | Current age |
| `monthlyExpenses` | number | Base monthly expenses (today's currency) |
| `inflationRate` | number (%) | Yearly inflation rate applied to expenses |

### 2.2 Assets — Common Fields

Every asset has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (uuid) | Unique identifier |
| `name` | string | User-provided label (e.g., "VTI portfolio", "Rental Apt A") |
| `class` | enum | One of: `stocks`, `bonds`, `crypto`, `cash`, `realEstate`, `privateBusiness`, `pension`, `personalDebt` |

Multiple assets of any class are allowed.

### 2.3 Asset Classes

#### 2.3.1 Stocks (liquid, positive)

| Field | Type | Description |
|-------|------|-------------|
| `lots` | array of `{ value, costBasis, year }` | Each purchase is a separate lot. `value` and `costBasis` start equal. |
| `avgReturnRate` | number (%) | Yearly expected return |
| `yearlyContribution` | number | Amount added each year (Standard scenario only) |
| `capitalGainsTaxRate` | number (%) | Tax on (sale proceeds − cost basis) |

Notes:
- Contributions create a new lot at current price each year.
- On drawdown (FIRE scenario), lots are sold **highest cost basis first (HIFO)** to
  minimize realized gains.

#### 2.3.2 Bonds (liquid, positive, perpetual — no maturity)

| Field | Type | Description |
|-------|------|-------------|
| `lots` | array of `{ value, costBasis, year }` | Same lot structure as stocks |
| `yieldRate` | number (%) | Yearly cash payout as % of value |
| `yearlyContribution` | number | Amount added each year (Standard scenario only) |
| `capitalGainsTaxRate` | number (%) | Tax on capital gains when sold |
| `yieldTaxRate` | number (%) | Tax on yield payouts (typically lower than capital gains) |

Notes:
- Yield is paid in cash each year (counts as passive income); not reinvested
  automatically.
- Bond principal value can grow if `avgReturnRate` is non-zero; for v1 we treat
  bond value as flat (no appreciation), only yielding the cash payout. Optional
  `valueGrowthRate` could be added later.

#### 2.3.3 Crypto (liquid, positive)

| Field | Type | Description |
|-------|------|-------------|
| `lots` | array of `{ value, costBasis, year }` | Same lot structure |
| `avgReturnRate` | number (%) | Yearly expected return |
| `yearlyContribution` | number | Amount added each year (Standard scenario only) |
| `capitalGainsTaxRate` | number (%) | Tax on (sale proceeds − cost basis) |

#### 2.3.4 Cash (liquid, positive)

| Field | Type | Description |
|-------|------|-------------|
| `value` | number | Current cash balance |

No return rate, no contributions, no taxes. Cash may also be used as a buffer when
income shortfalls occur (TBD in calculation logic — see §3.4).

#### 2.3.5 Real Estate (illiquid, positive)

| Field | Type | Description |
|-------|------|-------------|
| `value` | number | Current property value |
| `appreciationRate` | number (%) | Yearly value appreciation |
| `mortgageBalance` | number | Outstanding mortgage debt |
| `mortgageInterestRate` | number (%) | Yearly interest rate on mortgage |
| `mortgageYearlyRepayment` | number | Yearly principal repayment (user-provided) |
| `monthlyRent` | number | Gross monthly rental income (0 if not rented) |
| `yearlyCosts` | number | Yearly recurring costs (taxes, maintenance, insurance, HOA combined) |
| `rentalIncomeTaxRate` | number (%) | Tax on net rental income |
| `saleYearsFromNow` | number or null | If set, sell asset in N years and convert |
| `saleFeesPct` | number (%) | Sale fees (e.g., realtor) — default 0 |
| `saleCapitalGainsTaxRate` | number (%) | Capital gains tax on sale — default 0 |
| `saleConversion` | object or null | See §2.4 |

Net contribution to net worth: `value - mortgageBalance`.

#### 2.3.6 Private Business (illiquid, positive)

| Field | Type | Description |
|-------|------|-------------|
| `value` | number | Current valuation |
| `valueGrowthRate` | number (%) | Yearly valuation growth |
| `yearlyDividend` | number | Yearly dividend amount |
| `dividendGrowthRate` | number (%) | Yearly growth in dividend amount |
| `dividendTaxRate` | number (%) | Tax on dividends |
| `saleYearsFromNow` | number or null | If set, sell in N years and convert |
| `saleFeesPct` | number (%) | Sale fees — default 0 |
| `saleCapitalGainsTaxRate` | number (%) | Capital gains tax on sale — default 0 |
| `saleConversion` | object or null | See §2.4 |

#### 2.3.7 Pension (liquid, positive — once started)

| Field | Type | Description |
|-------|------|-------------|
| `yearlyAmount` | number | Yearly pension amount in today's currency |
| `revaluationRate` | number (%) | Yearly growth (typically tied to inflation) |
| `startingAge` | number | Age at which pension begins (default 67) |

Notes:
- Pension contributes 0 cash flow before `startingAge`.
- After `startingAge`, it pays out the (revaluated) yearly amount as passive income.
- Multiple pensions allowed.

#### 2.3.8 Personal Debt (liquid, **negative**)

| Field | Type | Description |
|-------|------|-------------|
| `balance` | number | Outstanding balance |
| `interestRate` | number (%) | Annual interest rate |
| `monthlyPayment` | number | Fixed monthly payment until paid off |

Notes:
- Subtracts from net worth.
- Each month, balance grows by `interestRate / 12` and is reduced by `monthlyPayment`.
- Auto-paid off when balance ≤ 0; no further payments.
- Monthly payment is treated as a recurring expense in cash flow projections.

### 2.4 Sale Conversion (illiquid assets only)

When a real estate or private business asset has a `saleYearsFromNow`, it is sold at
year N and proceeds are converted into another asset.

`saleConversion` object:

| Field | Type | Description |
|-------|------|-------------|
| `targetAssetId` | string or null | Existing asset to merge proceeds into; if null, define inline |
| `inlineParams` | object or null | Used when `targetAssetId` is null — full asset spec for the new asset (class + class-specific fields) |

Behavior:
- If `targetAssetId` is set: the new lot/value is added to the existing target asset,
  inheriting its parameters (return rate, tax rate, etc.).
- If `targetAssetId` is null: a new asset is created from `inlineParams`.
- The proceeds amount becomes the cost basis of the new lot (for liquid asset classes).

Sale proceeds calculation:
- Real estate: `proceeds = value − feesPct·value − tax(value − originalValue) − mortgageBalance`
  - Note: original purchase price not tracked; v1 uses `value at creation` as cost basis.
- Private business: `proceeds = value − feesPct·value − tax(value − originalValue)`

---

## 3. Calculation Logic

### 3.1 Time Stepping

- Simulation runs in **yearly steps**, from current age up to a target horizon
  (default: age 100).
- Within each year:
  1. Apply growth/appreciation to all asset values.
  2. Apply contributions (Standard scenario only).
  3. Generate passive income (dividends, rental net, bond yield, pension if active).
  4. Apply yearly expenses (inflated).
  5. In FIRE: cover shortfall by drawing down liquid assets proportionally (HIFO within
     each asset).
  6. Update personal debt balance and apply monthly payments.
  7. Trigger illiquid asset sales if `saleYearsFromNow == year`.
  8. Compute net worth = sum(all positive asset values) − sum(debt balances) − mortgage balances.

### 3.2 Inflation

- All expenses grow at `inflationRate` each year.
- `monthlyExpensesYearN = monthlyExpensesYear0 · (1 + inflationRate)^N`

### 3.3 Passive Income (per year)

`passiveIncome = sum of:`
- Stocks: 0 (no dividend modeled separately; capital gains realized only on sale).
- Bonds: `value · yieldRate · (1 − yieldTaxRate)`
- Crypto: 0.
- Real estate: `(monthlyRent · 12 − yearlyCosts − mortgageInterest) · (1 − rentalIncomeTaxRate)`
  (negative if costs exceed rent — counts as a drag).
- Private business: `yearlyDividend · (1 − dividendTaxRate)` (with dividend growth applied yearly).
- Pension: `yearlyAmount · (1 + revaluationRate)^(currentAge − startingAge)` if `currentAge ≥ startingAge`, else 0.
- Cash: 0.
- Personal debt: 0 (but yearly debt payments count as expense).

### 3.4 Drawdown (FIRE Scenario Only)

Each year:
1. Compute `shortfall = yearlyExpenses + yearlyDebtPayments − passiveIncome`.
2. If `shortfall ≤ 0`, no drawdown needed; surplus accrues to cash.
3. If `shortfall > 0`:
   - **Drain cash assets first** (in list order). Cash earns no return and pays
     no tax, so spending it before selling growth assets is always optimal.
   - If cash is exhausted and shortfall remains: total liquid investable
     = `stocks + bonds + crypto`. Allocate the remaining shortfall to each
     class proportionally to its share of total liquid investable.
   - For each class, sell lots HIFO until target proceeds met (gross-up for capital
     gains tax: `proceedsNeeded = net / (1 − effectiveTaxRate)`, with a per-lot
     correction since each lot has its own gain).
   - If liquid investable + cash is still insufficient, mark scenario as
     **failed** at this year.

### 3.5 Coast FIRE Check

Computed as a side condition during the Coast FIRE scenario:

For each year ≥ pension age (min `startingAge` across pensions):
- Compute `passiveIncomeAtThatAge` (pension + bond yield + real estate net rent + private business dividends).
- Compute `withdrawal4pct = 4% · (stocks + bonds + crypto value at that age)`.
- Coast FIRE achievable if `passiveIncomeAtThatAge + withdrawal4pct ≥ inflatedYearlyExpenses`.
- Output: earliest age (≥ pension age) at which Coast FIRE is feasible, or "not achievable by age 100".

### 3.6 FIRE Check

For each year (starting from current age):
- Run a forward simulation from that year onward in FIRE mode.
- FIRE achievable at age X if drawdown simulation from X to age 100 never fails.
- Output: earliest age at which FIRE is achievable, or "not achievable by age 100".

---

## 4. UI Design (v1)

### 4.0 Principles
- **No registration, no login.** The app is usable instantly on first load.
- **No page reloads, ever.** Every interaction updates the UI in real time.
- **Single page**, scrolling top to bottom: User Info → Assets → Chart → Stats.
- All projections recompute reactively on any input change.
- Persistence: auto-save to `localStorage` on every change. JSON import/export
  buttons for backup/sharing.

### 4.0.1 Visual style — "Tron / neon on dark"

The UI is **minimalist, neat, and highly visual**. Aesthetic inspiration: Tron — dark
background, fluorescent accent colors, glowing edges, generous whitespace, large
typography.

**Palette** (tokens defined as CSS variables in `styles.css`):

| Token | Purpose | Example |
|-------|---------|---------|
| `--bg` | Page background | `#05060a` (near-black) |
| `--bg-elev` | Card background | `#0b0e15` |
| `--border` | Card border (subtle) | `#1a2030` |
| `--fg` | Primary text | `#e6f7ff` |
| `--fg-dim` | Secondary text | `#7a90a8` |
| `--accent-cyan` | Primary neon (Tron blue) | `#00f0ff` |
| `--accent-magenta` | Secondary neon | `#ff2bd6` |
| `--accent-lime` | Tertiary neon | `#aaff00` |
| `--accent-amber` | Warning / debt | `#ffb020` |
| `--accent-red` | Negative / delete | `#ff3860` |

**Per-class accent colors** (override the §4.2.3 hints to fit the neon palette):

| Class | Color |
|-------|-------|
| Stocks | Cyan `--accent-cyan` |
| Bonds | Teal `#00ffaa` |
| Crypto | Magenta `--accent-magenta` |
| Cash | Lime `--accent-lime` |
| Real Estate | Amber `--accent-amber` |
| Private Business | Violet `#b56bff` |
| Pension | Sky `#5fa8ff` |
| Personal Debt | Red `--accent-red` |

**Typography:**
- Display headings: **bold sans-serif, large** (e.g., 48–72px on hero numbers like
  current net worth). Suggested font family: `"Orbitron"`, `"Rajdhani"`, or system
  fallback. Loaded via Google Fonts CDN if used.
- Body: clean modern sans-serif (e.g., `"Inter"` or system stack).
- Numbers in tables and cards: **tabular-nums**, slightly larger than typical web UI
  (16–20px body, 24–32px card values).

**Visual language:**
- Cards have **thin neon borders** in the asset's class color, with a soft outer
  glow (CSS `box-shadow` with the accent color).
- Hover states **intensify the glow** rather than change the fill.
- Buttons are outlined (transparent fill) with neon border + glow; primary actions
  use cyan, destructive actions use red.
- The "+" add button is a large circular outlined button with cyan glow.
- Chart lines use the per-class neon palette with no fill (Tron grid feel).
- Subtle thin grid lines on the chart background in `--border` color.
- Generous padding and spacing — no cramped layouts.
- Optional: a faint animated grid in the page background for ambient Tron feel
  (low priority, can skip in v1).

**Icons:**
- Use a single icon set, monochrome, neon-tinted. Lucide (open source, MIT) loaded
  via CDN or inline SVG is the default choice.

### 4.1 User Info Section (top of page)

A compact form with the following fields:

| Field | Notes |
|-------|-------|
| Age | Integer |
| Country of residence | Dropdown of EU countries (see §4.5) |
| Monthly expenses | Currency input |
| Expected inflation rate | Percentage input |

Behavior:
- Selecting a country **immediately overwrites all tax rates** on every existing
  asset with the new country defaults (any user overrides are lost). A small inline
  notice acknowledges the change.

### 4.2 Assets Section

A visual grid of asset **cards**, with a single **"+" button** to add new assets.

#### 4.2.1 Adding an asset
1. User clicks the "+" button.
2. A picker appears showing **8 large buttons**, one per asset class, each with:
   - A distinct icon
   - A distinct color (consistent across the app for that class)
   - The class name (Stocks, Bonds, Crypto, Cash, Real Estate, Private Business,
     Pension, Personal Debt)
3. Clicking a class button opens a **modal form** with the class-specific fields.
   Tax rates are pre-filled from the country defaults but editable.
4. On save, the modal closes and the new card appears in the grid.

#### 4.2.2 Asset card states

**Collapsed (default):** Compact card showing:
- Class icon (in class color)
- Asset name
- Current value (or net value, e.g., real estate value − mortgage)
- A **delete button** (always visible on the collapsed card)

**Expanded (clicked):** Card expands inline to show **all fields directly editable**.
- No separate edit mode — typing in any field updates the model and recomputes
  projections live.
- Click the card header again (or an explicit collapse control) to collapse.

#### 4.2.3 Visual identity per class
Each class has its own color + icon. Suggested mapping (final colors/icons in
implementation):

| Class | Color hint | Icon hint |
|-------|------------|-----------|
| Stocks | Blue | Chart-line |
| Bonds | Teal | Certificate |
| Crypto | Orange | Coin/blockchain |
| Cash | Green | Banknote |
| Real Estate | Brown | House |
| Private Business | Purple | Briefcase |
| Pension | Indigo | Shield/clock |
| Personal Debt | Red | Minus / chain |

#### 4.2.4 Live net worth header
At the top of the assets section, a running **total net worth** is displayed and
updates live as cards are edited.

### 4.3 Projections Chart (below assets)

A large **line chart** (Chart.js via CDN), updated in real time. X-axis = age, Y-axis = net worth.

Three trajectories plotted:
- **Standard** — current contribution behavior continues.
- **Coast FIRE** — contributions stop now; assets grow on their own.
- **FIRE** — contributions stop and decumulation begins from a chosen age (the
  earliest age FIRE is feasible).

Visual markers:
- Vertical line / dot at the **Coast FIRE age** (earliest age at which Coast FIRE is feasible).
- Vertical line / dot at the **FIRE age** (earliest age at which FIRE is feasible).
- Annotations like "Coast FIRE achievable at age X" / "FIRE achievable at age Y" or
  "Not achievable by age 100".

### 4.4 Stats Section (below chart)

A summary table showing **asset values and expenses across time horizons**.

Columns: **Now**, **+5 years**, **+10 years**, **+20 years** (and optionally +30
years up to age 100).

Rows:
- One row per asset class (sum across all assets of that class), at projected value.
- A row for total net worth.
- A row for monthly expenses (inflated to that horizon).
- A row for yearly expenses (inflated to that horizon).

This summary uses the **Standard scenario** projection by default. (Future work: a
toggle to view the same summary for Coast FIRE / FIRE scenarios.)

### 4.5 Country defaults (tax rates)

When a country is selected, defaults are applied to the relevant tax fields on every
existing asset and used for all newly-created assets. Defaults to maintain in code:

| Country | Stocks CGT | Bonds CGT | Bonds yield tax | Crypto CGT | RE rental tax | RE sale CGT | PB dividend tax | PB sale CGT |
|---------|------------|-----------|-----------------|------------|---------------|-------------|-----------------|-------------|
| (Italy, Germany, France, Spain, Netherlands, Ireland, Portugal, Belgium, Austria, Finland, Sweden, Denmark, Greece, Poland, Czechia, ...) | tbd | tbd | tbd | tbd | tbd | tbd | tbd | tbd |

Initial implementation will include a curated set of EU countries with researched
default rates; the table will be populated in a `src/data/countries.js` module and
referenced from the User Info form. Users can always override per-asset.

---

## 5. File Structure

```
webapp/
├── index.html             # Layout, sections, modals
├── styles.css             # Styling, per-class color tokens
├── app.js                 # Entry: bootstrap, reactive wiring
├── src/
│   ├── state.js           # State management, localStorage I/O, change subscribers
│   ├── data/
│   │   └── countries.js   # EU countries + per-class default tax rates
│   ├── model/
│   │   ├── assets.js      # Asset class definitions, factories, validation
│   │   └── userInfo.js    # User info model
│   ├── engine/
│   │   ├── simulate.js    # Yearly-step simulation engine
│   │   ├── scenarios.js   # Standard / Coast FIRE / FIRE runners
│   │   ├── drawdown.js    # HIFO + proportional drawdown logic
│   │   └── passiveIncome.js
│   └── ui/
│       ├── userInfoForm.js
│       ├── assetPicker.js  # "+" button → 8-class picker
│       ├── assetForms.js   # Per-class modal form rendering
│       ├── assetCard.js    # Collapsed/expanded card with live editing
│       ├── assetList.js    # Cards grid + live net worth header
│       ├── chart.js        # Chart.js trajectory plot + age markers
│       ├── statsTable.js   # Time-horizon summary table
│       └── importExport.js
└── plan.md                # this file
```

No build step. ES modules via `<script type="module">`.

---

## 6. Implementation Milestones

### Milestone 1 — Data model & state (no UI)
- Define asset classes as factory functions / schemas in `model/assets.js`.
- Implement `state.js` with in-memory state + `localStorage` persistence.
- Manual smoke test via console.

### Milestone 2 — User info & asset forms
- Build user info form.
- Build "Add asset" form for each class with validation.
- Build asset list view with edit/delete.
- Display live net worth total.

### Milestone 3 — Simulation engine (Standard scenario)
- Implement yearly-step simulation in `engine/simulate.js`.
- Produce a yearly net worth array for the Standard scenario.
- Render result as a single-line chart.

### Milestone 4 — Coast FIRE scenario
- Add Coast FIRE simulation (no contributions).
- Compute earliest achievable age via 4% rule + passive income vs inflated expenses.
- Add second line to chart and "Coast FIRE achievable at age X" output.

### Milestone 5 — FIRE scenario with drawdown
- Implement HIFO drawdown logic.
- Run FIRE simulation from each candidate retirement age; find earliest success.
- Add third line to chart and "FIRE achievable at age X" output.

### Milestone 6 — Sale events for illiquid assets
- Trigger sale at `saleYearsFromNow`.
- Implement conversion to existing asset or inline new asset.
- Wire UI to allow specifying the conversion at asset creation.

### Milestone 7 — Polish
- Yearly breakdown table.
- JSON import/export.
- Responsive layout.
- Input validation and helpful error messages.

---

## 7. Open Questions / Future Work

- **Tax brackets**: v1 uses flat per-asset tax rates; progressive brackets could be added later.
- **Active income / salary**: Not modeled in v1; user assumes salary covers expenses in
  Standard/Coast scenarios.
- **Stock dividends**: Not modeled separately from capital gains in v1.
- **Bond appreciation**: V1 keeps bond principal flat; appreciation rate could be added.
- **Multiple expense categories**: V1 uses a single monthly expense.
- **Multiple individuals / household**: V1 models a single individual.
- **Currency / locale**: V1 uses a single unspecified currency.
- **Stress testing / Monte Carlo**: V1 uses deterministic average returns only.
- **Cost basis of pre-existing assets**: V1 treats the initial value as the initial
  cost basis (zero unrealized gain at start).

---

## 8. Defaults Used in Plan (revisit if needed)

- Simulation horizon: age 100.
- Pension default starting age: 67.
- Sale fees and sale capital gains tax: 0% by default.
- 4% rule: applied to liquid investable assets (stocks + bonds + crypto), excluding cash.
- Drawdown order across asset classes: cash first, then proportional by current
  value across stocks/bonds/crypto.
- Drawdown order across lots within a class: HIFO.
- Persistence: localStorage + JSON import/export.
- UI: single page, vanilla JS, Chart.js via CDN.
