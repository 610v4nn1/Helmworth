/**
 * @fileoverview Test assertion utilities for browser-based unit tests.
 * Provides minimal assertion functions for the calculation layer tests.
 */

/**
 * Asserts that a condition is truthy. Throws an Error with the message if not.
 * @param {boolean} condition - The condition to assert
 * @param {string} [message='Assertion failed'] - Error message on failure
 * @throws {Error} If condition is falsy
 */
export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Asserts that two numbers are equal within a tolerance.
 * Useful for floating-point comparisons.
 * @param {number} actual - The actual value
 * @param {number} expected - The expected value
 * @param {number} [epsilon=0.0001] - Tolerance for comparison
 * @param {string} [message] - Additional context for the error
 * @throws {Error} If values differ by more than epsilon
 */
export function assertClose(actual, expected, epsilon = 0.0001, message = '') {
  const diff = Math.abs(actual - expected);
  const pass = diff <= epsilon;
  if (!pass) {
    const msg = message
      ? `${message}: expected ${expected}, got ${actual} (diff: ${diff})`
      : `Expected ${expected}, got ${actual} (diff: ${diff})`;
    throw new Error(msg);
  }
}

/**
 * Asserts that two values are deeply equal via JSON serialization.
 * @param {*} actual - The actual value
 * @param {*} expected - The expected value
 * @param {string} [message] - Additional context for the error
 * @throws {Error} If values are not deeply equal
 */
export function assertDeepEqual(actual, expected, message = '') {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    const msg = message
      ? `${message}\nExpected: ${expectedJson}\nActual:   ${actualJson}`
      : `Deep equality failed.\nExpected: ${expectedJson}\nActual:   ${actualJson}`;
    throw new Error(msg);
  }
}

/**
 * Asserts that a function throws an error.
 * @param {Function} fn - Function to execute
 * @param {string} [message] - Additional context for the error
 * @throws {Error} If the function does not throw
 */
export function assertThrows(fn, message = '') {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || 'Expected function to throw, but it did not');
  }
}
