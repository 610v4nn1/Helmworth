/**
 * @fileoverview Inline SVG icon registry. Replaces the previous Lucide
 * CDN-based mechanism so icons render synchronously and reliably without
 * any network dependency.
 *
 * Icons are sourced from Lucide (MIT-licensed, https://lucide.dev) and
 * inlined here as plain path data. Adding a new icon: copy its node
 * descriptor (the array of [tag, attrs] tuples) from the Lucide bundle
 * or from `lucide.dev/icons/<name>` and add an entry below.
 *
 * @module src/ui/icons
 */

/**
 * Map of icon-name (kebab-case) → array of [tag, attrs] tuples that
 * make up the icon's geometry.
 */
const ICONS = {
  'trending-up': [
    ['path', { d: 'M16 7h6v6' }],
    ['path', { d: 'm22 7-8.5 8.5-5-5L2 17' }],
  ],
  'scroll-text': [
    ['path', { d: 'M15 12h-5' }],
    ['path', { d: 'M15 8h-5' }],
    ['path', { d: 'M19 17V5a2 2 0 0 0-2-2H4' }],
    ['path', { d: 'M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3' }],
  ],
  'circle-dollar-sign': [
    ['circle', { cx: '12', cy: '12', r: '10' }],
    ['path', { d: 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8' }],
    ['path', { d: 'M12 18V6' }],
  ],
  'banknote': [
    ['rect', { width: '20', height: '12', x: '2', y: '6', rx: '2' }],
    ['circle', { cx: '12', cy: '12', r: '2' }],
    ['path', { d: 'M6 12h.01M18 12h.01' }],
  ],
  'building-2': [
    ['path', { d: 'M10 12h4' }],
    ['path', { d: 'M10 8h4' }],
    ['path', { d: 'M14 21v-3a2 2 0 0 0-4 0v3' }],
    ['path', { d: 'M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2' }],
    ['path', { d: 'M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16' }],
  ],
  'store': [
    ['path', { d: 'M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5' }],
    ['path', { d: 'M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244' }],
    ['path', { d: 'M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05' }],
  ],
  'shield-check': [
    ['path', { d: 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' }],
    ['path', { d: 'm9 12 2 2 4-4' }],
  ],
  'credit-card': [
    ['rect', { width: '20', height: '14', x: '2', y: '5', rx: '2' }],
    ['line', { x1: '2', x2: '22', y1: '10', y2: '10' }],
  ],
};

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Default attributes applied to every icon SVG. Mirrors Lucide's defaults so
 * existing CSS that targets `.lucide` / `.icon` keeps working.
 */
const DEFAULT_SVG_ATTRS = {
  xmlns: SVG_NS,
  width: '24',
  height: '24',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '2',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

/**
 * Build an `<svg>` element for the given icon name.
 *
 * @param {string} name - kebab-case icon name (e.g. "trending-up")
 * @param {string} [className='icon'] - extra class to apply to the SVG
 * @returns {SVGElement}
 */
export function createIcon(name, className = 'icon') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (const [k, v] of Object.entries(DEFAULT_SVG_ATTRS)) {
    svg.setAttribute(k, v);
  }
  svg.setAttribute('class', `lucide lucide-${name} ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');

  const node = ICONS[name];
  if (!node) {
    // Unknown icon — leave a visible empty SVG slot rather than nothing,
    // so layout doesn't collapse.
    if (typeof console !== 'undefined') {
      console.warn(`[icons] Unknown icon "${name}". Did you forget to register it in src/ui/icons.js?`);
    }
    return svg;
  }

  for (const [tag, attrs] of node) {
    const child = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      child.setAttribute(k, String(v));
    }
    svg.appendChild(child);
  }
  return svg;
}

/**
 * Returns true if the icon is registered.
 * @param {string} name
 */
export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICONS, name);
}
