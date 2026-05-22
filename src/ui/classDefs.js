/**
 * @fileoverview Per-class UI metadata: display name, Lucide icon, and the
 * list of editable fields each asset class exposes in forms / cards.
 *
 * Field descriptors:
 *   { key, label, type: 'currency'|'percent'|'number'|'integer'|'text'|'option',
 *     options?, default? (for new assets), tax?: true (means: pre-filled from country defaults) }
 *
 * @module src/ui/classDefs
 */

/**
 * The 8 asset classes in fixed display order (matches the "+" picker grid).
 * @type {Array<{key: string, label: string, icon: string, color: string}>}
 */
export const CLASSES = [
  { key: 'stocks',          label: 'Stocks',           icon: 'trending-up',        color: 'var(--class-stocks)' },
  { key: 'bonds',           label: 'Bonds',            icon: 'scroll-text',        color: 'var(--class-bonds)' },
  { key: 'crypto',          label: 'Crypto',           icon: 'circle-dollar-sign', color: 'var(--class-crypto)' },
  { key: 'cash',            label: 'Cash',             icon: 'banknote',           color: 'var(--class-cash)' },
  { key: 'realEstate',      label: 'Real Estate',      icon: 'building-2',         color: 'var(--class-realEstate)' },
  { key: 'privateBusiness', label: 'Private Business', icon: 'store',              color: 'var(--class-privateBusiness)' },
  { key: 'pension',         label: 'Pension',          icon: 'shield-check',       color: 'var(--class-pension)' },
  { key: 'personalDebt',    label: 'Personal Debt',    icon: 'credit-card',        color: 'var(--class-personalDebt)' },
];

/** Look up a class definition by key. */
export function getClassDef(key) {
  return CLASSES.find((c) => c.key === key);
}

/**
 * Field descriptors per class. Used by both the create-asset form and the
 * inline-edit panel on each asset card.
 */
