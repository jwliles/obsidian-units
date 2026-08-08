# CURRENT_SCOPE_AND_SYNTAX_IDEAS

## Status

This document captures the current design discussion around scope, aggregation, structural syntax, and presentation. It is intentionally narrower than a full language redesign.

The main goal is to add regional aggregation and improve the readability of local aggregation without turning Obsidian Units into a bespoke type system.

Nothing here should replace established syntax without a compelling reason.

---

## 1. Keep the existing variable declaration

The established declaration remains:

```markdown
CAC = `=150.00`
```

This already works well and should not be changed merely to make newer syntax look more uniform.

A declaration:

- gives the expression a variable label;
- stores the latest successful value for later references;
- remains top-to-bottom;
- supports multiword labels.

Additional syntax should be added only when it carries information that this form cannot express.

---

## 2. Existing global groups remain simple

A declaration can explicitly join one or more note-wide groups:

```markdown
CAC:ex = `=150.00`
Reach:ex = `=135.00`

Total = `=sum:ex`
```

Meaning:

```text
:ex       membership in global group ex
sum:ex    aggregate all preceding successful members of ex
```

Global aggregation is intentionally broad. Every preceding declaration carrying the sigil participates.

Repeated variable labels and group membership remain separate concepts:

```markdown
CAC:cac = `=300.00`
CAC:cac = `=200.00`

Latest CAC = `=CAC`       <!-- 200.00 -->
Total CAC = `=sum:cac`    <!-- 500.00 -->
```

The current `:group` syntax is compact and useful. There is no reason to replace it.

---

## 3. Local aggregation uses `@`

The current local aggregate spelling is:

```markdown
`=sum::ex`
```

It differs from the global form only by one additional colon:

```text
sum:ex
sum::ex
```

That is mechanically valid but visually weak because the reader must count repeated punctuation.

The preferred replacement is:

```text
sum:ex    global ex
sum@ex    local/current ex
```

`@` is used as an addressing or pointing operator: “look at the current/local `ex` accumulation.”

The declaration syntax does **not** change:

```markdown
CAC:ex = `=150.00`
Reach:ex = `=135.00`
```

The same qualified declarations continue feeding both their note-wide group and their local accumulation under the existing declaration-continuity rules.

Only the aggregate target spelling changes:

```markdown
Global Total = `=sum:ex`
Local Total = `=sum@ex`
```

### Rule

```text
:name     note-wide named group
@name     current/local named accumulation
```

`@` should remain narrow. It is not a new declaration marker, currency marker, or general metadata operator.

---

## 4. Regional aggregation is a different capability

Global and local aggregation both require explicit group membership.

For example:

```markdown
CAC:ex = `=150.00`
Reach:ex = `=135.00`
```

Both entries explicitly opt into `ex`.

There is currently no aggregate meaning:

> Sum every eligible declaration in this bounded portion of the note, whether or not it has a sigil.

That is the proposed **regional** capability.

### Motivation

Consider:

```markdown
CAC = `=150.00`
Reach = `=135.00`
```

The values can be added manually:

```markdown
Q1 Total = `=CAC + Reach`
```

but they cannot be aggregated because they do not belong to a group.

Artificial sigils solve the problem:

```markdown
CAC:q1 = `=150.00`
Reach:q1 = `=135.00`

Q1 Total = `=sum:q1`
```

but `:q1` may exist only to manufacture a subtotal boundary.

Regional aggregation would make the boundary explicit instead of forcing every declaration to carry a temporary group name.

---

## 5. Tentative regional syntax: `:>`

The current candidate is:

```markdown
`=:>`
```

to begin a region, and:

```markdown
`=sum:>`
```

to aggregate it.

Example:

```markdown
`=:>`

CAC = `=150.00`
Reach = `=135.00`

Q1 Total = `=sum:>`

`=:>`

CAC = `=140.00`
Reach = `=120.00`

Q2 Total = `=sum:>`
```

Expected results:

```text
Q1 Total = 285.00
Q2 Total = 260.00
```

The headings, blank lines, list structure, and prose around these declarations have no semantic effect.

The `:>` marker itself defines the region.

### Why `:>`

`>` has a directional reading: from this point forward.

It is visually distinct from both:

```text
:ex
@ex
```

and avoids punctuation counting.

The colon can be read as introducing a structural construct, while `>` identifies the region operation.

### Region lifetime and explicit close

Regional scope should use explicit structural markers:

```text
:>    open or redeclare a region
:<    close the active region
```

