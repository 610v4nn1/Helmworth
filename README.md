# Helmworth

A single-page Financial Independence & Retirement planner. Steer your net
worth, project three retirement scenarios (Standard / Coast FIRE / FIRE),
and see them on a live chart and stats table.

**Vanilla JavaScript, no build step, no backend.** Static files only. Works
offline once cached. State is stored in `localStorage`.

## Run locally

Any static HTTP server works. The simplest options:

```bash
# With Python
python3 -m http.server 8765
# Then open http://localhost:8765/

# Or with Node (one-shot, no install)
npx --yes serve . -p 8765
```

You **must** serve over HTTP — opening `index.html` via `file://` will fail
because of ES module / CDN restrictions.

## Run the tests

The test suite runs entirely in the browser:

```bash
python3 -m http.server 8765
# Open http://localhost:8765/tests/runner.html
```

You should see green ✅ marks for every test plus a `Passed: N / Failed: 0`
summary. There is also a Node-based shim (`tests/run-node.mjs`) used during
development for fast feedback:

```bash
node tests/run-node.mjs
```

## Deploy to GitHub Pages

This app deploys as-is — no build step required. Push to a branch and enable
GitHub Pages on it. The site will be live at
`https://<username>.github.io/<repo>/`.

## Architecture

Strict one-way separation between a **pure calculation layer** and a **UI
layer**:

```
              +---------------------+
              |   UI layer (src/ui) |
              +----------+----------+
                         |
                         v
              +---------------------+
              | Calculation layer   |
              | (src/model,         |
              |  src/engine,        |
              |  src/state, src/data)
              +---------------------+
```

- The calculation layer never references `document`, `window`, or `localStorage`
  (except `state.js`, the single storage adapter).
- The UI layer imports engine functionality only via `src/engine/index.js`
  (the **frozen public API**).
- Both invariants are enforced by automated tests in `tests/arch/`.

See `docs/engine.md` for the formulas, scenarios, and per-class semantics.

## Tech

- **HTML/CSS/JS** — no framework, no bundler.
- **Chart.js** (CDN) — projections chart.
- **Lucide** (CDN) — icons.
- **Inter + Orbitron** (Google Fonts) — typography.

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `n` | Add a new asset (opens the picker) |
| `Esc` | Close any open modal |

## Convention: rates as decimals

Rates in the calculation layer are **decimals** (`0.07` = 7 %). The UI layer
displays and accepts them as **percentages** (`7%`, not `0.07`). Conversion
happens at the boundary in `src/ui/format.js`.
