/**
 * @fileoverview Asset model for the retirement planner.
 * Defines 8 asset classes: stocks, bonds, crypto, cash, realEstate,
 * privateBusiness, pension, personalDebt.
 * All factories produce immutable-style data objects (plain JS objects).
 * @module src/model/assets
 */

import { newId } from './id.js';

// ---------------------------------------------------------------------------
// LOT MANAGEMENT (for stocks, bonds, crypto)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Lot
 * @property {number} value - Current market value of the lot (currency)
 * @property {number} costBasis - Original purchase price (currency), starts equal to value
 * @property {number} year - Year the lot was acquired (0 = current year)
 */

/**
 * Creates a lot for a liquid asset.
 * @param {Object} params - Lot parameters
 * @param {number} params.value - Current market value
 * @param {number} [params.costBasis] - Cost basis (defaults to value)
 * @param {number} [params.year=0] - Year acquired (0 = current year)
 * @returns {Lot} A lot object
 * @example
 * createLot({ value: 10000, costBasis: 10000, year: 0 });
 */
export function createLot({ value, costBasis, year = 0 }) {
  if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
    throw new Error('Lot value must be a non-negative number');
  }
  const cb = costBasis ?? value;
  if (typeof cb !== 'number' || cb < 0 || !Number.isFinite(cb)) {
    throw new Error('Lot cost basis must be a non-negative number');
  }
  return {
    value,
    costBasis: cb,
    year,
  };
}

/**
 * @typedef {('stocks'|'bonds'|'crypto'|'cash'|'realEstate'|'privateBusiness'|'pension'|'personalDebt')} AssetClass
 */

// ---------------------------------------------------------------------------
// ASSET CLASS FACTORIES
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} StocksAsset
 * @property {string} id - Unique identifier
 * @property {string} name - User-provided label
 * @property {'stocks'} class - Asset class identifier
 * @property {Lot[]} lots - Array of purchase lots
 * @property {number} avgReturnRate - Expected yearly return *as a decimal* (e.g. 0.07 = 7%)
 * @property {number} yearlyContribution - Amount added each year (Standard scenario)
 * @property {number} contributionGrowthRate - Yearly growth applied to the contribution
 *   (decimal, e.g. 0.03 = 3%/y). At simulation year `y`, the contribution actually
 *   added is `yearlyContribution · (1 + contributionGrowthRate)^y`.
 * @property {number} capitalGainsTaxRate - Tax on capital gains *as a decimal* (e.g. 0.26 = 26%)
 */

/**
 * Creates a Stocks asset.
 * Stocks are liquid, positive, and have lots for HIFO tax optimization.
 * @param {Object} params - Stock parameters
 * @param {string} [params.name='Stocks'] - Asset label
 * @param {number} params.value - Initial market value (creates first lot)
 * @param {number} [params.costBasis=value] - Initial cost basis (defaults to value;
 *   set lower than value if the position already has unrealized gains).
 * @param {number} [params.avgReturnRate=0.07] - Yearly expected return (default: 7%)
 * @param {number} [params.yearlyContribution=0] - Yearly contribution amount
 * @param {number} [params.contributionGrowthRate=0] - Yearly growth of the contribution
 * @param {number} [params.capitalGainsTaxRate=0.26] - Capital gains tax rate
 * @returns {StocksAsset} A stocks asset object
 * @throws {Error} If value is missing or negative, or costBasis is negative
 * @example
 * createStocks({ name: 'VTI', value: 10000, costBasis: 8000, avgReturnRate: 0.08 });
 */
export function createStocks({
  name = 'Stocks',
  value,
  costBasis,
  avgReturnRate = 0.07,
  yearlyContribution = 0,
  contributionGrowthRate = 0,
  capitalGainsTaxRate = 0.26,
} = {}) {
  if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
    throw new Error('Stocks value must be a non-negative number');
  }

  return {
    id: newId(),
    name,
    class: 'stocks',
    lots: [createLot({ value, costBasis: costBasis ?? value, year: 0 })],
    avgReturnRate,
    yearlyContribution,
    contributionGrowthRate,
    capitalGainsTaxRate,
  };
}

