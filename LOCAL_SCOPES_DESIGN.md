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

## Open questions

1. What aggregate syntax reads the current or most recently completed local
   accumulation?
2. Does an intervening declaration with a different label affect an open local
   CAC accumulation, or is closure controlled only by the next CAC
   declaration?
3. How do multiple local qualifiers on one declaration behave?

   ```markdown
   CAC:cac:ex = `=135.00`
   ```

4. How does one local expense accumulation include different labels such as
   CAC, Walmart, and OG&E without relying on Markdown boundaries?
5. Does end-of-file implicitly close an open local accumulation, and can an
   open accumulation still be queried before closure?
6. Are local names and global group names separate namespaces?
7. How are completed local accumulations identified if a later aggregate needs
   to include or exclude one of them?
8. How do filters apply to local accumulations?
9. What diagnostics should be produced for a local aggregate when no matching
   local accumulation exists?

## Next design test

Before implementation, add a characterization fixture containing:

- two qualified CAC payments;
- a local CAC subtotal;
- an unqualified CAC declaration that ends the local accumulation;
- a second qualified CAC accumulation;
- intervening declarations for other vendors;
- a global total and a local total whose expected values differ.

That fixture should settle the multi-label and closure questions before local
scope semantics are added to the evaluator.
