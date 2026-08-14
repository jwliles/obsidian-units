# Obsidian Quantities Manual

Obsidian Quantities evaluates explicit calculations inside single-backtick inline code spans. It supports unit conversion, arithmetic, reusable variables, note-wide groups, local accumulations, and positional regions. Calculations are evaluated from top to bottom within the current note.

This manual describes the selected language behavior. The grouped-calculation
evaluator follows [SEMANTICS.md](SEMANTICS.md); see
[DESIGN_RECORD.md](DESIGN_RECORD.md) for rationale.

## Quick start

With the default expression marker, `=`, write:

```markdown
Distance: `=5 ft to cm`
Subtotal: `=(12.50 + 7.25) * 2`

CAC:ex = `=350.00`
OG&E:ex = `=200.00`
Walmart:ex:gr = `=100.00`

Total Expenses = `=sum:ex`
Grocery Expenses = `=sum:ex{gr}`
```

In Live Preview and Reading View, the inline expressions render as their results. In Source mode, they remain ordinary Markdown text.

The marker is intentional. Ordinary inline code such as `` `npm test` `` is never treated as a calculation.

## Expression marker

The expression marker identifies inline code owned by Obsidian Quantities. Its default value is `=`.

```markdown
`=2 + 2`
`=5 ft to cm`
Total = `=sum:ex`
```

The marker is configurable in **Settings → Obsidian Quantities → Expression marker**. It is exact and case-sensitive. It may contain 1–16 characters, but cannot contain whitespace or backticks.

If the marker is changed to `~`, the same expressions become:

```markdown
`~2 + 2`
`~5 ft to cm`
Total = `~sum:ex`
```

After a marker change, expressions using the old marker no longer calculate. Declarations still retain their declaration syntax, but they have no evaluated value until their inline expression uses the active marker. When Obsidian Quantities recognizes a declaration using the previous marker, it reports an incorrect-marker diagnostic instead of silently treating its value as zero.

Use the command **Update Quantities markers in current file** to migrate recognized expressions in the active note from the previous marker to the active marker. The command updates declarations, aggregates, and conversions. It deliberately leaves ambiguous standalone arithmetic unchanged because another plugin may own it.

The previous marker is retained so the migration command can identify what to replace. If plugin settings are not synchronized across devices, notes using a customized marker may not be portable until the other device is configured the same way.

## Rendering

Obsidian Quantities renders calculations in:

- Live Preview
- Reading View

Source mode always shows the Markdown source.

In Live Preview, placing the cursor in a calculation reveals its source so it can be edited. Its rendered result and diagnostic are temporarily suppressed while the cursor intersects that code span.

Reading View conceals non-prose calculation metadata: declaration sigils and
valid regional `top` and `bottom` markers. For example,
`Cost:expense:food = 20` is presented as `Cost = 20`. A structural marker
carrying a warning or error is shown as that diagnostic rather than concealed.

This cleanup is strictly presentational. It does not modify Markdown source,
parsing, evaluation, or membership. Source Mode and Live Preview retain the
complete declaration and structural syntax.
If a concealed structural marker was the only content in its paragraph or list
item, Reading View also removes that empty presentation container.

Use **Toggle rendered calculations in active editor** to turn rendered calculations on or off for the active editor.

Markdown headings, lists, blockquotes, emphasis, and other presentation structure do not define calculation scope. Calculations render the same way in plain text and heavily structured Markdown. Obsidian Quantities ignores expressions inside fenced code blocks and HTML comments.

## Result display modes

An expression normally replaces the complete inline code span with its result. Add a display suffix to control what is shown:

```markdown
`=5 ft to cm`          → 152.4 cm
`=5 ft to cm | result` → 152.4 cm
`=5 ft to cm | value`  → 152.4
`=5 ft to cm | unit`   → cm
```

`result` is the default. `value` shows only the numeric value. `unit` shows only the formatted unit.

## Unit conversions

A conversion contains a number, source unit, conversion separator, and target unit:

```markdown
`=5 ft to cm`
`=2.5 kg as lb`
`=32 F in C`
`=60 mph -> km/h`
```

The supported separators are `to`, `as`, `in`, and `->`.

Unit names and abbreviations are case-insensitive where applicable. A trailing plural `s` is accepted when it unambiguously forms a supported unit name.

