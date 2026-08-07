# Grouped Calculations Design Record

## Status

The normative rules live in [SEMANTICS.md](SEMANTICS.md). This record retains
only decisions and rationale that remain useful. Earlier experiments involving
same-label closure, punctuation terminators, self-sigil shorthand, and
label/sigil collision errors have been retired.

## Explicit ownership

Plugin expressions begin with the configured marker inside inline code. The
default is `=`. Unmarked inline code remains ordinary Markdown. Declarations
use a whitespace-surrounded assignment delimiter and occupy either the current
line or the final ledger field. One declaration per line is supported.

Labels may contain normalized whitespace but not structural `:` or `=`
characters. Attached colons introduce sigils. Sigils are case-insensitive after
Unicode normalization and reject whitespace and aggregate grammar characters.

## One record, several indexes

A declaration is one value-bearing record. Its normalized label provides an
implicit history index; explicit sigils add cross-cutting indexes. This makes
the common ledger form concise:

```markdown
CAC:ex = `=150.00`
```

The record is available through both `cac` and `ex`, but is never copied.
Deduplication uses declaration identity. This replaces the old requirement to
write `CAC:cac:ex` and rejects the later proposal that labels and same-named
sigils should collide.

Variable lookup and aggregation remain distinct operations: a variable returns
the latest successful record for its label, while an aggregate retains every
selected preceding record.

## Scope

The August projections ledger establishes the required behavior. Several
distinctly labeled expenses are followed by a `Total` line. Inferring closure
from a later unqualified declaration of the same label cannot delimit that
shape and caused confirmed cross-period bleed.

The selected rule gives punctuation an operational meaning:

- `function:group` reads note-wide preceding history and does not mutate scope.
- `function::group` reads the active local accumulation and closes that group
  after evaluation.
- The next matching declaration opens a fresh local accumulation.

Closure belongs to the aggregate expression, not to the label `Total` and not
to Markdown headings. An unrelated bare declaration cannot accidentally close
active groups. Filters change selection but do not change what is closed.

## Filters

Filters retain their established behavior. Commas are OR, repeated clauses are
AND, and a negative clause excludes the union of its terms:

```text
sum:ex{!ob,!ls} = ex AND NOT (ob OR ls)
```

Mixed-polarity clauses are errors. Positive and negative counterparts partition
the base group. Empty filtered selections return zero for `sum` and `count` and
error for `avg`, `min`, and `max`.

## Evaluation and errors

Evaluation is top-down. Only successful preceding declarations participate.
There are no forward references, and later declarations do not rewrite earlier
results. Failed declarations do not replace a previous successful variable or
join histories and groups.

Aggregate results may be assigned to labels and reused as variables. Recursive
or order-sensitive aggregate membership must still be rejected where it would
make a declaration contribute to the aggregate that computes it.

Unknown variables and groups are errors rather than zero. Diagnostics preserve
source spelling and suggestions remain namespace-appropriate to the expression
being resolved.

## Markdown and rendering

Headings, lists, tables, blockquotes, and blank lines are presentation only.
Fenced code blocks and HTML comments are excluded from scanning. Live Preview
and Reading View share the same document evaluation model.

## Deferred work

- Calculation traces showing variable provenance and aggregate membership.
- A canonical sigil grammar table shared by parser and documentation.
- Fixture-level marker configuration or a permanently default-marker corpus.
- Decisions for aggregating unit-bearing quantities and aggregate-derived
  declaration histories beyond the existing recursion safety rule.
