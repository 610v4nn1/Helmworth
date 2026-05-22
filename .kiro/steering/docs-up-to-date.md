---
inclusion: always
---

# Docs are part of the contract

`docs/engine.md` and `methodology.html` are not optional commentary — they
are part of the change. Treat them like code: any time you alter the
behaviour they describe, update them in the same commit.

## When you MUST update docs

Update **both** `docs/engine.md` and `methodology.html` whenever you change:

1. **Asset factory signatures** in `src/model/assets.js`
   (`createStocks`, `createBonds`, `createCrypto`, `createCash`,
   `createRealEstate`, `createPrivateBusiness`, `createPension`,
   `createPersonalDebt`).
   - Every parameter the factory accepts must appear by its exact name in
     the matching class section of `docs/engine.md` (`### Stocks`, `###
     Bonds`, …) **and** the matching subsection of `methodology.html`
     (`6.1 Stocks`, `6.2 Bonds`, …).
   - The `tests/docs/factory-fields-doc-sync.test.js` suite enforces this
     — but don't rely on the test as your reminder; check the docs while
     you're there.

2. **Per-class step functions** in `src/engine/steps/*.js`.
   - The `@formula` block in the JSDoc must stay accurate, and the same
     formula must be reflected in the corresponding section of both docs.
   - `tests/docs/jsdoc-formula.test.js` checks that `@formula` exists;
     `tests/docs/cross-refs.test.js` checks each `### <Class>` section in
     `engine.md` mentions the corresponding `stepXxx`. Keep the math
     consistent across all four places (code, JSDoc, engine.md,
     methodology.html).

3. **Public engine API** (anything exported from `src/engine/index.js`).
   - Add or remove the matching entry in `engine.md`'s "## Public engine
     API" section. `tests/docs/api-doc-sync.test.js` enforces parity.

4. **Drawdown / sale / FIRE / Coast FIRE / stats algorithm changes**
   in `src/engine/`.
   - Update the matching `## Drawdown algorithm`, `## Sale events`,
     `## FIRE check`, `## Coast FIRE check`, `## Stats table semantics`
     section of `engine.md`, and the equivalent sections (9, 8, 11, 10,
     etc.) of `methodology.html`.

## Workflow rule

Before committing, do one of these:

- If the change is engine-visible, open `docs/engine.md` and
  `methodology.html`, find the section(s) you affected, and edit the
  prose / formulas / parameter lists.
- If the change is genuinely doc-irrelevant (e.g. internal refactor,
  pure UI cosmetics, a comment fix), say so explicitly in the commit
  message ("docs: no engine-visible behaviour change") so the next
  reviewer knows you didn't forget.

Run the full test suite (`node tests/run-node.mjs`) before pushing — the
doc-sync tests will catch most drift, but they can't catch every kind of
divergence (e.g. a formula that's still mentioned by name but is now
mathematically wrong). Read what you wrote.
