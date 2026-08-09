# Obsidian Quantities

Obsidian Quantities is a calculation language that lives naturally inside your
notes. It began with unit conversion, grew into a practical calculator for
recipes and everyday quantities, and now supports variables and scoped
aggregation for ledger-like, Soulver-style calculations. Markdown remains
readable source: only explicitly marked inline code belongs to the plugin, and
headings or layout never acquire hidden calculation meaning.

```markdown
Trip distance: `=5 mi to km`
Cost per mile = `=42.50 / 18`

CAC:ex = `=350.00`
OG&E:ex = `=200.00`
Walmart:ex:gr = `=100.00`

Total Expenses = `=sum:ex`
Groceries = `=sum:ex{gr}`
```

The default `` `=` `` prefix is configurable, so users can avoid inline-query collisions with Dataview or another plugin. Obsidian Quantities only evaluates inline code using the active marker; ordinary inline code remains untouched.

This README is the short tour. The [manual](MANUAL.md) is the complete user
guide, [semantics](SEMANTICS.md) defines the language precisely, and the
[design record](DESIGN_RECORD.md) explains why its major rules were chosen.

## Installation

Obsidian Quantities is currently installed manually:

1. Download or build `main.js`, `manifest.json`, and `styles.css`.
2. Place them in `<vault>/.obsidian/plugins/obsidian-quantities/`.
3. Reload Obsidian and enable **Obsidian Quantities** under **Settings → Community plugins**.

For development, clone the repository directly into that plugin directory, run `npm install`, then run `npm run build`.

## Highlights

- Converts length, area, mass, volume, speed, acceleration, data, time, pressure, energy, power, and temperature.
- Converts between mass and volume using configurable material densities.
- Evaluates arithmetic with variables, parentheses, exponents, scientific notation, and implicit multiplication.
- Evaluates declarations from top to bottom with clear unknown-variable and forward-reference errors.
- Aggregates successful declarations with `sum`, `count`, `avg`, `median`, `min`, and `max`.
- Filters groups with OR, AND, and exclusion clauses.
- Closes local accumulations explicitly when an `@` aggregate reads them.
- Aggregates declarations between balanced `top` and `bottom` regional markers.
- Reports malformed expressions and unknown sigils instead of silently returning zero.
- Renders in both Live Preview and Reading View while revealing source at the cursor.
- Provides commands for plain-text conversion, result insertion, rendering control, and marker migration.

## Core syntax

### Conversions and arithmetic

```markdown
`=5 ft to cm`
`=30 ml of maple syrup to g`
`=(12.50 + 7.25) * 2`
```

The conversion separators `to`, `as`, `in`, and `->` are supported. Add `| value`, `| unit`, or `| result` to control the displayed portion.

### Variables and groups

```markdown
Budget = `=1000`
CAC:ex:hosting = `=350`
Power:ex:utilities = `=200`

Remaining = `=Budget - sum:ex`
Utilities = `=sum:ex{utilities}`
```

A repeated label updates the variable to its latest successful value. Every
declaration also joins its implicit label history, while sigils add explicit
cross-cutting memberships. The declaration `CAC:ex` is therefore available to
both `sum:cac` and `sum:ex` without copying or double-counting the record.

### Local accumulation

```markdown
Rent:ex = `=800`
Power:ex = `=150`
First period = `=sum@ex`

Groceries:ex = `=200`
Fuel:ex = `=90`
Second period = `=sum@ex`
```

The first total is 950 and closes the local `ex` accumulation. The next
`ex` declaration opens a fresh one, so the second total is 290. A single-colon
`sum:ex` still returns the note-wide total, 1240. Markdown structure never
opens or closes scope.

### Regional aggregation

```markdown
`=top`
A = `=10`
B = `=20`
Running = `=sum:>`
`=bottom`

Final = `=sum:>`
```

`sum:>` reads the active region, or the latest completed region after
`bottom`. Reads do not close a region. The `top` and `bottom` names are reserved
for regional structure. Reading View conceals these markers and declaration
sigils as calculation metadata; Source Mode and Live Preview retain them.

Aggregate targets end when arithmetic begins, so compact expressions work:

```markdown
Remaining = `=Budget-sum:ex`
Projected = `=sum:ex+25`
```

## Expression markers and plugin compatibility

The marker defaults to `=` and can be changed in plugin settings. If it is changed to `~`, expressions must begin with `~`:

```markdown
`~5 ft to cm`
Total = `~sum:ex`
```

Old-marker declarations produce a helpful diagnostic. Run **Update Quantities markers in current file** to migrate recognized declarations, aggregates, and conversions in the active note. Ambiguous standalone arithmetic is intentionally not rewritten.

Custom markers are a practical way to avoid an inline syntax collision, but the setting must be synchronized across devices for notes to remain portable.

## Commands

- **Convert units in selection or current line** replaces plain conversion text with an equation-style result.
- **Insert unit conversion result only** replaces a conversion with only its formatted result.
- **Toggle rendered calculations in active editor** toggles calculation rendering in the active editor.
- **Update Quantities markers in current file** migrates recognized expressions from the previous marker to the active marker.

The calculator ribbon icon also converts the current line.

## Settings

Obsidian Quantities provides settings for decimal precision, the expression marker, Live Preview rendering, per-unit display style, and material densities. See the [settings reference](MANUAL.md#settings) for exact behavior.

Material densities are stored with the rest of the plugin settings in `data.json`:

```json
{
  "densities": [
    { "name": "maple syrup", "value": 1.37, "unit": "g/ml" }
  ]
}
```

## Errors are visible

Unknown variables, groups, local accumulations, and regions are errors. So are incorrect markers, invalid conversions, division by zero, malformed filters, empty `avg`/`median`/`min`/`max`, and attempts to aggregate unit-bearing quantities. Failed declarations do not enter variables or groups and do not silently contribute zero.

## Development

```bash
npm install
npm test
npm run build
```

The language is specified in [SEMANTICS.md](SEMANTICS.md). Design rationale
lives in [DESIGN_RECORD.md](DESIGN_RECORD.md); neither document is a second
user manual.