export const FIELDS = {
  stocks: [
    { key: 'name',                label: 'Name',                 type: 'text',     default: 'Stocks',     full: true },
    { key: 'value',               label: 'Current value',        type: 'currency', default: 0, required: true },
    { key: 'avgReturnRate',       label: 'Avg yearly return',    type: 'percent',  default: 0.07 },
    { key: 'yearlyContribution',  label: 'Yearly contribution',  type: 'currency', default: 0 },
    { key: 'capitalGainsTaxRate', label: 'Capital gains tax',    type: 'percent',  default: 0.26, tax: true },
  ],
  bonds: [
    { key: 'name',                label: 'Name',                 type: 'text',     default: 'Bonds',      full: true },
    { key: 'value',               label: 'Current value',        type: 'currency', default: 0, required: true },
    { key: 'yieldRate',           label: 'Yearly yield',         type: 'percent',  default: 0.04 },
    { key: 'yearlyContribution',  label: 'Yearly contribution',  type: 'currency', default: 0 },
    { key: 'capitalGainsTaxRate', label: 'Capital gains tax',    type: 'percent',  default: 0.26, tax: true },
    { key: 'yieldTaxRate',        label: 'Yield tax',            type: 'percent',  default: 0.26, tax: true },
  ],
  crypto: [
    { key: 'name',                label: 'Name',                 type: 'text',     default: 'Crypto',     full: true },
    { key: 'value',               label: 'Current value',        type: 'currency', default: 0, required: true },
    { key: 'avgReturnRate',       label: 'Avg yearly return',    type: 'percent',  default: 0.10 },
    { key: 'yearlyContribution',  label: 'Yearly contribution',  type: 'currency', default: 0 },
    { key: 'capitalGainsTaxRate', label: 'Capital gains tax',    type: 'percent',  default: 0.26, tax: true },
  ],
  cash: [
    { key: 'name',  label: 'Name',           type: 'text',     default: 'Cash', full: true },
    { key: 'value', label: 'Current balance', type: 'currency', default: 0, required: true },
  ],
  realEstate: [
    { key: 'name',                       label: 'Name',                 type: 'text',     default: 'Property', full: true },
    { key: 'propertyKind',               label: 'Property kind',        type: 'option',   default: 'investment', full: true,
      options: [
        { value: 'investment', label: 'Investment property (rental, has cash flow)' },
        { value: 'residence',  label: 'Residence (own home, has running costs)' },
      ] },
    { key: 'value',                      label: 'Current value',        type: 'currency', default: 0, required: true },
    { key: 'appreciationRate',           label: 'Appreciation',         type: 'percent',  default: 0.03 },
    { key: 'mortgageBalance',            label: 'Outstanding mortgage', type: 'currency', default: 0 },
    { key: 'mortgageRepaymentRate',      label: 'Yearly debt reduction', type: 'percent',  default: 0 },
    { key: 'cashFlow',                   label: 'Yearly cash flow (after costs & tax)', type: 'currency', default: 0, signed: true,
      showWhen: { propertyKind: 'investment' } },
    { key: 'yearlyCosts',                label: 'Yearly running costs', type: 'currency', default: 0,
      showWhen: { propertyKind: 'residence' } },
    { key: 'saleYearsFromNow',           label: 'Sale years from now',  type: 'integer', default: '' },
    { key: 'saleFeesPct',                label: 'Sale fees',            type: 'percent', default: 0 },
    { key: 'saleCapitalGainsTaxRate',    label: 'Sale CGT',             type: 'percent', default: 0, tax: true },
    { key: 'saleConversion',             label: 'On sale, reinvest proceeds in', type: 'saleConversion', default: null, full: true },
  ],
  privateBusiness: [
    { key: 'name',                    label: 'Name',                  type: 'text',     default: 'Business', full: true },
    { key: 'value',                   label: 'Current valuation',     type: 'currency', default: 0, required: true },
    { key: 'valueGrowthRate',         label: 'Value growth',          type: 'percent',  default: 0.05 },
    { key: 'yearlyDividend',          label: 'Yearly dividend',       type: 'currency', default: 0 },
    { key: 'dividendGrowthRate',      label: 'Dividend growth',       type: 'percent',  default: 0.03 },
    { key: 'dividendTaxRate',         label: 'Dividend tax',          type: 'percent',  default: 0.26, tax: true },
    { key: 'saleYearsFromNow',        label: 'Sale years from now',   type: 'integer', default: '' },
    { key: 'saleFeesPct',             label: 'Sale fees',             type: 'percent', default: 0 },
    { key: 'saleCapitalGainsTaxRate', label: 'Sale CGT',              type: 'percent', default: 0, tax: true },
    { key: 'saleConversion',          label: 'On sale, reinvest proceeds in', type: 'saleConversion', default: null, full: true },
  ],
  pension: [
    { key: 'name',             label: 'Name',              type: 'text',     default: 'Pension', full: true },
    { key: 'yearlyAmount',     label: 'Yearly amount',     type: 'currency', default: 0, required: true },
    { key: 'revaluationRate',  label: 'Revaluation rate',  type: 'percent',  default: 0.02 },
    { key: 'startingAge',      label: 'Starting age',      type: 'integer',  default: 67 },
  ],
  personalDebt: [
    { key: 'name',           label: 'Name',           type: 'text',     default: 'Debt', full: true },
    { key: 'balance',        label: 'Balance',        type: 'currency', default: 0, required: true },
    { key: 'interestRate',   label: 'Interest rate',  type: 'percent',  default: 0.05 },
    { key: 'monthlyPayment', label: 'Monthly payment', type: 'currency', default: 0 },
  ],
};

/** Mapping from class → factory function name (in src/model/assets.js). */
export const FACTORY_NAMES = {
  stocks:          'createStocks',
  bonds:           'createBonds',
  crypto:          'createCrypto',
  cash:            'createCash',
  realEstate:      'createRealEstate',
  privateBusiness: 'createPrivateBusiness',
  pension:         'createPension',
  personalDebt:    'createPersonalDebt',
};

/**
 * Mapping from class → tax-field key → country-defaults key.
 * Used by the form to pre-fill tax fields when the country changes.
 */
export const TAX_FIELD_MAP = {
  stocks: {
    capitalGainsTaxRate: 'stocksCapitalGainsTax',
  },
  bonds: {
    capitalGainsTaxRate: 'bondsCapitalGainsTax',
    yieldTaxRate:        'bondsYieldTax',
  },
  crypto: {
    capitalGainsTaxRate: 'cryptoCapitalGainsTax',
  },
  realEstate: {
    saleCapitalGainsTaxRate: 'realEstateSaleCapitalGainsTax',
  },
  privateBusiness: {
    dividendTaxRate:         'privateBusinessDividendTax',
    saleCapitalGainsTaxRate: 'privateBusinessSaleCapitalGainsTax',
  },
  cash: {},
  pension: {},
  personalDebt: {},
};
