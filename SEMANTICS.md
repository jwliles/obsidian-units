# Grouped Calculation Semantics

## Status and scope

This document is the normative specification for declarations, variables,
membership histories, global aggregates, and local accumulations. The manual
explains these rules for users; `DESIGN_RECORD.md` records their rationale.

“Must,” “must not,” and “only” describe behavioral commitments. Presentation,
commands, unit conversion syntax, and general arithmetic syntax remain covered
by `MANUAL.md` except where they affect declarations or aggregation.

## Expression ownership and scanning

Only single-backtick inline code beginning with the configured Units marker is
evaluated. The default marker is `=`:

```markdown
CAC = `=150.00` <!-- Units declaration -->
CAC = `150.00`  <!-- ordinary inline code; no declaration -->
```

The marker is exact and case-sensitive. An expression using a known previous
marker may receive an incorrect-marker diagnostic, but it creates no value or
membership.

Fenced code blocks and HTML comments are excluded from scanning. Markdown
headings, lists, blockquotes, tables, emphasis, and blank lines affect
presentation only; they do not establish evaluation or accumulation scope.

## Declaration grammar

A declaration consists of a label, optional attached sigils, a
whitespace-surrounded assignment delimiter, and one marked inline expression:

```text
LABEL[:SIGIL...] = `MARKER EXPRESSION`
```

Examples:

```markdown
CAC = `=150.00`
CAC:ex = `=150.00`
- CAC:ex = `=150.00`
| 2026-08-05 | CAC:ex = `=150.00` |
```

The declaration must occupy the current line or the final ledger field after
the last `|`. Common list markers are ignored. Exactly one declaration is
recognized per line, and its marked inline expression must be the declaration
value rather than unrelated inline code elsewhere on that line.

Labels must be nonempty. Literal `:` and `=` are structural and cannot be label
content. Labels may contain normalized whitespace. Sigils attach directly to
the label without whitespace after the colon. Empty sigils are invalid.

Explicit sigils:

- are compared case-insensitively after NFKC normalization;
- contain at most 64 Unicode code points;
- cannot contain whitespace or `:`, `=`, `{`, `}`, `,`, `!`, `|`, or a
  backtick;
- are deduplicated within one declaration.

Labels are compared case-insensitively after NFKC normalization. Leading and
trailing whitespace is removed, internal whitespace is collapsed, and common
Markdown formatting characters are ignored for lookup. Diagnostics should
retain the source spelling presented by the user.

## Evaluation order and successful records

The note is evaluated from top to bottom. Expressions can see only successful
declaration records above them; there are no forward references. Later records
never rewrite results already evaluated.

A successful declaration creates exactly one record with:

- a stable declaration identity;
- its source label and normalized label;
- its evaluated value and numeric scale;
- zero or more explicit sigils;
- its source position and provenance.

A failed declaration creates no record, joins no history or accumulation, and
does not replace an earlier successful variable value. A declaration that has
never succeeded cannot satisfy a later variable reference. A declaration's own
new value is not visible while its expression is being evaluated, although an
earlier successful record with the same label remains visible.

## Variables

Every successful declaration updates the variable identified by its normalized
label. Variable lookup returns the latest successful preceding value:

```markdown
Rate = `=10`
First = `=Rate * 2`  <!-- 20 -->
Rate = `=20`
Second = `=Rate * 2` <!-- 40 -->
```

Repeated labels therefore replace variable lookup while retaining every
declaration record for aggregation.

## Membership model

Every successful declaration belongs implicitly to the normalized history of
its label. Explicit sigils add cross-cutting memberships to that same record:

```markdown
CAC = `=120.00`        <!-- memberships: cac -->
CAC:ex = `=100.00`     <!-- memberships: cac, ex -->
CAC:cac:ex = `=80.00`  <!-- memberships: cac, ex -->
```

Membership never copies a value. Overlapping implicit and explicit membership
is deduplicated by declaration identity, so a record contributes at most once
to any aggregate. `CAC:cac` is valid but normally unnecessary.

Labels and sigils are membership indexes over records, not mutually exclusive
namespaces. A label and a sigil may share the same normalized spelling. An
explicit sigil does not suppress implicit label-history membership.

Membership targets and filter terms may refer to normalized multiword label
histories:

```markdown
City Bill:ex = `=86.00`
`=sum:city bill`     <!-- 86.00 -->
`=sum:ex{city bill}` <!-- 86.00 -->
```

## Aggregate syntax and functions

An aggregate consists of a function, scope separator, membership target, and
zero or more filter clauses:

```text
FUNCTION :  TARGET {FILTER...}  global
FUNCTION :: TARGET {FILTER...}  local
```

Function names are case-insensitive. The supported functions are:

- `sum`: arithmetic sum of selected values;
- `count`: number of selected declaration records;
- `avg`: arithmetic mean;
- `min`: minimum selected value;
- `max`: maximum selected value.

Only selected dimensionless numeric records can be aggregated. If the selected
members include a unit-bearing quantity, aggregation fails. A quantity excluded
by filters does not cause that error.

An unknown global membership target is an error. An aggregate appearing before
the target's first successful record is therefore unknown rather than zero.

For a known target whose filters select no records:

- `sum` returns `0`;
- `count` returns `0`;
- `avg`, `min`, and `max` fail with an empty-selection error.

