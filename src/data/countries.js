/**
 * @fileoverview EU country tax defaults for the retirement planner.
 * Contains default tax rates for each asset class by country.
 * All rates are stored as *decimals* (e.g., 0.26 = 26%).
 * @module src/data/countries
 */

/**
 * @typedef {Object} CountryDefaults
 * @property {number} stocksCapitalGainsTax - Tax on stock capital gains
 * @property {number} bondsCapitalGainsTax - Tax on bond capital gains
 * @property {number} bondsYieldTax - Tax on bond yield payouts
 * @property {number} cryptoCapitalGainsTax - Tax on crypto capital gains
 * @property {number} realEstateRentalTax - Tax on net rental income
 * @property {number} realEstateSaleCapitalGainsTax - CGT on real estate sale
 * @property {number} privateBusinessDividendTax - Tax on private business dividends
 * @property {number} privateBusinessSaleCapitalGainsTax - CGT on business sale
 */

/**
 * @typedef {Object} Country
 * @property {string} code - ISO 3166-1 alpha-2 country code
 * @property {string} name - Country display name
 * @property {CountryDefaults} defaults - Default tax rates for this country
 */

/**
 * List of EU countries with their default tax rates.
 * Rates are approximations for planning purposes and should not be considered
 * legal or financial advice. Users can override per-asset.
 * @type {Country[]}
 */