/**
 * @typedef {Object} BondsAsset
 * @property {string} id - Unique identifier
 * @property {string} name - User-provided label
 * @property {'bonds'} class - Asset class identifier
 * @property {Lot[]} lots - Array of purchase lots
 * @property {number} yieldRate - Yearly cash payout as % of value (e.g. 0.04 = 4%)
 * @property {number} yearlyContribution - Amount added each year (Standard scenario)
 * @property {number} contributionGrowthRate - Yearly growth applied to the contribution
 *   (decimal). See StocksAsset for details.
 * @property {number} capitalGainsTaxRate - Tax on capital gains when sold
 * @property {number} yieldTaxRate - Tax on yield payouts (typically lower)
 */

/**
 * Creates a Bonds asset.
 * Bonds are liquid, positive, pay yield (passive income), value stays flat in v1.
 * @param {Object} params - Bond parameters
 * @param {string} [params.name='Bonds'] - Asset label
 * @param {number} params.value - Initial market value (creates first lot)
 * @param {number} [params.costBasis=value] - Initial cost basis (defaults to value)
 * @param {number} [params.yieldRate=0.04] - Yearly yield rate (default: 4%)
 * @param {number} [params.yearlyContribution=0] - Yearly contribution amount
 * @param {number} [params.contributionGrowthRate=0] - Yearly growth of the contribution
 * @param {number} [params.capitalGainsTaxRate=0.26] - Capital gains tax rate
 * @param {number} [params.yieldTaxRate=0.26] - Tax on yield payouts
 * @returns {BondsAsset} A bonds asset object
 * @throws {Error} If value is missing or negative
 * @example
 * createBonds({ name: 'Treasury Bonds', value: 50000, yieldRate: 0.035 });
 */
export function createBonds({
  name = 'Bonds',
  value,
  costBasis,
  yieldRate = 0.04,
  yearlyContribution = 0,
  contributionGrowthRate = 0,
  capitalGainsTaxRate = 0.26,
  yieldTaxRate = 0.26,
} = {}) {
  if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
    throw new Error('Bonds value must be a non-negative number');
  }

  return {
    id: newId(),
    name,
    class: 'bonds',
    lots: [createLot({ value, costBasis: costBasis ?? value, year: 0 })],
    yieldRate,
    yearlyContribution,
    contributionGrowthRate,
    capitalGainsTaxRate,
    yieldTaxRate,
  };
}

/**
 * @typedef {Object} CryptoAsset
 * @property {string} id - Unique identifier
 * @property {string} name - User-provided label
 * @property {'crypto'} class - Asset class identifier
 * @property {Lot[]} lots - Array of purchase lots
 * @property {number} avgReturnRate - Expected yearly return (can be volatile)
 * @property {number} yearlyContribution - Amount added each year (Standard scenario)
 * @property {number} contributionGrowthRate - Yearly growth applied to the contribution
 *   (decimal). See StocksAsset for details.
 * @property {number} capitalGainsTaxRate - Tax on capital gains
 */

/**
 * Creates a Crypto asset.
 * Crypto is liquid, positive, and has lots for HIFO tax optimization.
 * @param {Object} params - Crypto parameters
 * @param {string} [params.name='Crypto'] - Asset label
 * @param {number} params.value - Initial market value (creates first lot)
 * @param {number} [params.costBasis=value] - Initial cost basis (defaults to value)
 * @param {number} [params.avgReturnRate=0.10] - Yearly expected return (default: 10%)
 * @param {number} [params.yearlyContribution=0] - Yearly contribution amount
 * @param {number} [params.contributionGrowthRate=0] - Yearly growth of the contribution
 * @param {number} [params.capitalGainsTaxRate=0.26] - Capital gains tax rate
 * @returns {CryptoAsset} A crypto asset object
 * @throws {Error} If value is missing or negative
 * @example
 * createCrypto({ name: 'Bitcoin', value: 5000, avgReturnRate: 0.15 });
 */
export function createCrypto({
  name = 'Crypto',
  value,
  costBasis,
  avgReturnRate = 0.10,
  yearlyContribution = 0,
  contributionGrowthRate = 0,
  capitalGainsTaxRate = 0.26,
} = {}) {
  if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
    throw new Error('Crypto value must be a non-negative number');
  }

  return {
    id: newId(),
    name,
    class: 'crypto',
    lots: [createLot({ value, costBasis: costBasis ?? value, year: 0 })],
    avgReturnRate,
    yearlyContribution,
    contributionGrowthRate,
    capitalGainsTaxRate,
  };
}

/**
 * @typedef {Object} CashAsset
 * @property {string} id - Unique identifier
 * @property {string} name - User-provided label
 * @property {'cash'} class - Asset class identifier
 * @property {number} value - Current cash balance
 */

