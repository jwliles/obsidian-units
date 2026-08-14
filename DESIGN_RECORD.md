# Grouped Calculations Design Record

## Status

The normative rules live in [SEMANTICS.md](SEMANTICS.md). This record retains
only decisions and rationale that remain useful. Earlier experiments involving
same-label closure, punctuation terminators, self-sigil shorthand, and
label/sigil collision errors have been retired. Accepted but unimplemented
directions are consolidated in [FUTURE_IDEAS.md](FUTURE_IDEAS.md); confirmed
implementation defects are tracked in [DEFECTS.md](DEFECTS.md).

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

Numeric evaluation uses canonical decimal strings and a 40-significant-digit,
half-even context for all operations. Native JavaScript numbers are
compatibility shadows only and cannot feed later calculations. Presentation is
separate: the configured decimal precision is the normal fixed-notation cap,
non-zero values cannot render as zero, and values needing more than ten decimal
places use typographic scientific notation. The same formatter serves scalar,
aggregate, and conversion results.

Markdown transclusions are evaluated from the complete embedded source file,
then narrowed to the embedded heading or block for rendering. The host note's
variable state never enters the embedded evaluation.

## Scope

The August projections ledger establishes the required behavior. Several
distinctly labeled expenses are followed by a `Total` line. Inferring closure
from a later unqualified declaration of the same label cannot delimit that
shape and caused confirmed cross-period bleed.

The selected rule gives punctuation an operational meaning:

- `function:group` reads note-wide preceding history and does not mutate scope.
- `function@group` reads the active local accumulation and closes that group
  after evaluation.
- The next matching declaration opens a fresh local accumulation.
- Exact `top` and `bottom` expressions delimit positional regions.
- `function:>` reads the active or latest completed region without closing it.
- `top:name` creates a uniquely named region that becomes addressable through
  `function:>name` after closure.
- `FUNCTION:>[]` combines first-level, root-only results of the same numeric
  aggregate function within the selected current region.
- `list` reuses ordinary aggregate selection but returns contributor labels as
  a text value; numeric use of that text fails explicitly.

Closure belongs to the aggregate expression, not to the label `Total` and not
to Markdown headings. An unrelated bare declaration cannot accidentally close
active groups. Filters change selection but do not change what is closed.

Regional structure is separately balanced because position itself is
membership. Aggregate-containing declarations remain regional members but are
excluded from regional aggregate selection to avoid subtotal duplication.
`top` and `bottom` are reserved after identifier normalization.

## Filters

Filters retain their established behavior. Commas are OR, repeated clauses are
AND, and a negative clause excludes the union of its terms:

```text
sum:ex{!ob,!ls} = ex AND NOT (ob OR ls)
```

Mixed-polarity clauses are errors. Positive and negative counterparts partition
the base group. Empty filtered selections return zero for `sum` and `count` and
error for `avg`, `median`, `min`, and `max`.

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

Headings, lists, blockquotes, and blank lines are presentation only. Fenced
code blocks and HTML comments are excluded from scanning. Pipe-separated
ledger fields are deliberately supported because calculation-oriented notes
often place dates or annotations beside declarations. Formal Markdown tables
are not a supported host; incidental resemblance to ledger syntax is not a
language guarantee.

Live Preview and Reading View share the same document evaluation model. Reading
View conceals declaration sigils and valid `top` and `bottom` markers because
they carry calculation metadata rather than prose or values. This cleanup is
strictly presentational: Source Mode exposes complete syntax continuously,
Live Preview follows Obsidian's normal render/reveal behavior, the Markdown is
never rewritten, and diagnostics remain visible.

## Aggregate spelling and boundaries

`avg` was retained instead of adding the synonymous `mean`. `median` addresses
the useful case of a center value, including the mean of the two middle values
for an even selection. `mode` remains deferred until a concrete scalar use case
also establishes useful tie behavior.

Named aggregate targets terminate at arithmetic operators even without
whitespace. Compact calculator expressions such as `sum:ex+10` are therefore
natural and unambiguous; the corresponding tradeoff is that arithmetic
operators and parentheses are unavailable in membership names.

An evaluated declaration explicitly records whether its own parsed expression
contains an aggregate. Regional reads can then exclude aggregate-containing
declarations without dependency or provenance analysis. Merely referencing a
previous aggregate result does not set this flag.

## Deferred work

- Calculation traces showing variable provenance and aggregate membership.
- A canonical sigil grammar table shared by parser and documentation.
- Fixture-level marker configuration or a permanently default-marker corpus.
- Decisions for aggregating unit-bearing quantities and aggregate-containing
  declaration histories beyond the existing recursion safety rule.
- File eligibility controlled by an All/None default, vault-relative path/glob
  exceptions that invert it, and boolean `quantities: true` or `false`
  frontmatter as the final override.
- Multi-region member-set selection, indexed regions, broader bracket query
  forms, and `list:>[]`.
- A `mode` aggregate, unless a use case establishes its tie semantics.
- Currency as either presentation or a semantic value type.