A later `:>` may close the current region and immediately begin another.

Regional aggregate reads do **not** close the region:

```markdown
`=:>`

A = `=100`
B = `=50`

Running = `=sum:>`

C = `=25`

Running Again = `=sum:>`

`=:<`
```

Both reads inspect the same still-open region.

### Why regional and local scope close differently

Local and regional scope admit members differently.

Local scope still requires explicit sigil membership. An unrelated untagged declaration can sit inside an otherwise open local window without becoming part of that accumulation. Because nothing unintended joins in the meantime, closing can safely be deferred until the local aggregate is read.

Regional scope has no equivalent membership filter: position itself is membership. An open region therefore continues admitting eligible declarations until explicitly ended.

Regional scope needs a close marker that can be placed when the logical boundary is known **without requiring a regional aggregate to be evaluated there**.

That is the load-bearing difference between the two closing models.

The close marker terminates membership; reads merely inspect the current region.

### Residual author responsibility

Explicit close does not make logical boundaries inferable.

If the author forgets to close a region, or forgets to open/redeclare a new region before a later logical block, unrelated declarations may still be merged silently because the source remains grammatically valid.

That is an authoring-discipline issue rather than something the parser can reasonably infer without syntax.

---

## 6. Scope model

The aggregate forms are:

```text
sum:ex    all preceding members of note-wide group ex
sum@ex    current/latest local accumulation of ex
sum:>     eligible declarations in the active region
```

| Form | Membership | Reach | Closing behavior |
| --- | --- | --- | --- |
| `sum:ex` | explicit `:ex` membership | all preceding note content | no scope close |
| `sum@ex` | explicit `:ex` membership | current/latest local accumulation | local read semantics |
| `sum:>` | positional regional membership | active explicit region | read does not close |

Regional structure is explicit:

```text
:>    open/redeclare
:<    close
```

Regional aggregation is not another group namespace.

Its defining feature is that declarations participate because they occur inside an explicitly bounded region, not because each declaration carries a shared sigil.

---

## 7. Regional functions

If regional aggregation is accepted, the existing aggregate functions should probably carry over:

```markdown
`=sum:>`
`=count:>`
`=avg:>`
`=min:>`
`=max:>`
```

The existing numerical rules should remain:

- `sum` — sum selected numeric declarations;
- `count` — count selected declarations;
- `avg` — mean;
- `min` / `max` — extrema;
- aggregation remains limited to supported numeric values.

Regional scope should not create a separate family of arithmetic behavior.

### Aggregate-bearing declarations are excluded by default

Regional aggregation should be narrow by default.

A declaration whose **own expression contains an aggregate operation** is excluded from later regional aggregates unless the regional aggregate explicitly opts it back in.

Example:

```markdown
`=:>`

A = `=100`
B = `=50`

Subtotal = `=sum:>`

C = `=25`

Grand Total = `=sum:>`

`=:<`
```

`Grand Total` should evaluate from `A`, `B`, and `C`, not from `A`, `B`, `Subtotal`, and `C`.

This avoids the common silent double-counting failure produced by running subtotals inside an open region.

The rule is intentionally syntactic rather than transitive:

```markdown
Subtotal = `=sum:ex`        <!-- aggregate-bearing: excluded by default -->
Adjusted = `=Subtotal + 10` <!-- not aggregate-bearing by this rule -->
```

Following provenance through variable dependencies would require a substantially larger dependency/type system and is outside the current scope.

### Explicit widening modifier

The opt-in for aggregate-bearing declarations should **not** live inside `{...}` filter braces.

Braces have one established semantic domain: boolean logic over sigil membership. Aggregate-bearing status is a property of the declaration itself, not group membership.

The aggregate grammar therefore gets a separate modifier slot:

```text
FUNCTION TARGET [MODIFIER] [FILTERS]
```

Conceptually:

```text
sum:>                    raw/non-aggregate declarations only
sum:><modifier>          include aggregate-bearing declarations too
sum:>{!income}           default regional selection, then sigil filtering
sum:><modifier>{!income} widened regional selection, then sigil filtering
```

The exact modifier token remains undecided.

Evaluation order should be:

```text
active region
    ↓
eligible successful declarations
    ↓
exclude aggregate-bearing declarations by default
    ↓
optionally widen to include them
    ↓
apply sigil filters
    ↓
aggregate
```

The modifier widens the candidate set. Filters then narrow by sigil membership.

This preserves the broader design bias: narrow by default, explicit to widen.

