/**
 * @fileoverview Helper for architectural tests: fetches a source file as plain
 * text via `fetch`, relative to the runner's location. Strips comments before
 * scanning so that things like `// localStorage example` don't trip the regex
 * checks.
 */

/**
 * Fetches a source file as plain text relative to the workspace root
 * (the runner is at `tests/runner.html`, so `path` is given relative to that —
 * e.g. `../src/state.js`).
 *
 * @param {string} path - Path relative to `tests/runner.html`
 * @returns {Promise<string>} Source text
 */
export async function fetchSource(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.text();
}

/**
 * Strips line and block comments from JS source so architectural regex checks
 * don't false-positive on doc comments.
 *
 * Naive but sufficient: it doesn't know about strings, but our regex
 * targets (e.g. `\bdocument\b`, `\bwindow\b`) are extremely unlikely to appear
 * inside a string literal in the calculation layer.
 *
 * @param {string} source
 * @returns {string} Source with comments removed
 */
export function stripComments(source) {
  // Block comments first (non-greedy match between slash-star and star-slash)
  let s = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Then line comments (slash-slash to end of line)
  s = s.replace(/\/\/.*$/gm, '');
  return s;
}