Conversions reject incompatible dimensions, unknown units, malformed quantities, and non-finite results.

### Material density conversions

Density-aware conversions can translate between mass and volume:

```markdown
`=30 ml of maple syrup to g`
`=100 g of flour to ml`
```

The material must exist in the configured density table. Density values can be added and edited in plugin settings.

## Arithmetic

Arithmetic expressions support:

- addition: `+`
- subtraction: `-`
- multiplication: `*`
- division: `/`
- exponentiation: `^`
- parentheses
- unary `+` and `-`
- scientific notation
- implicit multiplication before parentheses

Examples:

```markdown
`=2 + 3 * 4`
`=(2 + 3) * 4`
`=2(3 + 4)`
`=2.5e3 / 4`
```

A trailing equals sign is accepted for calculator-style input:

```markdown
`=2 + 2 =`
```

Division by zero and non-finite results are errors.

## Declarations and variables

A declaration gives an evaluated expression a label:

```markdown
CAC = `=135.00`
```

The whitespace-surrounded assignment ` = ` is significant. Plain text without an active marked expression is not a valued declaration:

```markdown
CAC = `135.00`
```

The second example displays ordinary inline code and does not assign a value to `CAC`.

Reference a previously evaluated numeric declaration by label:

```markdown
Subtotal = `=135.00`
Tax = `=Subtotal * 0.0825`
Total = `=Subtotal + Tax`
```

Variable lookup is top-down. A reference uses the latest successful preceding declaration with that normalized label. There are no forward references.

```markdown
Rate = `=10`
First = `=Rate * 2`
Rate = `=20`
Second = `=Rate * 2`
```

`First` is 20 and `Second` is 40.

Labels are matched case-insensitively, Unicode-normalized, and with whitespace normalized. Common Markdown formatting around the declaration label is ignored. Labels cannot contain structural declaration characters such as `:` or `=`.

A self-reference that has no earlier successful value is an error:

```markdown
Amount = `=Amount + 1`
```

Only successful declarations enter the variable environment. An error does not replace the last valid value.

### Declaration boundaries

Obsidian Quantities recognizes one declaration per line. A declaration can appear as the line's main content or in the final ledger-style field after the last pipe. Common list markers are ignored when locating the label.

```markdown
- CAC = `=135.00`
| 2026-08-05 | CAC = `=135.00` |
```

Pipe-delimited ledger lines are supported. Formal Markdown tables are not a
supported declaration host. A table row may happen to resemble a ledger line,
but table-specific parsing, escaping, and rendering behavior is unspecified.

The inline calculation associated with the declaration must be the declaration value, not unrelated inline code elsewhere on the line.

## Declaration histories and groups

Every successful declaration joins the normalized history of its label. Append
one or more colon-prefixed sigils to add cross-cutting group memberships:

```markdown
CAC:ex = `=350.00`
OG&E:ex = `=200.00`
Walmart:ex:gr = `=100.00`
```

These declarations create ordinary variables named `CAC`, `OG&E`, and
`Walmart`. Each record belongs to its implicit label history (`cac`, `og&e`, or
`walmart`) and also to the explicit `ex` and, where present, `gr` groups.

```markdown
Total CAC = `=sum:cac`
Total Expenses = `=sum:ex`
Grocery Expenses = `=sum:gr`
```

Histories and groups retain every successful declaration record. Variables and
aggregates therefore differ when a label is repeated:

```markdown
CAC = `=100`
CAC:ex = `=50`
Latest CAC = `=CAC`
All CAC entries = `=sum:cac`
```

`Latest CAC` is 50, while `All CAC entries` is 150. The second declaration is
one record indexed by both `cac` and `ex`; membership does not copy its value.
If implicit and explicit memberships overlap, aggregates deduplicate by
declaration identity. `CAC:cac:ex` is valid but normally unnecessary.

Sigils are case-insensitive and Unicode-normalized. They cannot contain
whitespace, arithmetic operators, parentheses, or the structural characters
used by the grammar. Duplicate sigils on one declaration are counted only
once.

## Local accumulations

Each history or group also has a current local accumulation. A declaration
joins the active local accumulation for every history and sigil to which it
belongs, opening one when necessary.