`count` has integer scale. For `sum`, `avg`, `min`, and `max`, the greatest
written decimal scale among selected numeric members becomes the result's
minimum presentation scale. Additional digits required by the computed value
remain visible up to configured display precision. Empty `sum` has integer
scale.

## Global aggregation

A single colon reads every successful preceding record belonging to the target:

```markdown
`=sum:cac`
`=sum:ex`
```

Global aggregation never opens, closes, resets, or truncates local state. Later
declarations can increase a later global result but cannot alter an earlier
one.

## Local accumulation lifecycle

Each membership target independently maintains at most one active local
accumulation and a history of completed accumulations.

When a declaration record belongs to a target:

1. it joins that target's active accumulation, if one exists; or
2. it opens a fresh active accumulation and becomes its first member.

Because one record can have several memberships, it can join several
independent local accumulations simultaneously.

A successful double-colon aggregate reads the active accumulation for its
target and closes that entire accumulation after producing the result:

```markdown
Rent:ex = `=800.00`
Power:ex = `=150.00`
Total = `=sum::ex` <!-- 950.00; then ex closes -->

Groceries:ex = `=200.00` <!-- opens a fresh ex -->
Fuel:ex = `=90.00`
Total = `=sum::ex` <!-- 290.00; then ex closes -->
```

The following ordering rules are normative:

- the aggregate reads before closure;
- closure affects only the queried target;
- filters change the returned selection but closure still applies to the whole
  queried accumulation;
- a successful filtered `sum` or `count` that returns zero still closes;
- a failed local aggregate does not close, including an empty `avg`, `min`, or
  `max`;
- bare declarations, same-label redeclarations, unrelated declarations, and
  Markdown structure never close an accumulation;
- a global aggregate never closes an accumulation.

If a local aggregate is itself declared, closure occurs before the successful
aggregate-result record joins its own implicit history or unrelated explicit
memberships.

## Reading completed accumulations

If the target has no active accumulation, a local aggregate reads its most
recently completed accumulation. If an active accumulation exists, it always
takes precedence over every completed one, even when a filter selects no active
members.

Closing preserves the accumulation's declaration records, not the numeric
result of the function that closed it. Any function and filter may re-evaluate
those preserved members:

```markdown
Low:stats = `=2.00`
High:stats = `=8.00`

Average = `=avg::stats` <!-- 5.00; closes stats -->
Minimum = `=min::stats` <!-- 2.00 from preserved members -->
Maximum = `=max::stats` <!-- 8.00 -->
Count = `=count::stats` <!-- 2 -->
```

Reads of a completed accumulation do not reopen it, create another completed
copy, or replace its preserved records. The next matching declaration opens a
fresh accumulation. Older completed accumulations are not addressable by index
or name.

If a target has neither an active nor a completed accumulation, a local
aggregate fails with an unknown-local-group error.

At end of file, active accumulations are marked completed for provenance and
trace purposes. This does not retroactively change any evaluated result.

## Filters

Filters inspect every membership of each candidate declaration, including its
implicit label history and explicit sigils.

- Terms separated by commas within one clause are OR.
- Repeated clauses are AND.
- A positive clause keeps members matching at least one term.
- A negative clause excludes members matching any listed term.
- Positive and negative terms cannot be mixed within one clause.
- Duplicate terms do not duplicate selected records.

Examples:

```text
sum:ex{food,fuel}          ex AND (food OR fuel)
sum:ex{food}{card}         ex AND food AND card
sum:ex{!ob,!ls}            ex AND NOT (ob OR ls)
sum:ex{food,fuel}{!paid}   ex AND (food OR fuel) AND NOT paid
```

A filter term does not need an independently populated history. It may simply
match no candidate members.

## Aggregate-derived declarations and recursion

A successful aggregate may be assigned to a label and reused as a variable or
aggregated through its implicit label history:

```markdown
Running total = `=sum:ex`
Doubled = `=Running total * 2`
`=sum:running total`
```

It may also join an unrelated explicit membership. It must not join the same
target it is currently aggregating, whether through its implicit label or an
explicit sigil:

```markdown
Snapshot:summary = `=sum:ex` <!-- allowed -->
Total:ex = `=sum:ex`         <!-- rejected -->
ex = `=sum:ex`               <!-- rejected -->
```

This rule prevents direct recursive and order-sensitive self-membership.

## Provenance commitments

Aggregate provenance deduplicates declaration identities and source positions.
For a local aggregate, reported local-accumulation identifiers are restricted
to the queried target rather than unrelated accumulations shared by the same
records. Closing records the source position and, when applicable, the
declaration responsible for the close.

## Summary invariants

- One successful source declaration creates one record.
- Every record joins its implicit label history.
- Explicit sigils add memberships; they never replace implicit membership.
- A record contributes at most once to any aggregate result.
- Variable lookup uses the latest successful preceding record.
- Aggregation uses all selected successful preceding records in its chosen
  global history or local accumulation.
- Global reads never mutate local state.
- Only a successful double-colon aggregate closes local state.
- Local closure occurs after evaluation and affects only the queried target.
- Completed accumulations retain re-aggregatable member records.
- Failed declarations and failed aggregates produce no declaration record or
  closure side effect.
- Later declarations never rewrite earlier results.
- Markdown presentation never establishes calculation scope.
