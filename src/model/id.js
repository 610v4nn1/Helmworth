/**
 * @fileoverview UUID generator for asset identification.
 * Uses crypto.randomUUID() if available, with a fallback implementation.
 * @module src/model/id
 */

/**
 * Generates a unique identifier (UUID v4).
 * Uses the Web Crypto API if available, otherwise falls back to a
 * pseudo-random UUID generator.
 * @returns {string} A UUID string (e.g. "550e8400-e29b-41d4-a716-446655440000")
 */
export function newId() {
  // Prefer the standard crypto.randomUUID() if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: generate a pseudo-random UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
