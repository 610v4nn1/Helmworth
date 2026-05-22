/**
 * @fileoverview A dual-handle year-range zoom control. Renders a pair of
 * range sliders (low / high) under a chart, lets the user pick a [yMin, yMax]
 * window of calendar years within an allowed [absMin, absMax] band, and
 * notifies a callback whenever the selection changes.
 *
 * The control's DOM is built into the host element and is fully self-managed:
 * the chart re-renders by calling `setBounds(absMin, absMax)` whenever the
 * underlying data range changes (e.g. user changes their age). When the
 * absolute bounds change, the current selection is clamped/preserved when
 * possible; if the bounds change shape entirely, the selection resets to the
 * full range.
 *
 * @module src/ui/yearRangeControl
 */

import { setChildren, h } from './dom.js';

/**
 * @typedef {Object} YearRangeControl
 * @property {() => {min:number, max:number}} getRange - current selection
 * @property {(absMin:number, absMax:number) => void} setBounds - update the
 *   allowed band; preserves the current selection when possible.
 */

/**
 * Mount a year-range control inside `hostEl`.
 *
 * @param {HTMLElement} hostEl
 * @param {{min:number, max:number, onChange:(r:{min:number,max:number}) => void}} opts
 * @returns {YearRangeControl}
 */
export function mountYearRangeControl(hostEl, { min, max, onChange }) {
  let absMin = min;
  let absMax = max;
  let curMin = min;
  let curMax = max;

  // DOM refs (rebuilt when bounds change shape).
  /** @type {HTMLInputElement|null} */ let lowEl  = null;
  /** @type {HTMLInputElement|null} */ let highEl = null;
  /** @type {HTMLElement|null}      */ let labelEl = null;
  /** @type {HTMLElement|null}      */ let trackFillEl = null;

  function emit() {
    onChange({ min: curMin, max: curMax });
  }

  function updateLabel() {
    if (labelEl) labelEl.textContent = `${curMin} – ${curMax}`;
  }

  function updateTrackFill() {
    if (!trackFillEl) return;
    const span = absMax - absMin;
    if (span <= 0) {
      trackFillEl.style.left = '0%';
      trackFillEl.style.right = '0%';
      return;
    }
    const leftPct  = ((curMin - absMin) / span) * 100;
    const rightPct = ((absMax - curMax) / span) * 100;
    trackFillEl.style.left  = `${leftPct}%`;
    trackFillEl.style.right = `${rightPct}%`;
  }

  function onLowInput() {
    if (!lowEl || !highEl) return;
    let v = Number(lowEl.value);
    if (v >= curMax) {
      v = curMax - 1;
      lowEl.value = String(v);
    }
    curMin = v;
    updateLabel();
    updateTrackFill();
    emit();
  }

  function onHighInput() {
    if (!lowEl || !highEl) return;
    let v = Number(highEl.value);
    if (v <= curMin) {
      v = curMin + 1;
      highEl.value = String(v);
    }
    curMax = v;
    updateLabel();
    updateTrackFill();
    emit();
  }

  function build() {
    lowEl = h('input', {
      className: 'yrc-range yrc-range-low',
      attrs: {
        type: 'range',
        min: String(absMin),
        max: String(absMax),
        step: '1',
        value: String(curMin),
        'aria-label': 'From year',
      },
    });
    highEl = h('input', {
      className: 'yrc-range yrc-range-high',
      attrs: {
        type: 'range',
        min: String(absMin),
        max: String(absMax),
        step: '1',
        value: String(curMax),
        'aria-label': 'To year',
      },
    });
    trackFillEl = h('div', { className: 'yrc-track-fill' });
    const trackEl = h('div', {
      className: 'yrc-track',
      children: [
        h('div', { className: 'yrc-track-base' }),
        trackFillEl,
        lowEl,
        highEl,
      ],
    });

    labelEl = h('span', { className: 'yrc-label-value' });
    const header = h('div', {
      className: 'yrc-header',
      children: [
        h('span', { className: 'yrc-label-key', children: 'Zoom years:' }),
        labelEl,
      ],
    });

    const endpoints = h('div', {
      className: 'yrc-endpoints',
      children: [
        h('span', { children: String(absMin) }),
        h('span', { children: String(absMax) }),
      ],
    });

    setChildren(hostEl, [header, trackEl, endpoints]);

    lowEl.addEventListener('input', onLowInput);
    highEl.addEventListener('input', onHighInput);

    updateLabel();
    updateTrackFill();
  }

  function setBounds(newMin, newMax) {
    if (newMax <= newMin) newMax = newMin + 1;
    // Preserve current selection where possible; otherwise clamp.
    const prevMin = curMin;
    const prevMax = curMax;
    absMin = newMin;
    absMax = newMax;
    curMin = Math.min(Math.max(prevMin, absMin), absMax - 1);
    curMax = Math.min(Math.max(prevMax, absMin + 1), absMax);
    if (curMin >= curMax) {
      curMin = absMin;
      curMax = absMax;
    }
    build();
    // Note: don't emit here — the caller is the chart that just rebuilt and
    // already knows its data range. It will read getRange() if needed.
  }

  // Initial build.
  build();

  return {
    getRange: () => ({ min: curMin, max: curMax }),
    setBounds,
  };
}