---

## 8. Interaction between global, local, and regional aggregation

The mechanisms should remain independent.

Example:

```markdown
`=:>`

CAC:cac:ex = `=150.00`
Reach:ex = `=135.00`
Income:ic = `=500.00`

Regional Total = `=sum:>`
Expense Total = `=sum:ex`
CAC Total = `=sum:cac`
```

The same declaration may participate in:

- one or more global groups;
- the corresponding local accumulations;
- the active region.

A regional boundary must not:

- reset global groups;
- close local accumulations;
- change variable reassignment behavior.

Likewise, local-continuity behavior must not define regional boundaries.

Regional reads must not close the region. Only `:<`, a redeclaring `:>`, or other explicitly defined structural boundary behavior should change regional membership.

Aggregate-bearing declarations remain excluded from regional aggregation by default unless the aggregate call uses the explicit widening modifier.

---

## 9. Pipes remain presentation-aware syntax, not scope

The preferred ledger form is:

```markdown
- 2026-08-06 | CAC = `=253.75` | Paid 250.00 - 3.75 is a fee
```

Conceptually:

```text
DATE | DECLARATION | NOTE
```

Pipes are useful because they visually separate fields, but they should not create groups, local accumulations, or regions.

They may still have a syntactic role as declaration-field boundaries:

- an outside pipe separates Markdown/ledger fields;
- a pipe inside the inline code span belongs to expression syntax, such as `| value`;
- Units syntax should never leak across an outside pipe.

A pipe is therefore a parsing boundary, not a calculation boundary.

---

## 10. Reading View versus Live Preview

Live Preview should always expose full calculation syntax. It is the authoring surface.

Reading View may present a cleaner representation.

Possible Reading View behavior:

Source:

```markdown
- 2026-08-06 | CAC:cac:ex = `=253.75` | Paid 250.00 - 3.75 is a fee
```

Rendered:

```text
2026-08-06 | CAC = 253.75 | Paid 250.00 - 3.75 is a fee
```

Potential Reading View changes:

- conceal sigils;
- remove code-like typography from rendered results;
- let calculated values inherit surrounding font, size, baseline, and spacing;
- preserve pipes because they are deliberate presentation structure.

This is a rendering concern, not an evaluation concern.

---

## 11. Currency is currently a presentation problem

A source form such as:

```markdown
CAC = $`=253.75`
```

does not appear to break parsing, but the currency symbol looks visually detached from the rendered value.

Several richer ideas were considered, including currency annotations and typed values, but that discussion quickly approached a general type system.

For now, currency should remain separate from the scope-grammar work.

Possible future paths include:

- Reading View styling that visually joins an external currency symbol to the rendered result;
- a small presentation-only currency feature;
- a true currency-aware value model, but only if semantic currency arithmetic is actually desired.

No currency syntax should be added merely because the scope grammar is being revised.

---

## 12. Keep the grammar small

A formal grammar is now useful, but it should describe the syntax that actually exists or is being proposed rather than inventing a large general language.

The important layers are:

```text
Markdown / host structure
    ↓
Units declaration / structural syntax
    ↓
expression syntax
    ↓
evaluation
```

### Host structure

Recognize:

- inline code spans;
- line boundaries;
- list markers;
- outside pipes as field separators;
- fenced code and comments as non-evaluated contexts.

### Structural syntax

Current/emerging constructs:

```text
LABEL = `=EXPR`            ordinary declaration
LABEL:group = `=EXPR`      global group membership

sum:group                  note-wide group aggregate
sum@group                  local/current aggregate

:>                         open/redeclare regional scope
:<                         close regional scope
sum:>                      regional aggregate
sum:><modifier>            regional aggregate widened to include
                           aggregate-bearing declarations

{...}                      sigil-membership filtering only
```

### Expression syntax

Retain the existing:

- numbers;
- variables;
- arithmetic;
- unit conversions;
- aggregates;
- filters;
- display modes.

The parser does not need a universal type system or a large punctuation taxonomy to support these ideas.

---

## 13. Structural pre-pass before evaluation

The parser should preferably establish the document's structural skeleton before numerical evaluation.

A two-stage model is sufficient:

```text
Pass 1: parse and validate structure
Pass 2: evaluate top-to-bottom
```

The structural pass can identify:

- declarations;
- group memberships;
- local aggregate targets;
- regional opens and closes;
- aggregate calls;
- malformed or unmatched structural markers.

This makes regional boundaries and diagnostics easier to enforce without repeatedly scanning backward or forward from every aggregate call.