export const countries = [
  {
    code: 'DE',
    name: 'Germany',
    defaults: {
      stocksCapitalGainsTax: 0.26375, // Abgeltungsteuer + solidarity surcharge
      bondsCapitalGainsTax: 0.26375,
      bondsYieldTax: 0.26375,
      cryptoCapitalGainsTax: 0.26375, // Same as stocks since 2021
      realEstateRentalTax: 0.42, // Personal income tax rate (varies)
      realEstateSaleCapitalGainsTax: 0.0, // Exempt after 10 years
      privateBusinessDividendTax: 0.26375,
      privateBusinessSaleCapitalGainsTax: 0.30, // Varies
    },
  },
  {
    code: 'FR',
    name: 'France',
    defaults: {
      stocksCapitalGainsTax: 0.30, // Flat tax (PFU)
      bondsCapitalGainsTax: 0.30,
      bondsYieldTax: 0.30,
      cryptoCapitalGainsTax: 0.30,
      realEstateRentalTax: 0.30, // After allowances
      realEstateSaleCapitalGainsTax: 0.25, // After allowances
      privateBusinessDividendTax: 0.30,
      privateBusinessSaleCapitalGainsTax: 0.25,
    },
  },
  {
    code: 'IT',
    name: 'Italy',
    defaults: {
      stocksCapitalGainsTax: 0.26,
      bondsCapitalGainsTax: 0.125, // Government bonds lower rate
      bondsYieldTax: 0.125,
      cryptoCapitalGainsTax: 0.26,
      realEstateRentalTax: 0.21, // Cedolare secca
      realEstateSaleCapitalGainsTax: 0.26,
      privateBusinessDividendTax: 0.26,
      privateBusinessSaleCapitalGainsTax: 0.26,
    },
  },
  {
    code: 'ES',
    name: 'Spain',
    defaults: {
      stocksCapitalGainsTax: 0.28, // Top marginal rate (varies by region)
      bondsCapitalGainsTax: 0.28,
      bondsYieldTax: 0.19,
      cryptoCapitalGainsTax: 0.28,
      realEstateRentalTax: 0.19, // Flat with allowance
      realEstateSaleCapitalGainsTax: 0.23, // Progressive
      privateBusinessDividendTax: 0.28,
      privateBusinessSaleCapitalGainsTax: 0.23,
    },
  },
  {
    code: 'NL',
    name: 'Netherlands',
    defaults: {
      stocksCapitalGainsTax: 0.0, // Box 3 deemed return
      bondsCapitalGainsTax: 0.0,
      bondsYieldTax: 0.0, // Actual yield not taxed separately
      cryptoCapitalGainsTax: 0.0, // Box 3
      realEstateRentalTax: 0.37, // Box 3 effective rate (approx)
      realEstateSaleCapitalGainsTax: 0.0, // Own home exemption
      privateBusinessDividendTax: 0.15,
      privateBusinessSaleCapitalGainsTax: 0.0, // Various exemptions
    },
  },
  {
    code: 'IE',
    name: 'Ireland',
    defaults: {
      stocksCapitalGainsTax: 0.33, // CGT rate
      bondsCapitalGainsTax: 0.33,
      bondsYieldTax: 0.20, // Deposit interest retention tax
      cryptoCapitalGainsTax: 0.33,
      realEstateRentalTax: 0.40, // Income tax + USC + PRSI
      realEstateSaleCapitalGainsTax: 0.33,
      privateBusinessDividendTax: 0.25, // Dividend witholding
      privateBusinessSaleCapitalGainsTax: 0.33,
    },
  },
  {
    code: 'PT',
    name: 'Portugal',
    defaults: {
      stocksCapitalGainsTax: 0.28,
      bondsCapitalGainsTax: 0.28,
      bondsYieldTax: 0.28,
      cryptoCapitalGainsTax: 0.28,
      realEstateRentalTax: 0.28, // Flat rate
      realEstateSaleCapitalGainsTax: 0.28,
      privateBusinessDividendTax: 0.28,
      privateBusinessSaleCapitalGainsTax: 0.28,
    },
  },
  {
    code: 'BE',
    name: 'Belgium',
    defaults: {
      stocksCapitalGainsTax: 0.30, // Stock transaction tax on transactions
      bondsCapitalGainsTax: 0.0, // No capital gains tax on bonds
      bondsYieldTax: 0.30,
      cryptoCapitalGainsTax: 0.0, // No specific tax
      realEstateRentalTax: 0.25, // Regional variation
      realEstateSaleCapitalGainsTax: 0.0, // Capital gains exempt after 5 years
      privateBusinessDividendTax: 0.30,
      privateBusinessSaleCapitalGainsTax: 0.0, // Various exemptions
    },
  },
  {
    code: 'AT',
    name: 'Austria',
    defaults: {
      stocksCapitalGainsTax: 0.275,
      bondsCapitalGainsTax: 0.275,
      bondsYieldTax: 0.275,
      cryptoCapitalGainsTax: 0.275, // Since 2022
      realEstateRentalTax: 0.275, // Flat rate option
      realEstateSaleCapitalGainsTax: 0.30, // Speculation tax
      privateBusinessDividendTax: 0.275,
      privateBusinessSaleCapitalGainsTax: 0.275,
    },
  },
  {
    code: 'FI',
    name: 'Finland',
    defaults: {
      stocksCapitalGainsTax: 0.30, // Up to 34% on high gains
      bondsCapitalGainsTax: 0.30,
      bondsYieldTax: 0.30,
      cryptoCapitalGainsTax: 0.30,
      realEstateRentalTax: 0.30, // Capital income tax
      realEstateSaleCapitalGainsTax: 0.30, // 85% gain taxable
      privateBusinessDividendTax: 0.30,
      privateBusinessSaleCapitalGainsTax: 0.30,
    },
  },
  {
    code: 'SE',
    name: 'Sweden',
    defaults: {
      stocksCapitalGainsTax: 0.30,
      bondsCapitalGainsTax: 0.30,
      bondsYieldTax: 0.30,
      cryptoCapitalGainsTax: 0.30,
      realEstateRentalTax: 0.22, // Capital gains on rental
      realEstateSaleCapitalGainsTax: 0.22, // Capital gains tax
      privateBusinessDividendTax: 0.30,
      privateBusinessSaleCapitalGainsTax: 0.22,
    },
  },
  {
    code: 'DK',
    name: 'Denmark',
    defaults: {
      stocksCapitalGainsTax: 0.42, // Capital income tax
      bondsCapitalGainsTax: 0.42,
      bondsYieldTax: 0.27, // Lower rate for interest
      cryptoCapitalGainsTax: 0.42, // Up to 52% for high gains
      realEstateRentalTax: 0.25, // After deductions
      realEstateSaleCapitalGainsTax: 0.0, // Owner-occupied exempt
      privateBusinessDividendTax: 0.27,
      privateBusinessSaleCapitalGainsTax: 0.22,
    },
  },
  {
    code: 'GR',
    name: 'Greece',
    defaults: {
      stocksCapitalGainsTax: 0.15,
      bondsCapitalGainsTax: 0.15,
      bondsYieldTax: 0.15,
      cryptoCapitalGainsTax: 0.15,
      realEstateRentalTax: 0.15,
      realEstateSaleCapitalGainsTax: 0.15,
      privateBusinessDividendTax: 0.15,
      privateBusinessSaleCapitalGainsTax: 0.15,
    },
  },
  {
    code: 'PL',
    name: 'Poland',
    defaults: {
      stocksCapitalGainsTax: 0.19, // Belka tax
      bondsCapitalGainsTax: 0.19,
      bondsYieldTax: 0.19,
      cryptoCapitalGainsTax: 0.19,
      realEstateRentalTax: 0.0, // Flat deduction method
      realEstateSaleCapitalGainsTax: 0.19,
      privateBusinessDividendTax: 0.19,
      privateBusinessSaleCapitalGainsTax: 0.19,
    },
  },
  {
    code: 'CZ',
    name: 'Czechia',
    defaults: {
      stocksCapitalGainsTax: 0.15, // Dividend tax rate
      bondsCapitalGainsTax: 0.15,
      bondsYieldTax: 0.15,
      cryptoCapitalGainsTax: 0.15,
      realEstateRentalTax: 0.15,
      realEstateSaleCapitalGainsTax: 0.0, // After 5 years exempt
      privateBusinessDividendTax: 0.15,
      privateBusinessSaleCapitalGainsTax: 0.0, // Exempt after 5 years
    },
  },
];

/**
 * Gets a country by its code.
 * @param {string} code - ISO 3166-1 alpha-2 country code
 * @returns {Country|undefined} The country object, or undefined if not found
 */
export function getCountryByCode(code) {
  return countries.find((c) => c.code === code);
}

/**
 * Gets the default tax rates for a country.
 * @param {string} code - ISO 3166-1 alpha-2 country code
 * @returns {CountryDefaults|null} The defaults, or null if country not found
 */
export function getDefaultsByCountry(code) {
  const country = getCountryByCode(code);
  return country ? country.defaults : null;
}

/**
 * The default country (first in the list). Useful for initialization.
 * @type {Country}
 */
export const defaultCountry = countries[0];

/**
 * Gets a list of country codes for dropdowns.
 * @returns {Array<{code: string, name: string}>} Simplified country list
 */
export function getCountryOptions() {
  return countries.map((c) => ({ code: c.code, name: c.name }));
}