/**
 * Creates a Cash asset.
 * Cash is liquid, positive, no return rate, no contributions, no taxes.
 * @param {Object} params - Cash parameters
 * @param {string} [params.name='Cash'] - Asset label
 * @param {number} params.value - Current balance
 * @returns {CashAsset} A cash asset object
 * @throws {Error} If value is missing or negative
 * @example
 * createCash({ name: 'Emergency Fund', value: 10000 });
 */
export function createCash({ name = 'Cash', value } = {}) {
  if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
    throw new Error('Cash value must be a non-negative number');
  }

  return {
    id: newId(),
    name,
    class: 'cash',
    value,
  };
}

/**
 * @typedef {Object} SaleConversion
 * @property {string|null} targetAssetId - Existing asset to merge proceeds into, or null
 * @property {Object|null} inlineParams - Full asset spec for new asset if targetAssetId is null
 */

/**
 * @typedef {('investment'|'residence')} PropertyKind
 */

/**
 * @typedef {Object} RealEstateAsset
 * @property {string} id - Unique identifier
 * @property {string} name - User-provided label
 * @property {'realEstate'} class - Asset class identifier
 * @property {PropertyKind} propertyKind - 'investment' (rental, has cash flow) or 'residence' (own home, has costs)
 * @property {number} value - Current property value
 * @property {number} appreciationRate - Yearly value appreciation (e.g. 0.03 = 3%)
 * @property {number} mortgageBalance - Outstanding mortgage debt
 * @property {number} mortgageRepaymentRate - Yearly fraction of the outstanding mortgage that is repaid (e.g. 0.015 = 1.5%)
 * @property {number} cashFlow - (investment only) Yearly net cash flow (rent − costs − interest − tax,
 *   already netted by the user). Can be negative. Ignored for residence (forced to 0).
 * @property {number} yearlyCosts - (residence only) Yearly running costs added to expenses.
 *   Ignored for investment (forced to 0; user folds costs into cashFlow).
 * @property {number|null} saleYearsFromNow - If set, sell asset in N years
 * @property {number} saleFeesPct - Sale fees percentage (e.g. 0.05 = 5%)
 * @property {number} saleCapitalGainsTaxRate - Capital gains tax on sale
 * @property {SaleConversion|null} saleConversion - Conversion details on sale
 * @property {number} originalValue - Original purchase price (for CGT calculation)
 */

/**
 * Creates a Real Estate asset.
 *
 * Two kinds, distinguished by `propertyKind`:
 *   - `'investment'` (default): rental property. The user supplies a yearly
 *     `cashFlow` that already nets rent against costs/interest/tax. It is
 *     added to passive income each year (can be negative).
 *   - `'residence'`: primary home. No cash flow. `yearlyCosts` is added to
 *     yearly expenses; the property still appreciates and the mortgage is
 *     repaid over time.
 *
 * Both kinds: net worth contribution = `value − mortgageBalance`. Mortgage
 * has no interest rate field — each year the balance is reduced by
 * `mortgageRepaymentRate × mortgageBalance` (interest, if any, is the user's
 * concern and folded into `cashFlow` for investment properties).
 *
 * @param {Object} params - Real estate parameters
 * @param {string} [params.name='Real Estate'] - Asset label
 * @param {PropertyKind} [params.propertyKind='investment'] - Property kind
 * @param {number} params.value - Current property value
 * @param {number} [params.appreciationRate=0.03] - Yearly appreciation rate
 * @param {number} [params.mortgageBalance=0] - Outstanding mortgage balance
 * @param {number} [params.mortgageRepaymentRate=0] - Yearly fraction of the mortgage that is repaid (decimal, e.g. 0.015 = 1.5%)
 * @param {number} [params.cashFlow=0] - (investment) Yearly net cash flow
 * @param {number} [params.yearlyCosts=0] - (residence) Yearly running costs
 * @param {number|null} [params.saleYearsFromNow=null] - Years until sale
 * @param {number} [params.saleFeesPct=0] - Sale fees percentage
 * @param {number} [params.saleCapitalGainsTaxRate=0] - CGT on sale
 * @param {SaleConversion|null} [params.saleConversion=null] - Sale conversion details
 * @returns {RealEstateAsset} A real estate asset object
 * @throws {Error} If value is missing or negative, or propertyKind is invalid
 * @example
 * createRealEstate({
 *   name: 'Rental Apartment', propertyKind: 'investment',
 *   value: 300000, mortgageBalance: 100000, mortgageRepaymentRate: 0.05,
 *   cashFlow: 6000,
 * });
 * createRealEstate({
 *   name: 'My Home', propertyKind: 'residence',
 *   value: 400000, mortgageBalance: 250000, mortgageRepaymentRate: 0.04,
 *   yearlyCosts: 4000,
 * });
 */
