# Quantities Future Ideas

This file contains only unimplemented directions. `SEMANTICS.md` and
`MANUAL.md` define current behavior, while `DESIGN_RECORD.md` preserves the
rationale for settled decisions.

## 1. Provenance / value trace

A **Trace Quantities Value** command could explain the declaration under the
cursor without changing evaluation semantics. The smallest useful version is a
copyable text modal; a live, pinnable sidebar can follow later.

A trace should be built from evaluator records rather than reconstructed from
rendered text. It may show:

- the source declaration and final result;
- variable resolution and the supplying declaration;
- aggregate scope, candidates, selected contributors, and filters;
- arithmetic subexpressions where that information is retained;
- exclusions and diagnostics where they clarify a surprising result.

Example:

```text
Period Total = 534.53
  sum:> (region lines 27–35)
    CAC          253.75
    OG&E          83.30
    Progressive  143.50
    Spotify       12.99
    Shell Oil      35.00
    NYTGames        5.99
```

The trace is explanatory only. It must not introduce provenance-dependent
selection or otherwise affect a note's result.

## 2. Multi-region member-set selection

Named completed regions currently support one-region reads such as
`avg:>period 1`. A future selector could union the members of several completed
regions and run one aggregate over that combined set.

This is distinct from combining finished aggregate results:

```text
period 1 members: 10, 20      avg = 15
period 2 members: 100         avg = 100

average of results: (15 + 100) / 2 = 57.5
average of members: (10 + 20 + 100) / 3 = 43.3333…
```

`FUNCTION:>[]` already implements the first model within one region by
collecting finished, root-only results of the same function. Multi-region
selection would implement the second model: resolve regions, union declaration
identities, apply filters once, then aggregate once. Overlapping selections
must not count the same declaration twice.

No syntax is settled. Braces should remain membership filters, and there is no
demonstrated need for an all-regions selector.

## 3. Broader bracket selection

The implemented bracket form is deliberately narrow: `FUNCTION:>[]` collects
eligible results of that same function from the active or latest completed
region. Forms such as these remain deferred:

```text
sum:[]
sum:>[vendor]
sum:[vendor,other]
list:>[]
```

They should not be introduced until a use case establishes both their scope
and their interaction with ordinary filters. In particular, `list:>[]` is
ambiguous between listing declarations whose values are lists and flattening
the labels represented by those lists.

## 4. File eligibility

If evaluation expands beyond the currently opened source note, settings should
make file participation explicit:

- an **All files / No files** default;
- path and glob exceptions that invert that default;
- path suggestions using Obsidian's public suggestion APIs where available;
- an exact file path as a valid exception, not only folder globs;
- a frontmatter boolean such as `quantities: false` or `quantities: true` as
  the final per-file override.

Thus an empty exception list has an unambiguous meaning under either default,
while **No files** plus one path supports evaluating only one note. Glob
library choice, case sensitivity, normalization, and rename handling must be
settled before implementation.

## 5. Deferred aggregate functions

`mode` remains deferred until a compelling scalar use case and tie policy are
clear. Currency conversion likewise remains outside the unit engine until an
exchange-rate source, timestamp policy, caching model, and offline behavior are
specified.
