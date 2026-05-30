# Obsidian Units

Soulver-style inline unit conversions for Obsidian notes.

## Usage

Wrap a conversion expression in inline code to show the result automatically:

```text
I need `33 meters to feet` of lumber.
```

In Reading View and Live Preview, Obsidian Units renders the calculated result after the inline code without changing the note text.

If the surrounding sentence already supplies the unit, add `| value`:

```text
I need `3 kg to pound | value` pounds of soil.
```

Inline render modes:

- `33 meters to feet` renders the value and unit.
- `33 meters to feet | value` renders only the value.
- `33 meters to feet | unit` renders only the target unit name.

For editors that auto-pair backticks, a trailing plural `s` after the inline code is tolerated:

```text
`33 ounces to gram`s
```

renders as `935.5349 grams`, not `935.5349 gramss`.

In Live Preview, Obsidian Units keeps the inline code editable while your cursor is inside it, so auto-paired backticks do not prevent you from finishing a target unit or adding `| value`.
You can also type the target unit in singular form; the rendered result uses the target value to choose singular or plural output.

Inline arithmetic is also supported:

```text
`10/2`
`10 / 2`
`10 / 2 =`
`(10 + 2) / 3`
`2^8`
```

Inline arithmetic can reference numeric labels from earlier lines. The context is parsed top-to-bottom; later assignments override earlier ones from that point onward.

```text
oldPay = `940`
oldCPI = `290`
newCPI = `330`
newPay = `oldPay (newCPI / oldCPI)`

oldPay = `1000`
newerPay = `oldPay (newCPI / oldCPI)`
```

The labels above are available by name inside later inline arithmetic expressions. Earlier results are not recalculated from later assignments.

## Performance Note

Variable references are currently resolved by scanning earlier note content for each inline expression. This is simple and works well for typical notes, but large calculation-heavy documents should eventually use a per-render-pass top-down context cache.

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

## Supported Categories

- Length
- Area
- Mass
- Volume
- Speed
- Data
- Temperature

The first spreadsheet-backed categories are **Data** and **Temperature**, because those are the categories in `conversions.tsv` that currently include explicit formulas.

The plugin loads `obsidian-units-core` from Rust/WASM for inline evaluation first, then falls back to the TypeScript evaluator while the Rust port is still catching up to the older TypeScript unit table.

## Development

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run build
```