export function createRealEstate({
  name = 'Real Estate',
  propertyKind = 'investment',
  value,
  appreciationRate = 0.03,
  mortgageBalance = 0,
  mortgageRepaymentRate = 0,
  cashFlow = 0,
  yearlyCosts = 0,
  saleYearsFromNow = null,
  saleFeesPct = 0,
  saleCapitalGainsTaxRate = 0,
  saleConversion = null,
} = {}) {
  if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
    throw new Error('Real estate value must be a non-negative number');
  }
  if (propertyKind !== 'investment' && propertyKind !== 'residence') {
    throw new Error(`Real estate propertyKind must be 'investment' or 'residence' (got ${propertyKind})`);
  }

  // Force-zero the field that doesn't apply to this kind, so consumers can
  // read either field unconditionally.
  const isInvestment = propertyKind === 'investment';
  return {
    id: newId(),
    name,
    class: 'realEstate',
    propertyKind,
    value,
    appreciationRate,
    mortgageBalance,
    mortgageRepaymentRate,
    cashFlow: isInvestment ? cashFlow : 0,
    yearlyCosts: isInvestment ? 0 : yearlyCosts,
    saleYearsFromNow,
    saleFeesPct,
    saleCapitalGainsTaxRate,
    saleConversion,
    originalValue: value, // Store original for CGT calculation
  };
}

/**
 * @typedef {Object} PrivateBusinessAsset
 * @property {string} id - Unique identifier
 * @property {string} name - User-provided label
 * @property {'privateBusiness'} class - Asset class identifier
 * @property {number} value - Current valuation
 * @property {number} valueGrowthRate - Yearly valuation growth
 * @property {number} yearlyDividend - Yearly dividend amount
 * @property {number} dividendGrowthRate - Yearly growth in dividend
 * @property {number} dividendTaxRate - Tax on dividends
 * @property {number|null} saleYearsFromNow - If set, sell in N years
 * @property {number} saleFeesPct - Sale fees percentage
 * @property {number} saleCapitalGainsTaxRate - CGT on sale
 * @property {SaleConversion|null} saleConversion - Conversion details on sale
 * @property {number} originalValue - Original valuation (for CGT calculation)
 */

/**
 * Creates a Private Business asset.
 * Private business is illiquid, positive, can pay dividends.
 * @param {Object} params - Private business parameters
 * @param {string} [params.name='Private Business'] - Asset label
 * @param {number} params.value - Current valuation
 * @param {number} [params.valueGrowthRate=0.05] - Valuation growth rate
 * @param {number} [params.yearlyDividend=0] - Yearly dividend amount
 * @param {number} [params.dividendGrowthRate=0.03] - Dividend growth rate
 * @param {number} [params.dividendTaxRate=0.26] - Dividend tax rate
 * @param {number|null} [params.saleYearsFromNow=null] - Years until sale
 * @param {number} [params.saleFeesPct=0] - Sale fees percentage
 * @param {number} [params.saleCapitalGainsTaxRate=0] - CGT on sale
 * @param {SaleConversion|null} [params.saleConversion=null] - Sale conversion details
 * @returns {PrivateBusinessAsset} A private business asset object
 * @throws {Error} If value is missing or negative
 * @example
 * createPrivateBusiness({
 *   name: 'My Startup',
 *   value: 200000,
 *   yearlyDividend: 10000
 * });
 */
export function createPrivateBusiness({
  name = 'Private Business',
  value,
  valueGrowthRate = 0.05,
  yearlyDividend = 0,
  dividendGrowthRate = 0.03,
  dividendTaxRate = 0.26,
  saleYearsFromNow = null,
  saleFeesPct = 0,
  saleCapitalGainsTaxRate = 0,
  saleConversion = null,
} = {}) {
  if (typeof value !== 'number' || value < 0 || !Number.isFinite(value)) {
    throw new Error('Private business value must be a non-negative number');
  }

  return {
    id: newId(),
    name,
    class: 'privateBusiness',
    value,
    valueGrowthRate,
    yearlyDividend,
    dividendGrowthRate,
    dividendTaxRate,
    saleYearsFromNow,
    saleFeesPct,
    saleCapitalGainsTaxRate,
    saleConversion,
    originalValue: value, // Store original for CGT calculation
  };
}

