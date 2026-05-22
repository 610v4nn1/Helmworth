/**
 * @fileoverview Unit tests for the UI format helpers (percent / currency).
 * Even though these live in src/ui/, they are pure utilities and are tested
 * here alongside the data model since they form the engine↔UI conversion
 * boundary.
 */
import {
  formatPercent,
  parsePercent,
  formatCurrency,
  parseCurrency,
} from '../../src/ui/format.js';

export default function run({ test, assert, assertClose }) {
  // -------------------------------------------------------------------------
  // formatPercent
  // -------------------------------------------------------------------------
  test('TF.1: formatPercent(0.05) === "5.00%"', () => {
    assert(formatPercent(0.05) === '5.00%', `got ${formatPercent(0.05)}`);
  });

  test('TF.2: formatPercent(0.26375) rounds to "26.38%"', () => {
    assert(formatPercent(0.26375) === '26.38%', `got ${formatPercent(0.26375)}`);
  });

  test('TF.3: formatPercent honours digits option', () => {
    assert(formatPercent(0.05, { digits: 0 }) === '5%');
    assert(formatPercent(0.0725, { digits: 1 }) === '7.3%');
  });

  test('TF.4: formatPercent without symbol', () => {
    assert(formatPercent(0.05, { withSymbol: false }) === '5.00');
  });

  test('TF.5: formatPercent on 0 returns "0.00%"', () => {
    assert(formatPercent(0) === '0.00%');
  });

  test('TF.6: formatPercent on 1 returns "100.00%"', () => {
    assert(formatPercent(1) === '100.00%');
  });

  test('TF.7: formatPercent on NaN/undefined returns dash', () => {
    assert(formatPercent(NaN) === '—%');
    assert(formatPercent(undefined) === '—%');
  });

  // -------------------------------------------------------------------------
  // parsePercent
  // -------------------------------------------------------------------------
  test('TF.8: parsePercent("5%") === 0.05', () => {
    assertClose(parsePercent('5%'), 0.05, 1e-9);
  });

  test('TF.9: parsePercent("5") (no symbol) === 0.05', () => {
    assertClose(parsePercent('5'), 0.05, 1e-9);
  });

  test('TF.10: parsePercent handles whitespace and stray "%"', () => {
    assertClose(parsePercent('  5 % '), 0.05, 1e-9);
  });

  test('TF.11: parsePercent("26.375%") === 0.26375', () => {
    assertClose(parsePercent('26.375%'), 0.26375, 1e-9);
  });

  test('TF.12: parsePercent(numeric 7) === 0.07', () => {
    assertClose(parsePercent(7), 0.07, 1e-9);
  });

  test('TF.13: parsePercent("") returns NaN', () => {
    assert(Number.isNaN(parsePercent('')), 'empty string should be NaN');
  });

  test('TF.14: parsePercent("abc") returns NaN', () => {
    assert(Number.isNaN(parsePercent('abc')), 'non-numeric should be NaN');
  });

  test('TF.15: round-trip format ↔ parse preserves value', () => {
    const original = 0.07;
    const formatted = formatPercent(original, { digits: 4 });
    const parsed = parsePercent(formatted);
    assertClose(parsed, original, 1e-6);
  });

  // -------------------------------------------------------------------------
  // formatCurrency / parseCurrency
  // -------------------------------------------------------------------------
  test('TF.16: formatCurrency(1234567) === "1,234,567"', () => {
    assert(formatCurrency(1234567) === '1,234,567', `got ${formatCurrency(1234567)}`);
  });

  test('TF.17: formatCurrency with digits', () => {
    assert(formatCurrency(1234.5, { digits: 2 }) === '1,234.50');
  });

  test('TF.18: parseCurrency strips commas and spaces', () => {
    assertClose(parseCurrency('1,234,567'), 1234567, 1e-9);
    assertClose(parseCurrency('  1 234 567 '), 1234567, 1e-9);
  });

  test('TF.19: parseCurrency strips currency symbols', () => {
    assertClose(parseCurrency('$1,234.50'), 1234.5, 1e-9);
    assertClose(parseCurrency('€1,234'), 1234, 1e-9);
  });

  test('TF.20: parseCurrency on empty / non-numeric → NaN', () => {
    assert(Number.isNaN(parseCurrency('')));
    assert(Number.isNaN(parseCurrency('abc')));
  });
}
