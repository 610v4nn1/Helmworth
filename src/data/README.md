# `src/data/` — Static Reference Data

Static, code-defined reference data with **no I/O and no side effects**. The
calculation layer treats this folder as a constant table; reloading the app
is the only way to change a value here.

## `countries.js` — EU country tax defaults

Default per-class tax rates for a curated set of EU countries. Used by the
UI to pre-fill the corresponding fields on a newly-created asset and to
"reset to country defaults" when the user changes their country.

> **Disclaimer.** Rates are approximations for planning purposes and **must
> not** be relied upon as legal or financial advice. Users can override any
> rate per-asset in the UI.

### Exports

| Export                  | Type                              | Purpose                                                                |
|-------------------------|-----------------------------------|------------------------------------------------------------------------|
| `countries`             | `Country[]`                       | The full table (currently 15 countries — see below).                   |
| `defaultCountry`        | `Country`                         | First entry of `countries` (`DE`). Used by `defaultState()`.           |
| `getCountryByCode(code)`| `(string) => Country \| undefined`| Lookup by ISO 3166-1 alpha-2 code.                                     |
| `getDefaultsByCountry(code)` | `(string) => CountryDefaults \| null` | Sugar over `getCountryByCode(code)?.defaults`.              |
| `getCountryOptions()`   | `() => {code, name}[]`            | Simplified list for dropdowns (currently unused — Germany-only build). |

### Shape

```ts
type Country = {
  code: string;          // ISO 3166-1 alpha-2, e.g. "DE"
  name: string;          // Display name
  defaults: CountryDefaults;
};

type CountryDefaults = {
  stocksCapitalGainsTax:               number;  // decimal
  bondsCapitalGainsTax:                number;
  bondsYieldTax:                       number;
  cryptoCapitalGainsTax:               number;
  realEstateRentalTax:                 number;
  realEstateSaleCapitalGainsTax:       number;
  privateBusinessDividendTax:          number;
  privateBusinessSaleCapitalGainsTax:  number;
};
```

All rates are stored as **decimals** (`0.26 ≡ 26 %`) — same convention as
the rest of the calculation layer.

### Currently included countries

`DE`, `FR`, `IT`, `ES`, `NL`, `IE`, `PT`, `BE`, `AT`, `FI`, `SE`, `DK`,
`GR`, `PL`, `CZ` (15 entries). The first entry is treated as the default
by `defaultState()`.

### Mapping to asset fields

The UI module [`classDefs.js`](../ui/classDefs.js) defines a `TAX_FIELD_MAP`
that connects each `CountryDefaults` key to the corresponding asset field
the engine consumes:

| `CountryDefaults` key                  | Asset class        | Asset field                  |
|----------------------------------------|--------------------|------------------------------|
| `stocksCapitalGainsTax`                | `stocks`           | `capitalGainsTaxRate`        |
| `bondsCapitalGainsTax`                 | `bonds`            | `capitalGainsTaxRate`        |
| `bondsYieldTax`                        | `bonds`            | `yieldTaxRate`               |
| `cryptoCapitalGainsTax`                | `crypto`           | `capitalGainsTaxRate`        |
| `realEstateRentalTax`                  | `realEstate`       | (informational; user nets it into `cashFlow`) |
| `realEstateSaleCapitalGainsTax`        | `realEstate`       | `saleCapitalGainsTaxRate`    |
| `privateBusinessDividendTax`           | `privateBusiness`  | `dividendTaxRate`            |
| `privateBusinessSaleCapitalGainsTax`   | `privateBusiness`  | `saleCapitalGainsTaxRate`    |

### Adding or updating a country

1. Append a new `{ code, name, defaults }` entry to the `countries` array.
   Keep the `defaults` keys in the exact order shown above so diffs stay
   readable.
2. Cite a source for each non-trivial rate in a code comment next to the
   value (e.g. *"Abgeltungsteuer + solidarity surcharge"*).
3. No code changes are needed elsewhere — `assetForms.js` reads the table
   reflectively via `TAX_FIELD_MAP`.

### Adding a new tax field

If a new tax rate becomes part of the asset model:

1. Add it to **every** country's `defaults` block (use `0` if unknown — the
   user can override).
2. Add a key to `TAX_FIELD_MAP` in [`../ui/classDefs.js`](../ui/classDefs.js)
   so the field is auto-pre-filled on asset creation.
3. Update the asset factory and validator in
   [`../model/assets.js`](../model/assets.js).
4. Update the engine step function that consumes the rate and the math
   section of [`../engine/README.md`](../engine/README.md).
