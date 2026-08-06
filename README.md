# Obsidian Units

Obsidian Units turns explicit inline-code expressions into calculations without making Markdown structure part of the calculation language. It converts units, evaluates arithmetic, reuses variables, aggregates note-wide groups, and tracks declaration-driven local accumulations in Live Preview and Reading View.

```markdown
Trip distance: `=5 mi to km`
Cost per mile = `=42.50 / 18`

CAC:ex = `=350.00`
OG&E:ex = `=200.00`
Walmart:ex:gr = `=100.00`

Total Expenses = `=sum:ex`
Groceries = `=sum:ex{gr}`
```

The default `` `=` `` prefix is configurable, so users can avoid inline-query collisions with Dataview or another plugin. Obsidian Units only evaluates inline code using the active marker; ordinary inline code remains untouched.

For the complete language, command, settings, diagnostic, and compatibility reference, read the [manual](MANUAL.md).

## Installation

Obsidian Units is currently installed manually:

1. Download or build `main.js`, `manifest.json`, and `styles.css`.
2. Place them in `<vault>/.obsidian/plugins/obsidian-units/`.
3. Reload Obsidian and enable **Obsidian Units** under **Settings → Community plugins**.

For development, clone the repository directly into that plugin directory, run `npm install`, then run `npm run build`.

## Highlights

- Converts length, area, mass, volume, speed, acceleration, data, time, pressure, energy, power, and temperature.
- Converts between mass and volume using configurable material densities.
- Evaluates arithmetic with variables, parentheses, exponents, scientific notation, and implicit multiplication.
- Evaluates declarations from top to bottom with clear unknown-variable and forward-reference errors.
- Aggregates successful declarations with `sum`, `count`, `avg`, `min`, and `max`.
- Filters groups with OR, AND, and exclusion clauses.
- Supports local accumulation without relying on headings, lists, or other Markdown layout.
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

### Variables and global groups

```markdown
Budget = `=1000`
CAC:ex:hosting = `=350`
Power:ex:utilities = `=200`

Remaining = `=Budget - sum:ex`
Utilities = `=sum:ex{utilities}`
```

A repeated label updates the variable to its latest successful value. Groups retain every successful entry.

### Local accumulation

```markdown
CAC:cac:ex = `=135`
CAC:cac:ex = `=75`
This CAC block = `=sum::cac`

CAC = `=150`
Completed CAC block = `=sum::cac`
```

Qualified `CAC` declarations join both global and local `cac`/`ex` collections. A later successful `CAC` declaration that omits those qualifiers closes them. An unrelated label does not. This behavior is based only on declaration continuity, so the same note calculates identically with or without Markdown headings.

## Expression markers and plugin compatibility

The marker defaults to `=` and can be changed in plugin settings. If it is changed to `~`, expressions must begin with `~`:

```markdown
`~5 ft to cm`
Total = `~sum:ex`
```

Old-marker declarations produce a helpful diagnostic. Run **Update Units markers in current file** to migrate recognized declarations, aggregates, and conversions in the active note. Ambiguous standalone arithmetic is intentionally not rewritten.

Custom markers are a practical way to avoid an inline syntax collision, but the setting must be synchronized across devices for notes to remain portable.

## Commands

- **Convert units in selection or current line** replaces plain conversion text with an equation-style result.
- **Insert unit conversion result only** replaces a conversion with only its formatted result.
- **Toggle rendered calculations in active editor** toggles calculation rendering in the active editor.
- **Update Units markers in current file** migrates recognized expressions from the previous marker to the active marker.

The calculator ribbon icon also converts the current line.

## Settings

Obsidian Units provides settings for decimal precision, the expression marker, Live Preview rendering, per-unit display style, and material densities. See the [settings reference](MANUAL.md#settings) for exact behavior.

Material densities are stored with the rest of the plugin settings in `data.json`:

```json
{
  "densities": [
    { "name": "maple syrup", "value": 1.37, "unit": "g/ml" }
  ]
}
```

## Errors are visible

Unknown variables, groups, and local accumulations are errors. So are incorrect markers, invalid conversions, division by zero, malformed filters, empty `avg`/`min`/`max`, and attempts to aggregate unit-bearing quantities. Failed declarations do not enter variables or groups and do not silently contribute zero.

## Development

```bash
npm install
npm test
npm run build
```

The implementation and fixture-backed behavior are documented in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), [DESIGN_RECORD.md](DESIGN_RECORD.md), and [LOCAL_SCOPES_DESIGN.md](LOCAL_SCOPES_DESIGN.md).
