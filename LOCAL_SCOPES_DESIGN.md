# Local Scopes Design Record

## Status

This document records the current understanding of local variable scope. The
core example and invariants below are agreed; syntax and behavior listed under
Open Questions remain deliberately undecided.

This design is independent of Markdown structure. Headings, lists, tables,
blank lines, blockquotes, and other presentation must not change calculation
semantics.

## Core example

```markdown
CAC = `135.00`
```

This is ordinary inline code because it lacks the configured Units marker. It
does not declare a variable and has no calculation effect.

```markdown
CAC = `=135.00`
```

This is an explicit global `CAC` declaration. It assigns `135.00` to the
global variable and does not participate in a local `cac` accumulation.

```markdown
CAC:cac = `=135.00`
CAC:cac = `=104.90`
```

These are explicit `CAC` declarations qualified for local `cac` accumulation.
Each declaration still updates the global `CAC` variable. Both values remain
members of the current local `cac` accumulation, so a local CAC subtotal can
include both transactions while ordinary variable lookup returns the latest
value, `104.90`.

```markdown
CAC = `=150.00`
```

This is a new global `CAC` declaration. It updates the global variable, does
not join local `cac`, and ends the preceding local CAC accumulation. A later
qualified declaration starts a new local accumulation:

```markdown
CAC:cac = `=75.00`
```

## Established invariants

- The configured expression marker determines whether an inline value is a
  Units expression. Assignment text outside an unmarked code span does not
  create a variable.
- Every successful explicit declaration updates the global variable for its
  normalized label.
- Variable lookup remains latest-successful-value lookup.
- A qualified declaration can contribute to local accumulation without losing
  its global variable effect.
- Repeated qualified declarations retain every local transaction even though
  variable lookup returns only the latest value.
- Returning the same label to an unqualified explicit declaration ends its
  preceding local accumulation.
- A later qualified declaration can begin a new local accumulation.
- Markdown structure has no effect on opening, accumulating, or ending local
  scope.
- Local scope must not require headings, scope directives, or a state-changing
  aggregate merely to establish its boundary.

## Related global-group proposal

A separate proposal would define global group classification independently of
individual value declarations. Conceptually:

```markdown
EX = `=CAC:Walmart:Aldi`
```

would classify declarations with those labels into global `ex`, allowing one
maintained list to affect the file. The exact syntax, evaluation order, and
whether classification is retroactive are not yet settled. This proposal is
related to local scope but is not required to understand the CAC example
above.

## Local accumulation model

The following rules resolve the initial implementation model. They are pinned
by `tests/04-local-scopes.md` before evaluator implementation.

- Local accumulations are keyed by normalized qualifier, not by Markdown
  region. `:cac` and `:ex` are independent local selections.
- A qualified declaration contributes to every qualifier it names:

  ```markdown
  CAC:cac:ex = `=135.00`
  ```

  contributes the same declaration to the active local `cac` and `ex`
  accumulations.
- Different labels can share a qualifier. `CAC:ex`, `Walmart:ex`, and
  `Aldi:ex` contribute to the same active local `ex` accumulation.
- A declaration with a given label remembers the qualifiers used by its most
  recent successful qualified declaration. A later successful declaration of
  the same label that omits one of those qualifiers closes that entire shared
  local accumulation after the new declaration evaluates. Declarations with
  unrelated labels do not close it.
- A later declaration using a closed qualifier opens a fresh accumulation with
  a new stable accumulation identifier.
- `sum::name`, `count::name`, `avg::name`, `min::name`, and `max::name` read
  the active local accumulation. If none is active, they read the most recently
  completed accumulation. Aggregates do not themselves close scope.
- Filters apply to the selected local accumulation using the existing filter
  semantics.
- End-of-file implicitly completes every active accumulation for provenance
  and trace purposes. Results already evaluated remain unchanged.
- A local aggregate with neither an active nor a completed matching
  accumulation produces `Unknown local group "name".`
- The initial implementation exposes only the active or most recently
  completed accumulation. Naming and selecting older completed accumulations
  remains future design work.

These rules intentionally preserve the core CAC behavior while making a local
expense qualifier usable across several vendor labels. The separate
global-group-classification proposal remains undecided and is not required for
the first local evaluator.

## Characterization fixture

`tests/04-local-scopes.md` contains:

- two qualified CAC payments;
- a local CAC subtotal;
- an unqualified CAC declaration that ends the local accumulation;
- a second qualified CAC accumulation;
- intervening declarations for other vendors;
- a global total and a local total whose expected values differ.

That fixture should settle the multi-label and closure questions before local
scope semantics are added to the evaluator.