An `@` aggregate reads and then closes the queried local accumulation:

```markdown
Rent:ex = `=800.00`
Power:ex = `=150.00`
Water:ex = `=60.00`
First period = `=sum@ex`

Groceries:ex = `=200.00`
Fuel:ex = `=90.00`
Second period = `=sum@ex`
```

`First period` is 1010.00. Its aggregate closes local `ex` after evaluating.
`Groceries` opens a fresh local `ex`, so `Second period` is 290.00. A global
`sum:ex` after both periods is 1300.00.

Closure is selective. `sum@ex` closes only `ex`; other local histories and
groups remain active. Filters affect the returned selection but still close
the queried accumulation as a whole. Bare declarations and unrelated labels
do not close anything merely by appearing.

If no accumulation is active, local aggregates re-evaluate the most recently
closed accumulation's preserved declaration records. The closing function's
numeric result is not cached as the accumulation: a block closed with `avg`
can subsequently be read with `min`, `max`, `count`, or different filters.
These reads do not reopen it. A new matching declaration starts a fresh member
set. If no matching accumulation has ever existed, the evaluator reports an
unknown-local-group error. Older closed accumulations are not addressable by
index or name.

## Regional aggregation

Use `top`, optionally with a unique name, and `bottom` to delimit a positional
region:

```markdown
`=top`

A = `=10`
B = `=20`
Running = `=sum:>`

`=bottom`

Final = `=sum:>`

`=top:pay 1`
Pay = `=40`
`=bottom`

Pay 1 total = `=sum:>pay 1`
```

Regional reads do not close the region. While a region is active, `sum:>` reads
its successful declarations. After `bottom`, it rereads the latest completed
region. A read before any region exists is an error.

`top` while a region is active and `bottom` while none is active are errors.
An active region at end of file produces a warning. Both keywords are
case-insensitive and reserved as normalized labels, sigils, variable names,
aggregate targets, and filter terms; multiword names such as `Top Amount`
remain valid.

A name becomes readable only after its region closes. It is normalized in its
own namespace and may therefore match an ordinary variable or sigil. Region
names cannot be reused. Forward reads and named reads while that region is
still active are errors; use plain `:>` for the active region. Filters on a
named read select memberships within that completed region.

Every aggregate function and filter works with `:>`:

```markdown
`=median:>`
`=sum:>{food,fuel}{!paid}`
```

Declarations whose own expressions contain aggregates remain regional members
but are omitted from regional aggregate selection. This prevents direct
subtotals from being counted again. There is currently no syntax to widen the
selection and include them.

Use square brackets to collect first-level aggregate results already declared
inside the active or latest completed region:

```markdown
`=top`
DoorDash Total = `=sum:doordash`
Nayax Total = `=sum:nayax`
OpenAI Total = `=sum:openai`
`=bottom`

Discretionary = `=sum:>[]`
```

The outer function selects only declarations whose entire expression is the
same ordinary aggregate function. Thus `sum:>[]` selects pure `sum` results,
while `sum:x + 10`, a variable reference, a pure `avg`, and an earlier
`sum:>[]` result are excluded. All six numeric functions support this form.
Filters such as `sum:>[]{approved}` inspect the subtotal declarations rather
than the declarations consumed by their inner sums. `list:>[]` is not defined.

## Aggregate functions

The supported aggregate functions are:

- `sum`
- `count`
- `avg`
- `median`
- `min`
- `max`
- `list`

Use one colon for a global group and `@` for a local accumulation:

```markdown
`=sum:ex`
`=count:ex`
`=avg:ex`
`=median:ex`
`=min:ex`
`=max:ex`

`=sum@cac`
`=count@cac`
`=avg@cac`
`=median@cac`
`=min@cac`
`=max@cac`
```

Aggregates use only successful preceding declarations. An unknown base group or local accumulation is an error rather than zero.

For a known group with no members remaining after filtering:

- `sum` returns 0.
- `count` returns 0.
- `list` returns an empty string.
- `avg`, `median`, `min`, and `max` report an empty-aggregate error.

Only dimensionless numeric declarations can be used by numeric aggregates. Unit-bearing quantities and text values are rejected as numeric aggregate members.

`list` is the exception: it returns selected declaration labels in document
order, joined with a comma and space, and does not inspect their values:

