# Obsidian Units

Soulver-style inline unit conversions for Obsidian notes.

## Usage

Prefix a conversion or calculation with the configured expression marker inside inline code to show the result automatically. The default marker is `=`:

```text
I need `=33 meters to feet` of lumber.
```

In Reading View and Live Preview, Obsidian Units renders the calculated result after the inline code without changing the note text.

If the surrounding sentence already supplies the unit, add `| value`:

```text
I need `=3 kg to pound | value` pounds of soil.
```

Inline render modes:

- `=33 meters to feet` renders the value and unit.
- `=33 meters to feet | value` renders only the value.
- `=33 meters to feet | unit` renders only the target unit name.

Ordinary inline code such as `npm run build` is never treated as a calculation.

The expression marker can be changed in **Settings → Obsidian Units → Expression marker**, for example from `=` to `~` when another plugin owns `=`. Exactly one marker is active. Declarations written with the previous marker remain declarations but have no calculated value and display an incorrect-marker diagnostic. Use **Update Units markers in current file** from the command palette to update recognized declarations, aggregates, and conversions; ambiguous standalone arithmetic is reported and left unchanged.

For editors that auto-pair backticks, a trailing plural `s` after the inline code is tolerated:

```text
`=33 ounces to gram`s
```

renders as `935.5349 grams`, not `935.5349 gramss`.

In Live Preview, Obsidian Units keeps the inline code editable while your cursor is inside it, so auto-paired backticks do not prevent you from finishing a target unit or adding `| value`.
You can also type the target unit in singular form; the rendered result uses the target value to choose singular or plural output.

Inline arithmetic is also supported:

```text
`=10/2`
`=10 / 2`
`=10 / 2 =`
`=(10 + 2) / 3`
`=2^8`
```

Inline arithmetic can reference numeric labels from earlier lines. The context is parsed top-to-bottom; later assignments override earlier ones from that point onward.

```text
oldPay = `=940`
oldCPI = `=290`
newCPI = `=330`
newPay = `=oldPay (newCPI / oldCPI)`

oldPay = `=1000`
newerPay = `=oldPay (newCPI / oldCPI)`
```

The labels above are available by name inside later expressions. Earlier results are not recalculated from later assignments.

A declaration occupies its line, or the final ledger field after the last `|`. Colons must attach group sigils directly (`Label:group`); a colon followed by whitespace is not a silent boundary and produces an invalid-label diagnostic. Put surrounding prose on a separate line or before a ledger `|`.

Declarations can attach one or more group sigils to a dimensionless value. Aggregates see successful declarations above them only:

```text
- Service:ex:ls = `=50`
- Store:ex:gr = `=60`
- Utility:ex:ob = `=180`
- Total: `=sum:ex`
- Obligations or landscaping: `=sum:ex{ob,ls}`
- Non-grocery: `=sum:ex{!gr}`
```

Available aggregates are `sum`, `count`, `avg`, `min`, and `max`. Comma-separated filters are OR; repeated filter clauses are AND. A fully negated clause complements its union, so `{!ob,!ls}` means “neither ob nor ls.” `sum` and `count` return zero for an empty selection; the other functions show an error. Unit-bearing conversions cannot be aggregated in this release.

Numeric declarations retain their decimal presentation. Variable references and aggregates display at least the maximum decimal places contributed by their inputs, while `count` remains an integer. The decimal-precision setting remains the maximum displayed calculation precision.

### Errors

Explicit expressions render a diagnostic instead of remaining as unchanged code when they cannot be evaluated. Diagnostics identify invalid declarations and sigils, malformed aggregates, unknown variables and units, incompatible conversions, missing density materials, division by zero, self-references, empty aggregates, and unsupported quantity aggregation. Unknown variables include a suggested preceding label when there is a close match. In Live Preview, the source remains editable while the cursor is inside the code span.

You can also write a conversion expression, place the cursor on that line, and run **Obsidian Units: Convert units in selection or current line** from the command palette.

Examples:

```text
5 ft to cm
2 cups to ml
180 lb to kg
72 F to C
55 mph to km/h
10 MiB to MB
```

The command replaces the expression with:

```text
5 ft = 152.4 cm
```

You can also select an expression inside a larger line and convert only the selection.

## Commands

- **Convert units in selection or current line** replaces the selected expression, or the current line if there is no selection.
- **Insert unit conversion result only** inserts only the result at the cursor or over the current selection.
- **Update Units markers in current file** replaces the previous marker with the configured marker in recognized Units expressions after confirmation.

## Supported Categories

- Length
- Area
- Mass
- Volume
- Speed
- Acceleration
- Data
- Time
- Pressure
- Energy
- Power
- Temperature

The `conversions.tsv` file is a planning/reference list for future category expansion. Runtime conversion is handled by TypeScript unit tables that convert through one base unit per category.

## Material densities (mass ↔ volume)

Mass and volume are different dimensions, so a conversion like `1 tsp to g` is incomplete — the answer depends on what's in the teaspoon. Once you teach the plugin a material's density, expressions like the following work in either direction:

```text
`=1 tsp of maple syrup to g`     → 6.7503 grams
`=100 g of maple syrup to ml`    → 72.993 milliliters
```

The keyword `of <material>` appears between the source unit and `to`/`as`/`in`/`->`. The material name can contain spaces and is matched case-insensitively. Mismatched dimensions other than mass ↔ volume are still rejected (the plugin does not bridge volume → length, etc.).

### Adding a density via the UI

In **Settings → Obsidian Units → Material densities**, click **Add density**. The modal collects three fields:

- **Material name** — how you'll refer to the material in expressions.
- **Density value** — the numeric density.
- **Density unit** — pick from `g/ml`, `kg/m^3`, `lb/ft^3`, or `oz/fl oz`.

Edit or delete existing entries from the same screen. Changes take effect immediately in open Live Preview panes.

### Hand-editing the data file

Densities are persisted in the plugin's `data.json` (alongside other settings). The shape is:

```json
{
  "densities": [
    { "name": "maple syrup", "value": 1.37, "unit": "g/ml" },
    { "name": "olive oil",   "value": 0.91, "unit": "g/ml" }
  ]
}
```

Reference values (for copying):

| Material         | Density (g/mL) |
| ---------------- | -------------- |
| Water            | 1.00           |
| Whole milk       | 1.03           |
| Butter           | 0.91           |
| All-purpose flour (sifted) | 0.53 |
| Granulated sugar | 0.85           |
| Honey            | 1.42           |
| Maple syrup      | 1.37           |
| Olive oil        | 0.91           |

Flour density varies a lot with packing — adjust to your own measurement.

## Development

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```