Conceptually, the structural pass can resolve source markers into validated region ranges before evaluation.

That does **not** permit the parser to infer missing logical boundaries. If one syntactically valid region accidentally contains two conceptual blocks, the parser has no basis for splitting them. Silent logical merges remain the author's responsibility.

The main benefit of the pre-pass is stronger structural invariants and cleaner diagnostics, not speculative intent recovery.

---

## 14. Reserved syntax should be narrow

The grammar should reserve exact structural tokens where possible rather than aggressively restricting every character everywhere.

For example, if adopted:

```text
:>      regional construct
@       local-addressing operator in aggregate position
```

should be parsed before generic names.

The main rule is:

> A recognized structural token cannot fall through and become an ordinary sigil or identifier.

This is enough to keep the grammar deterministic without creating a large global whitelist/blacklist system prematurely.

---

## 15. Potential conversion cleanup

Obsidian Units currently accepts `->` as a unit-conversion separator.

If `>` becomes the regional structural character, removing `->` would reduce visual and conceptual reuse of `>`.

Conversions would still support:

```text
to
as
in
```

This would be a deliberate compatibility break and should be judged against actual use of `->`.

---

## 16. Remaining open questions

### Regional widening modifier token

Regional aggregates exclude aggregate-bearing declarations by default.

A separate modifier slot is accepted in principle for explicitly widening the candidate set, but the exact token is not yet selected.

It should be visually distinct before brace parsing begins.

### Regional filters

Sigil filters are expected to remain useful for regional aggregation:

```markdown
`=sum:>{!income}`
```

The braces retain their existing meaning: boolean logic over sigil membership.

No pseudo-sigils such as `raw` or `agg` should be introduced into that namespace.

### Empty regional selections

No active region should be a structural error.

Within an active region, empty-result behavior should remain consistent with the aggregate function's established semantics rather than inventing region-specific arithmetic rules.

### Explicit close and redeclaration details

The structural intent is settled:

```text
:>    open/redeclare
:<    close
```

The exact parser behavior for malformed combinations should be specified in the formal grammar and fixtures, including:

- `:<` without an active region;
- repeated `:<`;
- `:>` while a region is already active;
- EOF with a still-open region, if explicit closure is made mandatory.

### Formal grammar

A small formal grammar is now justified to make the structural tokens and parser precedence explicit.

It should remain focused on:

- declaration boundaries;
- aggregate targets;
- regional markers;
- modifier position;
- sigil-filter position;
- host-level pipe/code-span boundaries.

It should not grow into a general type system.

---

## 17. Current design direction

```text
CAC = `=150.00`
    ordinary variable declaration; unchanged

CAC:ex = `=150.00`
    note-wide group membership; unchanged

`=sum:ex`
    note-wide group aggregate; unchanged

`=sum@ex`
    local/current aggregate; preferred replacement for `sum::ex`

`=:>`
    explicit regional open/redeclaration

`=:<`
    explicit regional close

`=sum:>`
    aggregate eligible declarations in the active region

`=sum:><modifier>`
    same regional aggregate, but explicitly widen the candidate set
    to include aggregate-bearing declarations

`=sum:>{...}`
    regional aggregate followed by ordinary sigil-membership filtering
```

### Design principles now established

1. Preserve the existing declaration syntax unless a new construct carries genuinely new information.
2. Use `@` to address the current/local named accumulation.
3. Keep regional scope explicit because positional membership has no sigil-membership safety net.
4. Regional reads do not close scope.
5. Use `:<` so the author can end regional membership without requiring a regional aggregate to be evaluated there.
6. Accept that syntactically valid silent merges caused by omitted boundaries are author-discipline errors that cannot reasonably be inferred.
7. Exclude aggregate-bearing declarations from regional aggregation by default to prevent routine subtotal double-counting.
8. Require an explicit aggregate-call modifier to widen regional selection and include aggregate-bearing declarations.
9. Keep that modifier outside `{...}` because braces remain exclusively about sigil membership.
10. Let filters narrow the already-selected candidate set.
11. Prefer a structural pre-pass so boundaries and malformed structure are resolved before numerical evaluation.
12. Keep the grammar small. Do not turn scope and presentation problems into a bespoke type system without an actual need.

The overall goal remains narrow: preserve the simple existing declaration/group model, remove the repeated-colon ambiguity from local aggregation, and add an explicitly bounded regional aggregate that is safe for ordinary ledger patterns.