/**
 * @typedef {Object} PensionAsset
 * @property {string} id - Unique identifier
 * @property {string} name - User-provided label
 * @property {'pension'} class - Asset class identifier
 * @property {number} yearlyAmount - Yearly pension amount in today's currency
 * @property {number} revaluationRate - Yearly growth (typically tied to inflation)
 * @property {number} startingAge - Age at which pension begins (default: 67)
 */

/**
 * Creates a Pension asset.
 * Pension provides passive income starting at a specific age.
 * @param {Object} params - Pension parameters
 * @param {string} [params.name='Pension'] - Asset label
 * @param {number} params.yearlyAmount - Yearly pension amount
 * @param {number} [params.revaluationRate=0.02] - Revaluation rate (inflation-linked)
 * @param {number} [params.startingAge=67] - Age when pension starts
 * @returns {PensionAsset} A pension asset object
 * @throws {Error} If yearlyAmount is missing or negative
 * @example
 * createPension({
 *   name: 'State Pension',
 *   yearlyAmount: 20000,
 *   startingAge: 67
 * });
 */
export function createPension({
  name = 'Pension',
  yearlyAmount = 0,
  revaluationRate = 0.02,
  startingAge = 67,
} = {}) {
  if (typeof yearlyAmount !== 'number' || yearlyAmount < 0 || !Number.isFinite(yearlyAmount)) {
    throw new Error('Pension yearly amount must be a non-negative number');
  }

  return {
    id: newId(),
    name,
    class: 'pension',
    yearlyAmount,
    revaluationRate,
    startingAge,
  };
}

/**
 * @typedef {Object} PersonalDebtAsset
 * @property {string} id - Unique identifier
 * @property {string} name - User-provided label
 * @property {'personalDebt'} class - Asset class identifier
 * @property {number} balance - Outstanding debt balance (positive number)
 * @property {number} interestRate - Annual interest rate (e.g. 0.12 = 12%)
 * @property {number} monthlyPayment - Fixed monthly payment until paid off
 */

/**
 * Creates a Personal Debt asset.
 * Personal debt subtracts from net worth and has monthly payments.
 * @param {Object} params - Debt parameters
 * @param {string} [params.name='Personal Debt'] - Asset label
 * @param {number} params.balance - Outstanding balance
 * @param {number} [params.interestRate=0.05] - Annual interest rate
 * @param {number} [params.monthlyPayment=0] - Monthly payment amount
 * @returns {PersonalDebtAsset} A personal debt asset object
 * @throws {Error} If balance is missing or negative, or monthlyPayment is negative
 * @example
 * createPersonalDebt({
 *   name: 'Student Loan',
 *   balance: 10000,
 *   interestRate: 0.05,
 *   monthlyPayment: 300
 * });
 */
export function createPersonalDebt({
  name = 'Personal Debt',
  balance,
  interestRate = 0.05,
  monthlyPayment = 0,
} = {}) {
  if (typeof balance !== 'number' || balance < 0 || !Number.isFinite(balance)) {
    throw new Error('Personal debt balance must be a non-negative number');
  }
  if (typeof monthlyPayment !== 'number' || monthlyPayment < 0 || !Number.isFinite(monthlyPayment)) {
    throw new Error('Monthly payment must be a non-negative number');
  }

  return {
    id: newId(),
    name,
    class: 'personalDebt',
    balance,
    interestRate,
    monthlyPayment,
  };
}

// ---------------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Computes the net value of an asset (value minus liabilities).
 * For real estate: value - mortgageBalance
 * For personal debt: -balance (negative contribution to net worth)
 * For all others: returns the value directly
 * @param {Object} asset - Any asset object
 * @returns {number} Net contribution to net worth
 * @example
 * const re = createRealEstate({ value: 300000, mortgageBalance: 100000 });
 * assetNetValue(re); // 200000
 *
 * const debt = createPersonalDebt({ balance: 10000 });
 * assetNetValue(debt); // -10000
 */
export function assetNetValue(asset) {
  switch (asset.class) {
    case 'stocks':
      return asset.lots.reduce((sum, lot) => sum + lot.value, 0);
    case 'bonds':
      return asset.lots.reduce((sum, lot) => sum + lot.value, 0);
    case 'crypto':
      return asset.lots.reduce((sum, lot) => sum + lot.value, 0);
    case 'cash':
      return asset.value;
    case 'realEstate':
      return asset.value - asset.mortgageBalance;
    case 'privateBusiness':
      return asset.value;
    case 'pension':
      return 0; // Pension is not a stored asset, just income source
    case 'personalDebt':
      return -asset.balance;
    default:
      return 0;
  }
}

