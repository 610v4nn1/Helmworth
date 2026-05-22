/**
 * @fileoverview Display formatting helpers for the UI layer.
 *
 * Rule of the codebase:
 *   - The calculation layer stores rates as DECIMALS (0.05 = 5%).
 *   - The UI layer ALWAYS displays and accepts rates as PERCENTAGES (5%, not 0.05).
 *
 * These helpers are the single conversion boundary between the two.
 * @module src/ui/format
 */

// ---------------------------------------------------------------------------
// PERCENTAGE FORMATTING / PARSING
// ---------------------------------------------------------------------------

/**
 * Formats a decimal rate as a percentage string for display.
 *
 * Uses a precision-safe rounding step (`Math.round(x · 10^d) / 10^d`) before
 * `toFixed` so that values like `0.0725 → 7.3 %` are not derailed by IEEE-754
 * representation error (`0.0725 · 100` is actually 7.249999999999999).
 *
 * @param {number} decimal - Rate as decimal (0.05 = 5%)
 * @param {Object} [opts]
 * @param {number} [opts.digits=2] - Decimal places to show
 * @param {boolean} [opts.withSymbol=true] - Append "%" symbol
 * @returns {string} Formatted percentage (e.g. "5.00%")
 * @example
 * formatPercent(0.05);                   // "5.00%"
 * formatPercent(0.26375);                // "26.38%"
 * formatPercent(0.0725, { digits: 1 });  // "7.3%"
 * formatPercent(0.05, { digits: 0 });    // "5%"
 * formatPercent(0.05, { withSymbol: false }); // "5.00"
 */
export function formatPercent(decimal, { digits = 2, withSymbol = true } = {}) {
  if (typeof decimal !== 'number' || !Number.isFinite(decimal)) {
    return withSymbol ? '—%' : '—';
  }
  // Multiply, then strip IEEE-754 representation noise by re-parsing at 12
  // significant digits — this turns 7.249999999999999 back into 7.25 before
  // we round to the requested precision.
  const pctNoisy = decimal * 100;
  const pctClean = Number.parseFloat(pctNoisy.toPrecision(12));
  const factor = Math.pow(10, digits);
  const rounded = Math.round(pctClean * factor) / factor;
  const str = rounded.toFixed(digits);
  return withSymbol ? `${str}%` : str;
}

/**
 * Parses a percentage string (or number) into a decimal rate.
 * Accepts "5", "5%", " 5 % ", or the numeric 5 — all return 0.05.
 * Returns NaN if the input cannot be parsed.
 * @param {string|number} input - The user input
 * @returns {number} Decimal rate (e.g. 0.05 for "5%")
 * @example
 * parsePercent("5%");     // 0.05
 * parsePercent("26.375"); // 0.26375
 * parsePercent(7);        // 0.07
 * parsePercent("");       // NaN
 */
export function parsePercent(input) {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? input / 100 : NaN;
  }
  if (typeof input !== 'string') return NaN;

  const trimmed = input.trim().replace('%', '').trim();
  if (trimmed === '') return NaN;

  const num = Number(trimmed);
  return Number.isFinite(num) ? num / 100 : NaN;
}

// ---------------------------------------------------------------------------
// CURRENCY FORMATTING
// ---------------------------------------------------------------------------

/**
 * Formats a currency amount with thousands separators.
 * Currency symbol is intentionally omitted (the app is currency-agnostic in v1).
 * @param {number} amount - Amount to format
 * @param {Object} [opts]
 * @param {number} [opts.digits=0] - Decimal places to show
 * @returns {string} Formatted amount (e.g. "1,234,567")
 * @example
 * formatCurrency(1234567);             // "1,234,567"
 * formatCurrency(1234.5, { digits:2 }); // "1,234.50"
 */
export function formatCurrency(amount, { digits = 0 } = {}) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Formats a currency amount in a compact form using K/M/B/T suffixes.
 * Useful for chart axis ticks where space is tight.
 *
 * Negative values are formatted with a leading "−" (Unicode minus).
 * Values below 1,000 use {@link formatCurrency} (no suffix).
 *
 * @param {number} amount - Amount to format
 * @param {Object} [opts]
 * @param {number} [opts.digits=1] - Decimal places to show on the suffixed value
 * @returns {string} Formatted amount (e.g. "1.2M", "850K", "1.5B")
 * @example
 * formatCurrencyCompact(1_000_000);      // "1M"
 * formatCurrencyCompact(1_234_567);      // "1.2M"
 * formatCurrencyCompact(850_000);        // "850K"
 * formatCurrencyCompact(2_500_000_000);  // "2.5B"
 * formatCurrencyCompact(-1_500_000);     // "−1.5M"
 * formatCurrencyCompact(750);            // "750"
 */
export function formatCurrencyCompact(amount, { digits = 1 } = {}) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  if (amount === 0) return '0';

  const sign = amount < 0 ? '−' : '';
  const abs = Math.abs(amount);

  const tiers = [
    { value: 1e12, suffix: 'T' },
    { value: 1e9,  suffix: 'B' },
    { value: 1e6,  suffix: 'M' },
    { value: 1e3,  suffix: 'K' },
  ];

  for (const tier of tiers) {
    if (abs >= tier.value) {
      const scaled = abs / tier.value;
      // Use no decimals when the scaled value is an integer (e.g. "1M" not "1.0M").
      const d = Number.isInteger(scaled) ? 0 : digits;
      const factor = Math.pow(10, d);
      const rounded = Math.round(scaled * factor) / factor;
      // Strip trailing ".0" that toFixed would re-introduce in edge cases.
      const str = Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(d);
      return `${sign}${str}${tier.suffix}`;
    }
  }

  // < 1,000 — fall back to plain formatting (no suffix).
  return `${sign}${formatCurrency(abs, { digits: 0 })}`;
}

/**
 * Parses a currency string into a number.
 * Strips spaces, currency symbols ($€£¥), and thousands separators.
 * @param {string|number} input - The user input
 * @returns {number} The numeric value, or NaN if unparseable
 * @example
 * parseCurrency("1,234,567"); // 1234567
 * parseCurrency("$1,234.50"); // 1234.5
 */
export function parseCurrency(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  if (typeof input !== 'string') return NaN;

  const cleaned = input.replace(/[\s$€£¥,]/g, '').trim();
  if (cleaned === '') return NaN;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : NaN;
}
