# Local Accumulations Design Record

## Status

Accepted. [SEMANTICS.md](SEMANTICS.md) is normative.

## Motivating case

Real notes contain several differently labeled entries followed by a total:

```markdown
Rent:ex = `=800.00`
Power:ex = `=150.00`
Water:ex = `=60.00`
Total = `=sum::ex`

Groceries:ex = `=200.00`
Fuel:ex = `=90.00`
Total = `=sum::ex`
```

The totals must be `1010.00` and `290.00`. The note must not need period
letters, filters, headings with semantic meaning, repeated vendor labels, or a
separate terminator.

## Decision

A local aggregate is a read-and-close operation. `sum::ex` reads the current
local `ex` accumulation, returns its result, and closes `ex` after evaluation.
The next declaration belonging to `ex` opens a fresh accumulation.

Closure is selective and expression-driven:

- `sum::ex` closes `ex` only.
- `sum:ex` is global and never closes anything.
- A bare or unrelated declaration does not close an accumulation.
- Filters do not partially close a group.
- Markdown structure does not open or close scope.

When no accumulation is active, a local aggregate reuses the most recently
closed accumulation's preserved member records. It does not reuse a cached
numeric result: a block closed by `avg::group` can subsequently be read with
`min::group`, `max::group`, `count::group`, or filtered aggregates. These reads
do not reopen or replace the completed accumulation. With no active or
completed accumulation, the evaluator reports an unknown local group.

## Rejected model

The previous implementation remembered the sigils used by each label and
closed them when the same label was later declared without those sigils. It
worked for a repeated `CAC` example but failed for ordinary ledgers whose rows
have different labels. That behavior and its fixtures are obsolete.