/**
 * Computes the total value of lots in a lot-bearing asset.
 * @param {Object} asset - Asset with lots (stocks, bonds, crypto)
 * @returns {number} Total value of all lots
 */
export function liquidValue(asset) {
  if (!asset.lots || !Array.isArray(asset.lots)) {
    return 0;
  }
  return asset.lots.reduce((sum, lot) => sum + lot.value, 0);
}

/**
 * Determines if an asset is liquid (can be sold for cash quickly).
 * Liquid assets: stocks, bonds, crypto, cash
 * Illiquid assets: realEstate, privateBusiness
 * Special: pension is considered liquid for income purposes but has no value to sell
 * Special: personalDebt is not an asset to sell
 * @param {Object} asset - Any asset object
 * @returns {boolean} True if the asset is considered liquid
 * @example
 * isLiquid(createStocks({ value: 10000 })); // true
 * isLiquid(createRealEstate({ value: 300000 })); // false
 */
export function isLiquid(asset) {
  switch (asset.class) {
    case 'stocks':
    case 'bonds':
    case 'crypto':
    case 'cash':
      return true;
    case 'realEstate':
    case 'privateBusiness':
    case 'pension':
    case 'personalDebt':
      return false;
    default:
      return false;
  }
}

/**
 * Validates an asset object.
 * @param {Object} asset - Asset to validate
 * @returns {{ok: boolean, errors: string[]}} Validation result
 * @example
 * const result = validateAsset({ class: 'stocks', lots: [] });
 * // result.ok === false, result.errors contains issues
 */
export function validateAsset(asset) {
  const errors = [];

  // Check required common fields
  if (!asset || typeof asset !== 'object') {
    return { ok: false, errors: ['Asset must be an object'] };
  }

  if (!asset.id || typeof asset.id !== 'string') {
    errors.push('Asset must have a string id');
  }

  if (!asset.name || typeof asset.name !== 'string') {
    errors.push('Asset must have a string name');
  }

  // Class-specific validation
  switch (asset.class) {
    case 'stocks':
    case 'bonds':
    case 'crypto':
      if (!Array.isArray(asset.lots) || asset.lots.length === 0) {
        errors.push(`${asset.class} must have at least one lot`);
      } else {
        asset.lots.forEach((lot, i) => {
          if (typeof lot.value !== 'number' || lot.value < 0) {
            errors.push(`Lot ${i} must have a non-negative value`);
          }
          if (typeof lot.costBasis !== 'number' || lot.costBasis < 0) {
            errors.push(`Lot ${i} must have a non-negative cost basis`);
          }
        });
      }
      break;

    case 'cash':
      if (typeof asset.value !== 'number' || asset.value < 0) {
        errors.push('Cash must have a non-negative value');
      }
      break;

    case 'realEstate':
      if (typeof asset.value !== 'number' || asset.value < 0) {
        errors.push('Real estate must have a non-negative value');
      }
      if (typeof asset.mortgageBalance !== 'number' || asset.mortgageBalance < 0) {
        errors.push('Real estate must have a non-negative mortgage balance');
      }
      if (asset.propertyKind !== 'investment' && asset.propertyKind !== 'residence') {
        errors.push("Real estate propertyKind must be 'investment' or 'residence'");
      }
      break;

    case 'privateBusiness':
      if (typeof asset.value !== 'number' || asset.value < 0) {
        errors.push('Private business must have a non-negative value');
      }
      break;

    case 'pension':
      if (typeof asset.yearlyAmount !== 'number' || asset.yearlyAmount < 0) {
        errors.push('Pension must have a non-negative yearly amount');
      }
      if (typeof asset.startingAge !== 'number' || asset.startingAge < 0) {
        errors.push('Pension must have a non-negative starting age');
      }
      break;

    case 'personalDebt':
      if (typeof asset.balance !== 'number' || asset.balance < 0) {
        errors.push('Personal debt must have a non-negative balance');
      }
      if (typeof asset.monthlyPayment !== 'number' || asset.monthlyPayment < 0) {
        errors.push('Personal debt must have a non-negative monthly payment');
      }
      break;

    default:
      errors.push(`Unknown asset class: ${asset.class}`);
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