```markdown
DoorDash:ss = `=30.47`
OpenAI:ss = `=7.04`
Contributors = `=list:ss` <!-- DoorDash, OpenAI -->
```

It supports global (`list:ss`), local (`list@ss`), and regional (`list:>`)
selection plus ordinary filters. A known empty selection returns an empty
string. A list result may be assigned and directly displayed through its
variable; using text in arithmetic or a numeric aggregate is an error.

Aggregates can appear inside ordinary arithmetic, and whitespace around the
operator is optional:

```markdown
Projected = `=sum:ex+10`
Remaining = `=Budget-sum:ex`
```

Arithmetic operators terminate the preceding aggregate target and therefore
cannot appear in sigil or aggregate-target names.

An aggregate result may be assigned to an unqualified label and reused as a variable:

```markdown
Expense Total = `=sum:ex`
Budget Remaining = `=Budget - Expense Total`
```

An aggregate result cannot be attached in a way that makes it a member of the
aggregate that computes it. This prevents recursive or order-sensitive group
membership.

## Aggregate filters

Filters select aggregate members by their other group memberships.

Members of either `food` or `fuel`:

```markdown
`=sum:ex{food,fuel}`
```

Members of both `ex` and `food`:

```markdown
`=sum:ex{food}{ex}`
```

Members not in `reimbursed`:

```markdown
`=sum:ex{!reimbursed}`
```

Filter rules are:

- Sigils separated by commas inside one clause use OR.
- Multiple clauses use AND.
- A negative clause excludes the union of its listed sigils.
- Positive and negative sigils cannot be mixed in the same clause.

Examples:

```markdown
`=sum:ex{food,fuel}{!reimbursed}`
`=count@cac{card,cash}`
```

The base group must exist. A filter sigil does not need a separate declaration; it can simply match no members.

## Evaluation order and precision

The note is evaluated in document order. Each expression can see only successful declarations and group entries above it. Reading View and Live Preview share the same document-level evaluation model.

Numeric literals retain their written decimal scale where possible. Variables preserve their scale. Arithmetic and aggregate output preserve useful input scale up to the configured decimal precision. A finite non-zero result is never rendered as zero: when the configured precision would show only zeros, Quantities extends the display just far enough to reveal the first significant digit. `count` is always an integer.

Change the normal maximum displayed decimal places with **Decimal precision** in plugin settings. The allowed range is 0–10 and the default is 4. The non-zero safety rule may extend a result beyond that limit. Trailing zero behavior is influenced by the source values and operation rather than every result being forced to a fixed width.

## Commands

Open the Command Palette to use:

### Convert units in selection or current line

Converts a selected plain-text conversion, or the conversion on the current line, and replaces it with an equation-style result:

```text
5 ft to cm
```

becomes:

```text
5 ft = 152.4 cm
```

The marker is not required because invoking the command explicitly supplies calculation intent.

### Insert unit conversion result only

Converts the selection or current-line conversion and replaces it with only the formatted result. It can also act on recognized inline expressions.

### Toggle rendered calculations in active editor

Temporarily toggles rendered calculations for the active editor.

### Update Quantities markers in current file

Migrates recognized expressions in the active note from the stored previous marker to the current marker. A confirmation describes the affected file and marker change. Ambiguous standalone arithmetic is not rewritten.

The calculator ribbon icon runs the current-line unit conversion action.

## Settings

### Decimal precision

Sets the normal maximum displayed decimal places from 0 through 10. Default: 4. Quantities may exceed this limit when necessary to prevent a non-zero value from appearing to be zero.

### Expression marker

Sets the exact prefix that claims an inline code expression for Obsidian Quantities. Default: `=`.

### Render in Live Preview

Controls whether marked calculations render automatically in Live Preview. Reading View rendering remains available.

### Unit display overrides

Each canonical unit can use:

- the default display
- an abbreviation
- the full unit name

Overrides affect presentation, not conversion semantics.

### Material densities

Adds or edits named material densities used by mass/volume conversions. Density units supported by the settings interface include:

- g/ml
- kg/m³
- lb/ft³
- oz/fl oz

Material names should be distinct after case normalization.

Densities are persisted with the other settings in `data.json`:

