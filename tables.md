# Table calculations: design exploration

> This document records an evolving idea, not a specification or rule set.
> Syntax, semantics, scope, and implementation details remain open to change.

## Goal

Make Markdown tables more useful for presenting information that includes
calculated values. When an input cell changes, a dependent result should be
recalculated and rendered in its table cell. Quantities should provide this
without turning into a general spreadsheet application or requiring duplicate
declarations outside the table.

For example, a table might contain quantity and price inputs and render a
calculated total in another cell. It should also be possible to aggregate cells
across rows or columns.

The arithmetic itself is not the main design problem. The difficult part is
identifying tables and defining references that remain understandable and safe
when a table changes.

## A table as an exclusive calculation region

A calculable table would be explicitly marked as a table region. The marker
would opt the table into modified calculation behavior; ordinary Markdown
tables would retain their current meaning.

The table region would be exclusive:

- table regions could not nest;
- an ordinary regional scope could not open inside a table region;
- expressions in the region would use table reference rules;
- leaving the table would restore ordinary document evaluation rules; and
- table cells would not accidentally become ordinary declarations or group
  members.

This does not necessarily require a separate calculation engine. The existing
arithmetic, decimal, unit, formatting, outcome, diagnostic, and rendering code
could remain shared. A table evaluation context would add table structure,
cell references, collections, dependencies, and table-specific diagnostics.

The form of the table-region marker is not yet decided.

## Reference identity: place, not name

Displayed row and column names should be separate from calculation identity.
Renaming a column from `Amount` to `Total` must not break its formulas, require
rebinding, or produce a stale-reference warning. A heading is presentation,
not a binder.

References would therefore be based on locations within the table. Possible
reference categories include:

- a cell relative to the formula cell;
- an absolute cell location within the table;
- a row or column location; and
- a positional range used as an aggregate input.

The exact notation is undecided. R1C1-like references, Org-style row/column
references, and other forms are possibilities rather than requirements.

Location-based references make the distinction between edits important:

- changing a cell value should recalculate dependent results;
- changing a displayed heading should have no calculation effect; and
- inserting, deleting, or moving rows or columns may change what a location
  denotes and therefore requires structural-change detection.

## Structural changes should be detected, not repaired silently

The engine should not rewrite formulas or reinterpret references merely
because table structure changed. When an edit could cause a reference to point
somewhere different, Quantities should alert the user that the table is no
longer structurally as it was when the reference was established.

This is closer to working with an Excel table while automatic intervention is
disabled: ordinary value changes can be recalculated, but structural changes
that affect reference meaning require review.

Potential reference states are:

- **valid**: the reference still denotes the established location;
- **stale**: the table structure changed and the binding needs review; and
- **broken**: the referenced location no longer exists.

The user, not the engine, should decide whether to accept a new structure,
change the formula, or restore the table. Detecting valid-but-changed bindings
will require retaining enough information about the table's prior structure.
How and where that information is retained is still an open design question.

## Formula and result placement

The rendered result should appear in the cell that owns it. Two possible forms
are worth exploring.

### Formula in the cell

The cell contains its expression and Quantities renders the result at that
source position:

```markdown
| Item | Quantity | Price | Total |
| ---- | -------- | ----- | ----- |
| Pens | 2        | 1.50  | `=<relative cell expression>` |
```

This is explicit and fits the current inline-expression rendering model.

### Formula below the table with a cell placeholder

A reusable formula could be written beneath the table and evaluated at one or
more marked placeholders inside it. Each placeholder would provide both the
row context and the exact source position at which to render the result.

This could support calculated columns without repeating the complete formula
in every row. A cell could potentially override a shared formula with a direct
expression. The syntax for formulas and placeholders is not decided.

A placeholder is preferable to rendering into an unmarked empty cell because
it provides a stable, explicit source anchor for Live Preview and Reading View.

## Table structure parser

Before references can be resolved, Quantities needs a conservative source
parser that produces a trustworthy rectangular table model. Parsing and
evaluation should be separate stages.

### 1. Find the marked table

The table-region marker identifies where table calculation semantics are
intended. A valid Markdown header and delimiter establish the beginning of the
table; the Markdown table structure establishes its end.

### 2. Parse rows and cells

The parser must account for:

- optional leading and trailing pipes;
- alignment markers in the delimiter row;
- escaped pipes;
- pipes occurring inside Markdown constructs that do not delimit cells;
- exact source offsets for every cell and expression; and
- constructs excluded from ordinary expression scanning, such as fenced code
  and HTML comments.

### 3. Establish a rectangular grid

The header and delimiter rows establish the column count. Each data row must
map unambiguously to that grid. Missing or additional cells should produce a
structural diagnostic rather than causing the parser to guess or shift cells.

The resulting model might resemble:

```ts
interface ParsedTable {
	from: number;
	to: number;
	columnCount: number;
	headers: TableCell[];
	rows: TableRow[];
}

interface TableCell {
	row: number;
	column: number;
	from: number;
	to: number;
	content: string;
}
```

### 4. Validate before evaluating

The complete table should be parsed and structurally validated before any cell
formula is evaluated. If the grid is ambiguous, calculation should stop with a
specific diagnostic rather than risk reading the wrong cell.

Table expressions must also be separated from ordinary inline-expression
evaluation so that the same expression is not evaluated twice under different
rules.

## Table evaluation context

Once a valid grid exists, a table context could expose:

- table boundaries;
- the current formula cell;
- current row and column locations;
- resolution of relative and absolute references;
- row, column, and range collections for aggregation;
- dependency information and cycle diagnostics; and
- outcomes indexed by source offset for existing rendering paths.

The existing evaluator could consume resolved scalar values and aggregate
results. Table-only behavior should be isolated behind the table context rather
than distributed as unrelated special cases throughout the arithmetic parser.

## Influences, not prescriptions

Org-mode demonstrates table-local formulas, positional references, ranges, and
formula definitions outside displayed cells. Excel tables demonstrate a useful
conceptual distinction among a table, its data body, its columns, its current
row, and its totals. Both are useful references, but neither syntax or behavior
must be copied.

In particular, Excel can rewrite structured references because it owns the
workbook and its editing operations. Quantities operates on ordinary Markdown
that may be edited by any tool, so silent reference rewriting would be less
reliable and less appropriate.

## Open questions

- What syntax marks an exclusive table region?
- What notation identifies relative cells, absolute cells, rows, columns, and
  ranges?
- How are data rows distinguished from a totals row or other special rows?
- How are reusable formulas and their placeholders written?
- What structural information must be retained to detect changed bindings?
- Where should that information live so notes remain portable?
- When should a structurally stale table stop evaluation versus render prior
  results with a warning?
- What are the rules for empty, text, quantity, and erroneous cells in an
  aggregate?
- Which dependencies may refer forward, and how are cycles reported?
- Which parts belong in the first useful implementation?

The immediate foundation is a reliable, offset-preserving Markdown table
parser. Reference syntax and evaluation rules should be designed against that
model rather than embedded into an ad hoc line parser.
