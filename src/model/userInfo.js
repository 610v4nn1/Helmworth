/**
 * @fileoverview User info model for the retirement planner.
 * Contains the user's personal data: age, country, expenses, inflation assumptions.
 * @module src/model/userInfo
 */

/**
 * @typedef {Object} UserInfo
 * @property {number} age - Current age (default: 30)
 * @property {string} country - Country code for tax defaults (default: first country in countries.js)
 * @property {number} monthlyExpenses - Base monthly expenses in today's currency (default: 0)
 * @property {number} inflationRate - Expected yearly inflation rate *as a decimal* (default: 0.02 = 2%)
 */

/**
 * Default user info values.
 * @type {UserInfo}
 */
const DEFAULTS = {
  age: 30,
  country: '', // Will be set to first country when countries.js is loaded
  monthlyExpenses: 0,
  inflationRate: 0.02,
};

/**
 * Creates a UserInfo object with defaults and validation.
 * @param {Partial<UserInfo>} [input={}] - Partial user info to override defaults
 * @returns {UserInfo} A validated UserInfo object
 * @throws {Error} If age is less than 0 or inflationRate is outside [0, 1]
 * @example
 * // Default values
 * createUserInfo({}); // { age: 30, country: '', monthlyExpenses: 0, inflationRate: 0.02 }
 *
 * @example
 * // Custom values
 * createUserInfo({ age: 45, monthlyExpenses: 2000 });
 */
export function createUserInfo(input = {}) {
  const age = input.age ?? DEFAULTS.age;
  const country = input.country ?? DEFAULTS.country;
  const monthlyExpenses = input.monthlyExpenses ?? DEFAULTS.monthlyExpenses;
  const inflationRate = input.inflationRate ?? DEFAULTS.inflationRate;

  // Validation: age must be >= 0
  if (typeof age !== 'number' || age < 0 || !Number.isFinite(age)) {
    throw new Error('Age must be a non-negative number');
  }

  // Validation: inflationRate must be in [0, 1] (reasonable bounds)
  if (typeof inflationRate !== 'number' || inflationRate < 0 || inflationRate > 1) {
    throw new Error('Inflation rate must be a number between 0 and 1 (e.g., 0.02 for 2%)');
  }

  // Validation: monthlyExpenses must be >= 0
  if (typeof monthlyExpenses !== 'number' || monthlyExpenses < 0 || !Number.isFinite(monthlyExpenses)) {
    throw new Error('Monthly expenses must be a non-negative number');
  }

  return {
    age: Math.floor(age), // Age is an integer
    country: String(country),
    monthlyExpenses,
    inflationRate,
  };
}

/**
 * Validates an existing UserInfo object.
 * @param {UserInfo} userInfo - The user info to validate
 * @returns {{ok: boolean, errors: string[]}} Validation result with error messages if any
 */
export function validateUserInfo(userInfo) {
  const errors = [];

  if (typeof userInfo.age !== 'number' || userInfo.age < 0 || !Number.isFinite(userInfo.age)) {
    errors.push('Age must be a non-negative number');
  }

  if (typeof userInfo.inflationRate !== 'number' || userInfo.inflationRate < 0 || userInfo.inflationRate > 1) {
    errors.push('Inflation rate must be between 0 and 1');
  }

  if (typeof userInfo.monthlyExpenses !== 'number' || userInfo.monthlyExpenses < 0 || !Number.isFinite(userInfo.monthlyExpenses)) {
    errors.push('Monthly expenses must be a non-negative number');
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}