```json
{
  "densities": [
    { "name": "maple syrup", "value": 1.37, "unit": "g/ml" },
    { "name": "olive oil", "value": 0.91, "unit": "g/ml" }
  ]
}
```

Hand-editing is supported by the data shape, but the settings interface is safer because it validates the name, value, and density unit.

## Supported unit categories

The converter includes units in these categories:

- length
- area
- mass
- volume
- speed
- acceleration
- data
- time
- pressure
- energy
- power
- temperature

Use common full names or abbreviations in expressions. The unit display setting controls how canonical results are rendered.

## Diagnostics and troubleshooting

Obsidian Quantities reports calculation errors at the expression rather than silently substituting zero. Diagnostics include:

- unknown or malformed units
- incompatible conversions
- unknown materials or missing density data
- malformed arithmetic
- division by zero or non-finite results
- unknown variables and forward references
- self-reference without an earlier value
- incorrect expression marker
- malformed declarations or aggregates
- unknown global groups
- unknown local accumulations
- invalid or mixed filter clauses
- empty `avg`, `median`, `min`, or `max`
- attempts to aggregate unit-bearing values
- attempts to attach aggregate results to groups

If an aggregate unexpectedly reports an unknown group, check that at least one successful qualified declaration occurs above it and uses the active marker.

If a declaration appears valid but later references cannot find it, check:

1. The inline code begins with the active marker.
2. The assignment has whitespace around `=`.
3. The expression itself has no diagnostic.
4. The reference appears below the declaration.
5. The declaration is not inside a code fence or HTML comment.

If a marked expression is visible rather than rendered in Live Preview, move the cursor outside it, confirm Live Preview rendering is enabled, and check whether rendering was toggled off for that editor.

## Compatibility with Dataview and other plugins

The default `` `=` `` syntax can overlap with plugins that claim the same inline-code prefix. Set a different expression marker to give Obsidian Quantities a distinct namespace, then run **Update Quantities markers in current file** for each note you want to migrate.

Obsidian Quantities treats its configured marker as authoritative. After changing it, old-marker expressions do not continue calculating. This avoids having two active syntaxes with ambiguous ownership.

Ordinary inline code and ambiguous old-marker arithmetic are left alone. Compatibility ultimately depends on the other plugin's own parsing and rendering rules.

## Syntax reference

Assuming the default marker:

```text
Conversion              `=5 ft to cm`
Density conversion      `=30 ml of maple syrup to g`
Arithmetic              `=(2 + 3) * 4`
Variable declaration    Name = `=expression`
Variable reference      `=Name * 2`
Qualified declaration   Name:group:other = `=expression`
Global aggregate        `=sum:group`
Local aggregate         `=sum@group`
Regional top marker     `=top`
Regional bottom marker  `=bottom`
Regional aggregate      `=sum:>`
Positive filter         `=sum:group{a,b}`
Negative filter         `=sum:group{!a,!b}`
Combined filters        `=sum:group{a,b}{!c}`
Display mode            `=5 ft to cm | value`
```

## Current limitations

- Evaluation is note-local; variables and groups do not cross file boundaries.
- Evaluation is top-down; forward references are unsupported.
- One declaration is recognized per line.
- Aggregation is limited to dimensionless numeric values.
- Recursive or order-sensitive aggregate membership is unsupported.
- Local accumulations expose only the active or most recently closed accumulation.
- A successful `@` aggregate closes its queried local accumulation after evaluation.
- Regional reads expose only the active or latest completed region.
- Headings and other Markdown structure have no semantic role.
- The marker migration command works on the active file, not the entire vault.
- Plugin settings, including a customized marker, must be synchronized separately from note content.

## Plugin data

Obsidian stores plugin settings in `data.json`, including decimal precision, the active and previous markers, Live Preview rendering preference, unit display overrides, and configured material densities. Edit settings through Obsidian when possible so values are validated.

## Development

```bash
npm install
npm test
npm run build
```

The build produces the Obsidian plugin bundle. See
[SEMANTICS.md](SEMANTICS.md) for normative language rules and
[DESIGN_RECORD.md](DESIGN_RECORD.md) for their rationale. Unimplemented ideas
live in [FUTURE_IDEAS.md](FUTURE_IDEAS.md), while confirmed implementation
problems are tracked in [DEFECTS.md](DEFECTS.md).
