/**
 * @fileoverview Single source of truth for per-field help copy used by the
 * "?" tooltips next to each asset-card field label.
 *
 * Every entry is grounded in the corresponding section of `methodology.html`
 * (which itself mirrors the engine in `src/engine/`). When the methodology
 * changes, update the matching entry here.
 *
 * Lookup is by `${className}.${fieldKey}` first, then by bare `fieldKey` as
 * a fallback for fields that mean the same thing across classes (e.g. `name`,
 * `value`, `costBasis`). Returning `null` means "no help available" — the UI
 * just doesn't render a "?" icon for that field.
 *
 * Each entry contains:
 *   - `title`: short heading shown in the popup header.
 *   - `text`:  one or more paragraphs (string OR string[]). Plain text only;
 *              the popup renderer never interprets HTML.
 *
 * @module src/ui/fieldHelp
 */

/**
 * Help entries shared across multiple classes. Used as a fallback when
 * `${class}.${field}` has no specific entry. Class-specific overrides (in
 * the table further down) take precedence.
 */
const COMMON = {
  name: {
    title: 'Name',
    text: [
      'A free-text label used purely to identify this asset on cards, charts and the stats table.',
      'It is not used in any calculation. Pick something memorable like "Vanguard FTSE", "Berlin flat" or "Emergency fund".',
    ],
  },

  value: {
    title: 'Current value',
    text: [
      'Today\u2019s gross market value of the asset (or current balance, for cash). All projections start from this number.',
      'For stocks, bonds and crypto this is the sum of all lots; the form rewrites the underlying lots proportionally when you edit it, so any per-lot purchase history (used by the HIFO sale algorithm) is preserved.',
    ],
  },

  costBasis: {
    title: 'Cost basis (price paid)',
    text: [
      'The total amount you originally paid for the position, before any growth. The difference between current value and cost basis is the unrealised gain.',
      'It is used only when the asset is sold (or drawn down in FIRE): capital-gains tax is applied to the gain, not to the full sale amount. Capital losses do not generate a tax credit \u2014 the gain is clamped at zero.',
      'In the HIFO drawdown algorithm, lots with the highest cost basis (smallest gain) are sold first to minimise tax.',
    ],
  },

  avgReturnRate: {
    title: 'Average yearly return',
    text: [
      'The expected long-run return per year, applied as a constant geometric growth: every year the asset value is multiplied by (1 + this rate).',
      'It is deterministic \u2014 there is no volatility or sequence-of-returns risk in the model. Use a long-run real or nominal figure (e.g. 7% for a global equity index) consistent with the inflation rate you set on your profile.',
    ],
  },

  yearlyContribution: {
    title: 'Yearly contribution',
    text: [
      'How much new money you add to this asset each year while you are still contributing (i.e. before retirement age in the Standard scenario, before your chosen stop-age in Coast FIRE, or before your FIRE-start age in FIRE).',
      'Each contribution is appended as a new lot of equal value and cost basis, dated in the year it is made. After the cutoff age, contributions stop and only the existing lots keep growing.',
    ],
  },

  contributionGrowthRate: {
    title: 'Contribution growth',
    text: [
      'A yearly growth rate applied to the contribution itself, so that the amount you save each year grows over time.',
      'Year y\u2019s contribution is computed as base \u00d7 (1 + this rate)^y. Set it to 0 if you want a flat yearly contribution; set it to your expected salary growth if you save a fixed share of income.',
    ],
  },

  capitalGainsTaxRate: {
    title: 'Capital gains tax',
    text: [
      'The tax rate applied to realised gains when this asset is sold or drawn down. Pre-filled from country defaults; override per asset if your situation differs.',
      'Tax is computed on the gain (current value minus cost basis), never on the full proceeds. Losses produce no tax credit \u2014 gains are clamped at zero before the rate is applied.',
    ],
  },

  saleYearsFromNow: {
    title: 'Sale years from now',
    text: [
      'If you plan to sell this asset, the number of years from today the sale should fire. Leave blank if you do not plan to sell.',
      'The sale fires after the per-class growth step in that year. For real estate, the outstanding mortgage is repaid out of proceeds. The leftover is then routed according to "On sale, reinvest proceeds in".',
    ],
  },

  saleFeesPct: {
    title: 'Sale fees',
    text: [
      'Transaction fees as a percentage of the gross sale value (e.g. agent commission for property, broker fee for a private business sale). Subtracted from proceeds before capital-gains tax is computed.',
    ],
  },

  saleCapitalGainsTaxRate: {
    title: 'Sale capital gains tax',
    text: [
      'Capital-gains tax rate applied to the gain realised on sale (current value minus the original purchase value captured at asset creation). Pre-filled from country defaults.',
      'Losses do not generate a tax credit; the gain is clamped at zero before the rate is applied.',
    ],
  },

  saleConversion: {
    title: 'On sale, reinvest proceeds in',
    text: [
      'What happens to the cash freed up by the sale (after fees, capital-gains tax, and \u2014 for real estate \u2014 mortgage repayment).',
      'Three options: keep it as a new cash asset (default), append it as a new lot on an existing stocks / bonds / crypto holding, or seed a brand-new asset of a class you choose. The total is never lost \u2014 only its container changes.',
    ],
  },
};

