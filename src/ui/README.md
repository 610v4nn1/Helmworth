# `src/ui/` — UI Layer

Vanilla-DOM rendering and event wiring. **No framework, no bundler.** All
modules are ES modules loaded directly by `index.html` / `app.js`.

## Architectural rules

The UI is the **only** layer allowed to touch `document` and `window`. In
return it must respect three rules — all enforced by the architectural
tests in `tests/arch/`:

1. **Engine access only via the frozen public API.** UI modules import
   calculation functions exclusively from
   [`../engine/index.js`](../engine/index.js). No deep imports into
   `engine/steps/`, `engine/drawdown.js`, etc.
2. **Rates are decimals at the boundary.** The store and engine speak in
   decimals (`0.07`); the user sees percentages (`7 %`). Conversion is
   confined to [`format.js`](./format.js) (`formatPercent` / `parsePercent`,
   `formatCurrency` / `parseCurrency`).
3. **State changes go through the store.** No module mutates state in
   place; everything calls `store.addAsset`, `store.updateAsset`,
   `store.removeAsset`, `store.setState`, etc. The store handles
   persistence and subscriber notification.

The UI re-renders **reactively**: each top-level component calls
`store.subscribe(render)` once and re-renders whenever the state changes.

## Visual style — Tron / neon-on-dark

A minimalist neon aesthetic on a near-black background. Per-class accent
colors (`cyan`, `teal`, `magenta`, `lime`, `amber`, `violet`, `sky`, `red`)
are defined as CSS variables in `../../styles.css` and reused by both
the cards and the chart lines. See the top-level
[`README.md`](../../README.md) for the full token table.

Typography uses **Inter** for body text and **Orbitron** for hero numbers,
both loaded from Google Fonts. Icons are inlined SVGs from
[Lucide](https://lucide.dev) (MIT) — see `icons.js`.

## Module map

### Layout & primitives

| File           | Role                                                                                                   |
|----------------|--------------------------------------------------------------------------------------------------------|
| `dom.js`       | Tiny DOM helpers (`h`, `setChildren`, `createIcon`). The closest thing to a framework primitive.       |
| `icons.js`     | Inline SVG icon registry (zero network calls). Re-exported through `dom.js`.                           |
| `format.js`    | Decimal ⇄ percentage and number ⇄ currency conversions. **The only place** these conversions live.    |
| `modal.js`     | Single-modal-at-a-time helper; ESC + backdrop click close. Also exposes `confirmDialog(message, opts)`.|
| `classDefs.js` | Per-class UI metadata: display name, icon, ordered field descriptors (`{ key, label, type, … }`).      |
| `fieldEditor.js`| Renders **and reads** a single typed field. Supported types: `text`, `currency`, `percent`, `number`, `integer`, `option`, `saleConversion`. Used by both the creation form and the inline edit panel on cards. |

### Forms & cards

| File              | Role                                                                                                                    |
|-------------------|-------------------------------------------------------------------------------------------------------------------------|
| `userInfoForm.js` | Two-way binding for the User Info section (age, monthly expenses, inflation). Country is hard-coded to `DE` (Germany-only release). |
| `assetPicker.js`  | The "+" button → 8-button modal grid (one per asset class). Selecting a class opens the matching form.                  |
| `assetForms.js`   | Per-class modal form for **creating** an asset. Tax fields are pre-filled from the country defaults but editable.       |
| `assetCard.js`    | Renders a single asset card. Click to expand → the card lifts into a centered overlay and exposes the inline edit panel. The grid slot is held by an invisible placeholder so neighboring cards don't reflow. |
| `assetList.js`    | Cards grid + the live net-worth header. Subscribes to the store and re-renders on every change.                          |
| `importExport.js` | Header buttons. **Export** serialises `state` to a JSON file; **Import** parses a file, validates the basic shape, and replaces state via `store.setState` (running `migrateState` first). |

### Visualisations

| File                  | Role                                                                                                                                                                |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `chart.js`            | The main projections chart (Standard / Coast FIRE / FIRE) using **Chart.js** from CDN. Also writes the "Coast FIRE achievable at age X" / "FIRE achievable at age Y" annotations. Engine access exclusively via `../engine/index.js`. |
| `assetsChart.js`      | A second chart below the stats table: one line per asset class for the Standard scenario. X-axis = years from now (0..30).                                          |
| `statsTable.js`       | Renders the time-horizon table fed by `computeStatsTable`. Columns: Now, +5y, +10y, +20y, +30y. Rows: one per **present** asset class, Total, Monthly expenses, Yearly expenses. |
| `yearRangeControl.js` | A dual-handle year-range zoom control (low / high sliders) docked under the projections chart. Notifies a callback on selection change; preserves selection when bounds shift; resets when bounds change shape. |

## Reactive rendering pattern

Every component follows the same shape:

```js
import { store } from '../state.js';

export function mountX(host) {
  const render = () => {
    const state = store.getState();
    setChildren(host, [/* h(...) tree built from state */]);
  };
  render();
  store.subscribe(render);
}
```

`app.js` calls each `mountX(host)` once on boot. Re-renders are cheap
because the trees are small and `setChildren` does a coarse replace —
React-style diffing is unnecessary at this scale.

## Adding a new asset class field

If you add a new field to an existing asset class:

1. Add it to the factory in `src/model/assets.js` (with default + validation).
2. Add the field descriptor to the class's entry in `classDefs.js`.
3. If the field is a tax rate that should follow country selection, list its
   key in `TAX_FIELD_MAP` and add a default to `src/data/countries.js`.
4. If the engine needs to consume it, update the relevant
   `src/engine/steps/*.js` and the math section of
   [`../engine/README.md`](../engine/README.md).

`fieldEditor.js` will pick up the new field automatically as long as its
`type` is one of the supported ones.

## Keyboard shortcuts

Wired in `app.js`:

| Key   | Action                              |
|-------|-------------------------------------|
| `n`   | Open the asset picker (new asset).  |
| `Esc` | Close any open modal.               |