/**
 * Class-specific overrides and unique fields. Entries here take precedence
 * over the COMMON table above. Keys are `${class}.${fieldKey}`.
 */
const SPECIFIC = {
  // ─────────────────────────── STOCKS ────────────────────────────────────
  'stocks.avgReturnRate': {
    title: 'Average yearly return (stocks)',
    text: [
      'The deterministic per-year return on every existing stock lot. Each year, every lot value is multiplied by (1 + this rate); the cost basis is preserved so the unrealised gain grows with the value.',
      'Use a long-run figure consistent with your inflation rate (e.g. 7% nominal for a broad equity index).',
    ],
  },
  'stocks.yearlyContribution': {
    title: 'Yearly contribution (stocks)',
    text: [
      'New money added to this stock holding each year while you are still contributing. Each year a fresh lot is appended with value = cost basis = (base \u00d7 (1 + growth)^year), dated in that year.',
      'Contributions stop after the retirement / stop / FIRE-start age, depending on the scenario. Lots from before the stop continue to grow.',
    ],
  },
  'stocks.capitalGainsTaxRate': {
    title: 'Capital gains tax (stocks)',
    text: [
      'Tax rate applied when stock lots are sold during FIRE drawdown. The HIFO algorithm sells the lots with the highest cost basis first to minimise the realised gain.',
      'Effective tax per dollar sold from a lot is (gain ratio) \u00d7 (this rate); the gross-up ensures the after-tax proceeds match the cash you actually need.',
    ],
  },

  // ─────────────────────────── BONDS ─────────────────────────────────────
  'bonds.yieldRate': {
    title: 'Yearly yield',
    text: [
      'The coupon yield earned on the bond holding each year. Yield is computed on the value before that year\u2019s new contribution lot is added.',
      'Bond lots themselves are kept flat in v1 \u2014 there is no price appreciation; only the yield (taxed) shows up as passive income.',
    ],
  },
  'bonds.yieldTaxRate': {
    title: 'Yield tax',
    text: [
      'The tax rate applied to bond yield as it is paid. Net yearly passive income from this bond holding is value \u00d7 yield \u00d7 (1 \u2212 this rate). Pre-filled from country defaults.',
    ],
  },
  'bonds.capitalGainsTaxRate': {
    title: 'Capital gains tax (bonds)',
    text: [
      'Capital-gains tax applied if bond lots are sold during FIRE drawdown. Distinct from the yield tax, which is applied each year to the coupon income.',
    ],
  },

  // ─────────────────────────── CRYPTO ────────────────────────────────────
  'crypto.avgReturnRate': {
    title: 'Average yearly return (crypto)',
    text: [
      'Mathematically identical to the stocks return: each lot grows by (1 + this rate) per year. The class is kept separate to allow future extensions (staking, on-chain yield).',
      'Crypto pays no passive income in v1.',
    ],
  },
  'crypto.capitalGainsTaxRate': {
    title: 'Capital gains tax (crypto)',
    text: [
      'Tax rate applied when crypto lots are sold during FIRE drawdown. HIFO ordering minimises realised gains; cost basis is captured per lot at creation and preserved through growth.',
    ],
  },

  // ─────────────────────────── CASH ──────────────────────────────────────
  'cash.value': {
    title: 'Current balance',
    text: [
      'How much cash you currently hold (savings account, money-market, etc.). Cash is the most liquid bucket and is drained first during FIRE drawdown.',
      'Cash earns no return and pays no tax in v1 \u2014 a deliberate choice that makes the opportunity cost of holding cash visible in the projection.',
    ],
  },

  // ─────────────────────────── REAL ESTATE ───────────────────────────────
  'realEstate.propertyKind': {
    title: 'Property kind',
    text: [
      'Investment property: produces a yearly cash flow (positive = passive income, negative = extra expense). The property is treated as an income-producing asset with no running costs entered separately.',
      'Residence: your own home. Generates no passive income; instead, your "Yearly running costs" are added to your total expenses each year.',
    ],
  },
  'realEstate.value': {
    title: 'Current value',
    text: [
      'Today\u2019s gross market value of the property. Each year it appreciates by (1 + appreciation), independently of the mortgage.',
      'Net-worth contribution from this asset is gross value minus outstanding mortgage; on sale, fees and capital-gains tax also come out before reinvestment.',
    ],
  },
  'realEstate.appreciationRate': {
    title: 'Appreciation',
    text: [
      'The yearly rate at which the property\u2019s market value grows. Each year, value is multiplied by (1 + this rate). Independent of mortgage repayment.',
      'Use a long-run figure (typically 2\u20133% for residential property in stable markets).',
    ],
  },
  'realEstate.mortgageBalance': {
    title: 'Outstanding mortgage',
    text: [
      'How much you still owe on the property. Subtracted from the gross value when computing net worth, and repaid out of sale proceeds before reinvestment.',
      'There is no separate interest accrual in this model: any interest you actually pay is expected to be netted into your cash-flow figure (or your costs, for a residence).',
    ],
  },
  'realEstate.mortgageRepaymentRate': {
    title: 'Yearly debt reduction',
    text: [
      'The fraction of the outstanding mortgage that is paid down each year. Each year the balance is multiplied by (1 \u2212 this rate), clamped at zero.',
      'It is not an interest rate \u2014 it is a fixed yearly amortisation share. Set it so that, applied yearly to your current balance, it roughly matches your real repayment plan.',
    ],
  },
  'realEstate.cashFlow': {
    title: 'Yearly cash flow (after costs & tax)',
    text: [
      'For investment properties only: rent income minus all running costs (maintenance, taxes, insurance, mortgage interest, etc.) for one year, after income tax.',
      'A positive value is reported as passive income. A negative value is reported as an extra expense \u2014 never as negative passive income. The two cases never both fire in the same year.',
    ],
  },
  'realEstate.yearlyCosts': {
    title: 'Yearly running costs',
    text: [
      'For residences only: the total yearly cost of owning and running this home (utilities, taxes, maintenance, insurance, mortgage interest, etc.).',
      'Added directly to your expenses each year, on top of inflation-adjusted living costs. A residence produces no passive income.',
    ],
  },

  // ─────────────────────── PRIVATE BUSINESS ──────────────────────────────
  'privateBusiness.value': {
    title: 'Current valuation',
    text: [
      'Today\u2019s estimated valuation of the business. Each year, value is multiplied by (1 + value growth). On sale, the gain over the original valuation (captured at asset creation) is taxed as a capital gain.',
    ],
  },
  'privateBusiness.valueGrowthRate': {
    title: 'Value growth',
    text: [
      'The yearly rate at which the business\u2019s valuation grows. Applied as a constant geometric factor: value\u2032 = value \u00d7 (1 + this rate).',
    ],
  },
  'privateBusiness.yearlyDividend': {
    title: 'Yearly dividend',
    text: [
      'How much the business pays out to you each year, before tax. The current year\u2019s dividend is paid first; only afterwards is its growth applied for the next year.',
      'Net passive income contributed each year is dividend \u00d7 (1 \u2212 dividend tax).',
    ],
  },
  'privateBusiness.dividendGrowthRate': {
    title: 'Dividend growth',
    text: [
      'The yearly rate at which the dividend itself grows. After paying out year y\u2019s dividend, next year\u2019s amount is dividend \u00d7 (1 + this rate).',
    ],
  },
  'privateBusiness.dividendTaxRate': {
    title: 'Dividend tax',
    text: [
      'The tax rate applied to the dividend each year, before it is reported as passive income. Pre-filled from country defaults.',
    ],
  },

  // ─────────────────────────── PENSION ───────────────────────────────────
  'pension.yearlyAmount': {
    title: 'Yearly amount',
    text: [
      'Your expected yearly pension payout, expressed as net of tax (i.e. the take-home amount). Once it starts, it is reported directly as passive income.',
    ],
  },
  'pension.revaluationRate': {
    title: 'Revaluation rate',
    text: [
      'A yearly rate at which the pension amount grows after it has started paying. After n years of payouts it equals (yearly amount) \u00d7 (1 + this rate)^n.',
      'Common values: zero for a flat nominal pension, or your inflation rate if your pension is index-linked.',
    ],
  },
  'pension.startingAge': {
    title: 'Starting age',
    text: [
      'The age at which the pension begins paying. Before this age it produces nothing and adds zero to net worth.',
      'A pension never contributes to net worth (there is no balance to sell) \u2014 it is purely an income stream. The earliest pension start age is also the default retirement age used by Coast FIRE if no other retirement age is set.',
    ],
  },

  // ─────────────────────── PERSONAL DEBT ─────────────────────────────────
  'personalDebt.balance': {
    title: 'Balance',
    text: [
      'Outstanding debt today. Subtracted from net worth (debt contributes negatively).',
      'The balance is updated monthly within each simulated year: it grows by the monthly interest rate, then the monthly payment is applied. Once it reaches zero, no further payments accrue.',
    ],
  },
  'personalDebt.interestRate': {
    title: 'Interest rate',
    text: [
      'The yearly nominal interest rate on this debt. The model converts it to a monthly rate (yearly \u00f7 12) and compounds the balance monthly inside each simulated year.',
    ],
  },
  'personalDebt.monthlyPayment': {
    title: 'Monthly payment',
    text: [
      'How much you pay each month against this debt. Applied 12 times per simulated year, after the balance has grown by that month\u2019s interest. The final partial payment in the year that clears the debt is automatically reduced to the remaining balance.',
      'Debt payments are reported as a drag on cash flow \u2014 not as passive income or as an extra expense.',
    ],
  },
};

/**
 * Look up the help entry for a given (class, field) pair.
 *
 * @param {string} className - One of the eight class keys (e.g. "stocks").
 * @param {string} fieldKey - Field descriptor key (e.g. "avgReturnRate").
 * @returns {{ title: string, text: string|string[] } | null}
 */
export function getFieldHelp(className, fieldKey) {
  const specific = SPECIFIC[`${className}.${fieldKey}`];
  if (specific) return specific;
  const common = COMMON[fieldKey];
  if (common) return common;
  return null;
}
