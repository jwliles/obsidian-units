# CONSOLIDATED_SCOPE_AND_AGGREGATION_PROPOSAL

## Status

Proposal. Not implemented and not yet part of `SEMANTICS.md`.

This document consolidates the current scope and syntax ideas with the local
and regional aggregation proposal. It defines the intended design rather than
preserving compatibility with earlier experimental syntax.

The proposal has three goals:

1. Preserve the existing declaration and note-wide group model.
2. Make local aggregation visually distinct from global aggregation.
3. Add explicitly bounded positional aggregation without making Markdown
   headings, lists, or layout semantically significant.

Currency, a general value type system, named historical regions, and
cross-note evaluation remain outside this proposal.

---

## 1. Existing declarations remain unchanged

The established declaration syntax remains:

```markdown
CAC = `=150.00`
```

A successful declaration:

- assigns its value to the normalized variable label;
- replaces the value returned by later variable lookup for that label;
- joins the implicit aggregation history of its label;
- may join one or more explicit groups;
- is visible only to expressions below it in the note.

Explicit group membership also remains unchanged:

```markdown
CAC:ex = `=150.00`
Reach:ex = `=135.00`

Total = `=sum:ex`
```

Repeated labels and group membership remain independent:

```markdown
CAC:cac = `=300.00`
CAC:cac = `=200.00`

Latest CAC = `=CAC`       <!-- 200.00 -->
Total CAC = `=sum:cac`    <!-- 500.00 -->
```

No new declaration syntax is introduced merely to make newer constructs look
uniform.

---

## 2. Three aggregation forms

Aggregation varies along two axes:

- how declarations become members; and
- how the membership window is bounded.

| Form | Spelling | Membership | Lifetime |
| --- | --- | --- | --- |
| Global | `sum:ex` | Explicit or implicit group membership | Entire preceding document |
| Local | `sum@ex` | Explicit or implicit group membership | Closes on successful read |
| Regional | `sum:>` | Position inside an explicit region | Closes only at a structural boundary |

In summary:

```text
:name    note-wide named membership
@name    current or latest local accumulation
:>       current or latest positional region
```

These mechanisms are independent. A declaration may simultaneously belong to
one or more global histories, one or more local accumulations, and the current
regional accumulation.

---

## 3. Local aggregation uses `@`

The local aggregate spelling becomes:

```markdown
Global Total = `=sum:ex`
Local Total = `=sum@ex`
```

`@` replaces the earlier double-colon spelling. The old `sum::ex` form is
removed from the implementation, documentation, fixtures, and working notes.
No compatibility alias or migration mechanism is required.

`@` is an addressing operator: read the current or latest local accumulation
associated with the named membership.

### Local lifecycle

A successful declaration joins a local accumulation for every implicit or
explicit membership it carries. If no active accumulation exists for a
membership, the declaration opens one.

A successful local aggregate:

1. reads the active accumulation for its target;
2. closes that entire accumulation after evaluation; and
3. preserves its members as the latest completed accumulation.

If no active accumulation exists, a local aggregate rereads the latest
completed accumulation. It does not reopen or duplicate it.

```markdown
Rent:ex = `=800.00`
Power:ex = `=150.00`
First period = `=sum@ex`       <!-- 950.00; closes ex -->

Groceries:ex = `=200.00`
Fuel:ex = `=90.00`
Second period = `=sum@ex`      <!-- 290.00; closes new ex -->
Latest period = `=sum@ex`      <!-- 290.00 again -->
Global expenses = `=sum:ex`    <!-- 1240.00 -->
```

Local closure remains selective:

- `sum@ex` closes only `ex`;
- filters affect the returned selection but not which accumulation closes;
- a successful empty `sum` or `count` closes;
- a failed `avg`, `median`, `min`, or `max` does not close;
- global and regional reads never close local state.

---

## 4. Regional aggregation

Global and local aggregation require named membership. Regional aggregation
instead admits successful declarations by position inside an explicitly
bounded portion of the note.

This supports blocks whose declarations do not otherwise need a shared sigil:

```markdown
`=:>`

CAC = `=150.00`
Reach = `=135.00`

`=:<`

Q1 Total = `=sum:>`             <!-- 285.00 -->
```

Headings, blank lines, list structure, blockquotes, and prose do not open,
close, or partition a region. Only Units structural markers do so.

### Regional structural markers

```text
:>    open a region
:<    close the active region
```

With the default expression marker, they are written as:

```markdown
`=:>`
`=:<`
```

Regional boundaries are strictly balanced. Opening a region while another
region is active is a structural error; it does not implicitly close or replace
the first region. Consecutive regions require an explicit close between them:

```markdown
`=:>`
A = `=10`

`=:<`

`=:>`
B = `=20`

`=:<`
```

`A` belongs to the first region and `B` belongs to the second.

Both an opener while a region is active and a closer while no region is active
are structural errors. Each marker therefore has exactly one state transition:

```text
:>    closed → open
:<    open → closed
```

This makes duplicate markers detectable and prevents a missing close from
being silently accepted as region redeclaration.

### Regional reads do not close

A regional aggregate reads without changing regional state:

```markdown
`=:>`

A = `=100`
B = `=50`

Running = `=sum:>`              <!-- 150 -->

C = `=25`

Running again = `=sum:>`        <!-- 175 -->

`=:<`
```

Only `:<` ends admission to the active region. A new `:>` is invalid until the
active region has been explicitly closed.

This differs intentionally from local aggregation. Local membership has a
named-membership filter, so unrelated declarations do not join while the
accumulation waits to be read. Regional membership has no such filter:
position itself is membership. Its boundary must therefore be expressible
independently of when or whether a total is read.

### Active and latest-completed reads

`sum:>` follows the same active/latest principle as local aggregation:

- if a region is active, it reads that region;
- otherwise, it reads the latest completed region;
- if no region has ever been opened, it errors.

This permits totals to sit outside their membership boundary:

```markdown
`=:>`
A = `=10`
B = `=20`
`=:<`

Total = `=sum:>`                <!-- 30 -->
```

Declarations written after `:<` and before the next `:>` do not join the
completed region and do not alter later rereads of it.

Older completed regions are not addressable by index or name.

### Preserving regional results

A regional aggregate can be assigned to a variable when its result must remain
available after a later region becomes current:

```markdown
`=:>`
Q1 CAC = `=150`
Q1 Reach = `=135`
`=:<`

Q1 Total:period-total = `=sum:>` <!-- stores 285 -->

`=:>`
Q2 CAC = `=140`
Q2 Reach = `=120`
`=:<`

Q2 Total:period-total = `=sum:>` <!-- stores 260 -->

Difference = `=Q1 Total - Q2 Total`
All Periods = `=sum:period-total`
```

The declaration stores an ordinary successful value. It can be referenced as
a variable, assigned explicit memberships, and aggregated through the existing
global group model, as shown by `period-total` above.

Repeated labels can provide the same result history through their implicit
membership:

```markdown
`=:>`
A = `=10`
`=:<`
Period Total = `=sum:>`

`=:>`
B = `=20`
`=:<`
Period Total = `=sum:>`

All Periods = `=sum:period total`
```

This preserves aggregate snapshots, not the membership records of historical
regions. A stored `Q1 Total` can be reused, but it cannot later answer a new
question such as `count`, `min`, or a different filter over Q1's original
members.

The existing variable and group mechanisms are therefore the preferred way to
retain regional results. Named or indexed historical regions should be
considered only if a concrete need emerges to re-query their original members.

---

## 5. Regional functions and filters

Regional targets support the aggregate functions shared by global and local
scope:

```markdown
`=sum:>`
`=count:>`
`=avg:>`
`=median:>`
`=min:>`
`=max:>`
```

Existing arithmetic behavior remains unchanged:

- `sum` returns the sum of selected numeric declarations;
- `count` returns the number of selected declarations;
- `avg` returns their arithmetic mean;
- `median` sorts the selected values numerically and returns the middle value,
  or the arithmetic mean of the two middle values for an even-sized selection;
- `min` and `max` return their extrema;
- selected unit-bearing quantities cause an error;
- empty `sum` and `count` return zero;
- empty `avg`, `median`, `min`, and `max` error.

`avg` remains the sole spelling for arithmetic mean. No `mean` alias is added.
`median` follows the existing numeric presentation rule: the greatest written
decimal scale among selected members becomes its minimum display scale, while
additional digits produced by averaging an even middle pair remain visible up
to the configured precision.

Sigil filters may narrow regional candidates using their existing meaning:

```markdown
`=sum:>{income}`
`=sum:>{!income}`
`=sum:>{food,fuel}{!paid}`
```

Filters continue to express boolean logic over declaration membership only.
They do not express declaration provenance or structural status.

Evaluation order is:

```text
active or latest completed region
    ↓
successful eligible declarations
    ↓
exclude directly aggregate-derived declarations
    ↓
apply ordinary membership filters
    ↓
aggregate
```

---

## 6. Aggregate-derived declarations

A declaration whose own expression is an aggregate is excluded from regional
membership by default.

```markdown
`=:>`

A = `=100`
B = `=50`
Subtotal = `=sum:>`             <!-- 150; excluded from the region -->
C = `=25`
Grand Total = `=sum:>`          <!-- 175, not 325 -->

`=:<`
```

This rule prevents direct subtotal double-counting, which is particularly
likely because regional reads do not close their region.

The rule is syntactic and intentionally narrow:

```markdown
Subtotal = `=sum:ex`            <!-- directly aggregate-derived; excluded -->
Adjusted = `=Subtotal + 10`     <!-- scalar expression; not excluded -->
```

It does not claim to prevent all dependency-based double-counting. Ordinary
derived declarations may still overlap with their inputs:

```markdown
A = `=100`
B = `=50`
Adjusted = `=A + B`
```

Detecting that overlap reliably requires arithmetic dependency provenance,
which the current evaluator does not maintain. That is a possible future
diagnostic rather than part of regional membership semantics.

No widening modifier is introduced now. A mechanism for explicitly including
direct aggregate results should be added only when a concrete authoring need
establishes its syntax and expected safety behavior.

---

## 7. Boundary errors and diagnostics

Regional syntax can detect structural mistakes, but it cannot infer missing
author intent.

### Structural diagnostics

The following conditions are detectable:

- `:>` with an active region: error at the second opener;
- `:<` with no active region: error at the close marker;
- regional read before any region has existed: error at the aggregate;
- malformed regional marker: error at that marker;
- an open region at end of file: document-level warning associated with its
  opener.

An open region at EOF is initially a warning rather than a hard evaluation
error. During editing, a region may legitimately remain temporarily open, and
all expressions already evaluated inside it still have deterministic results.

### Valid but unintended structure

The evaluator cannot detect that a syntactically valid boundary was placed at
the wrong logical position. It also cannot know that an opener was intended if
the author writes declarations outside every region and never attempts a
regional read.

The grammar validates structure as written. It does not attempt to recover
intent that was never encoded.

---

## 8. Interaction with existing state

Regional structure must not:

- reset global membership histories;
- open or close local accumulations;
- change variable reassignment behavior;
- make Markdown headings or lists semantic;
- duplicate a declaration that has overlapping group memberships;
- change declaration success or failure rules.

Likewise:

- global reads do not affect regional state;
- local reads do not affect regional state;
- regional reads do not affect local state;
- failed declarations join no region;
- structural markers are not declarations and create no variable or group
  record.

---

## 9. Pipes and host Markdown

Pipes remain presentation and parsing boundaries, not calculation scope:

```markdown
- 2026-08-06 | CAC = `=253.75` | Paid 250.00; 3.75 is a fee
```

An outside pipe may separate ledger fields. A pipe inside the Units expression
continues to introduce display syntax:

```markdown
Distance = `=5 mi to km | value`
```

Regional boundaries do not interact with either use.

Markdown tables require special care because a table parser may treat a pipe
inside inline code as a cell separator. Table documentation and fixtures
should specify whether expression pipes must be escaped in Obsidian source.

---

## 10. Reading View and Live Preview

Live Preview remains the authoring surface and reveals the full source when the
cursor intersects an expression.

Reading View may simplify declarations by:

- concealing group sigils;
- removing code typography from rendered results;
- inheriting surrounding font, size, baseline, and spacing;
- preserving outside pipes used as ledger layout.

Regional markers need an explicit rendering policy. Rendering them as an empty
value can leave blank paragraphs or empty list items. The preferred behavior
is either:

1. render a small, subdued boundary indicator; or
2. suppress both the marker and its otherwise-empty host container.

This is presentation behavior only. It must not affect evaluation.

---

## 11. Markdown and plugin compatibility

`@`, `:>`, and `:<` occur inside marked inline code and do not conflict with
core Markdown blockquotes, HTML, properties, links, or ordinary uses of those
characters.

The meaningful compatibility boundary remains the configurable expression
marker. Dataview uses `=` as its default inline-query prefix, so a vault using
both plugins must give one of them a different prefix. Dataview inline fields,
Templater commands, Meta Bind inputs and buttons, and Tasks syntax use distinct
outer forms and do not conflict with the proposed internal operators.

The `->` conversion separator remains supported. Conversion arrows and
regional targets occur in different grammatical positions, so reusing `>`
does not create parser ambiguity:

```text
5 ft -> cm
sum:>
```

---

## 12. Grammar direction

The document language gains structural expressions but remains small:

```text
DECLARATION       := LABEL MEMBERSHIPS? " = " MARKED_EXPRESSION
MEMBERSHIPS       := (":" MEMBERSHIP)+

EXPRESSION        := STRUCTURAL | AGGREGATE | SCALAR

STRUCTURAL        := ":>" | ":<"

AGGREGATE         := FUNCTION TARGET FILTER*
FUNCTION          := "sum" | "count" | "avg" | "median" | "min" | "max"
TARGET            := ":" MEMBERSHIP | "@" MEMBERSHIP | ":>"
FILTER            := "{" FILTER_TERMS "}"
```

This grammar is illustrative rather than a complete Unicode or whitespace
specification. The normative grammar should preserve existing label,
membership, filter, and normalization rules.

Recognized structural targets must be parsed before generic membership names.
A structural token cannot fall through and become an ordinary identifier.

---

## 13. Implementation model

The expression AST should distinguish three node families:

```ts
type ExpressionNode = ScalarExpressionNode
  | AggregateExpressionNode
  | StructuralExpressionNode;

type StructuralExpressionNode =
  | { kind: 'region-open' }
  | { kind: 'region-close' };
```

Aggregate scope becomes:

```ts
type AggregateScope = 'global' | 'local' | 'regional';
```

The evaluation context gains regional state containing:

- the active region, if any;
- the latest completed region, if any;
- a monotonically increasing region ordinal;
- member declaration records;
- open and close source offsets.

The existing top-to-bottom document evaluation pass can implement the required
semantics directly. A mandatory structural pre-pass is not required.

A later pre-pass may still be useful for richer syntax validation or editor
decorations, but it must not enable forward references or change evaluation
order.

Document-level warnings require the evaluation index to expose diagnostics
that are not ordinary expression results. An unclosed-region warning should be
anchored to its opener rather than to a synthetic invisible expression at EOF.

Direct aggregate exclusion should be represented explicitly on the declaration
record, rather than inferred later from numeric provenance.

---

## 14. Required tests

Regional aggregation should have its own fixture covering at least:

### Basic membership

- declarations inside a region join it;
- declarations before open or after close do not join it;
- failed declarations do not join;
- headings, lists, quotes, blank lines, and prose have no scope effect.

### Lifecycle

- open, read, add, and reread shows a growing active result;
- close followed by read returns the latest completed region;
- repeated reads of a completed region are stable;
- a new opener after an explicit close creates a distinct current region;
- an opener while active errors without implicitly closing the first region;
- a close without an active region errors;
- a read before any region errors;
- declared regional results remain available after later regions become
  current;
- declared regional results can join and be read through global groups;
- EOF with an active region produces a warning.

### Functions and filtering

- `sum`, `count`, `avg`, `median`, `min`, and `max` use the specified numeric
  rules;
- empty selections follow existing function behavior;
- odd and even `median` selections return their specified middle value;
- positive, negative, OR, and AND filters work over regional candidates;
- selected quantities produce the existing quantity diagnostic.

### Aggregate-derived records

- a regional subtotal inside an open region is excluded from later reads;
- a global or local aggregate declaration inside a region is also excluded;
- an ordinary scalar expression referencing an aggregate remains eligible;
- the limitation around indirect dependency overlap is documented in the
  fixture rather than silently implied to be solved.

### Independence

- regional boundaries do not reset global groups;
- regional boundaries do not close local accumulations;
- local reads do not close regions;
- one declaration can participate in global, local, and regional state without
  duplication inside any one aggregate.

### Rendering and host syntax

- standalone structural markers do not leave unintended Reading View debris;
- structural markers work in lists and blockquotes;
- fenced code and HTML comments remain excluded;
- table behavior involving expression pipes is explicitly tested.

---

## 15. Settled direction

```text
CAC = `=150.00`
    ordinary declaration; unchanged

CAC:ex = `=150.00`
    explicit group membership; unchanged

`=sum:ex`
    note-wide aggregate; unchanged

`=sum@ex`
    current or latest local accumulation; closes an active accumulation
    after a successful read

`=:>`
    open a region; error if one is already active

`=:<`
    close the active region; error if none is active

`=sum:>`
    read the active region, or the latest completed region when none is active;
    does not close regional state

`=sum:>{...}`
    regional read narrowed by ordinary membership filters
```

The central design principles are:

1. Preserve existing declarations and global membership.
2. Use `@` as a visually distinct local-addressing operator.
3. Use explicit markers for positional membership boundaries.
4. Keep regional reads observational rather than state-closing.
5. Allow reads of the latest completed region so totals can sit outside their
   membership boundary.
6. Exclude direct aggregate declarations from regions by default to prevent
   routine subtotal duplication.
7. Do not claim that this syntactic exclusion solves arbitrary dependency
   overlap.
8. Keep filters limited to membership logic.
9. Keep Markdown presentation independent from calculation scope.
10. Extend the existing top-to-bottom evaluator instead of introducing a
    larger language or architecture without a demonstrated need.

---

## 16. Provisional regional boundary spelling

The regional lifecycle above is independent of the exact spelling of its
boundary markers. The original deferred question compared compact `:>` and
`:<` markers with explicit forms such as `region:start` and `region:end`.

Compact punctuation minimizes source length but is abstract and requires the
author to remember which direction opens or closes a region. Fully qualified
keywords are self-documenting, but repeating `region` is unnecessarily verbose
when the configured Units expression marker already establishes ownership of
the expression.

Source residue is not a controlling objection. Other popular Obsidian data
plugins require explicit source constructs that become inert Markdown when the
plugin is unavailable. Units expressions behave similarly, and a region adds
only two structural lines regardless of how many declarations it contains.

### Provisional direction

Replace the structural `:>` and `:<` markers with exact standalone `top` and
`bottom` expressions:

```markdown
`=top`

A = `=10`
B = `=20`

`=bottom`

Total = `=sum:>`
```

The terms describe spatial boundaries rather than operations:

```text
top       upper boundary of a region
bottom    lower boundary of a region
:>        this region
```

Their state transitions remain strictly balanced:

```text
top       closed → open; error if a region is already active
bottom    open → closed; error if no region is active
```

`top` and `bottom` neither calculate nor declare values. They are recognized
only as exact standalone structural expressions.

The regional aggregate target remains `:>`:

```text
sum:>     aggregate this region
```

Here, “this region” means the active region, or the latest completed region
when none is active. The target never opens or closes regional state. Its
utility does not depend on sharing a character with the boundary markers.

This preserves the scope model:

```text
sum:ex    named note-wide membership
sum@ex    current or latest named local accumulation
sum:>     current or latest positional region
```

This spelling is provisional. If accepted, `top` and `bottom` should replace
`:>` and `:<` only in their structural-marker role throughout the normative
examples, grammar, diagnostics, and tests. Regional aggregate targets such as
`sum:>` and `median:>` remain unchanged.

---

## 17. Deferred questions

The following are deliberately deferred:

- whether aggregate-derived regional membership ever needs an explicit opt-in;
- whether dependency provenance should support double-counting warnings;
- whether a demonstrated need to re-query original members justifies named or
  indexed historical regions beyond stored aggregate snapshots;
- whether a solid scalar use case and unambiguous tie behavior ever justify a
  `mode` aggregate; it is otherwise deferred indefinitely;
- whether EOF-open should become an error after the editing and diagnostic
  experience is established;
- whether a structural pre-pass becomes worthwhile for editor tooling;
- whether currency requires presentation-only behavior or a semantic value
  model.

These questions do not block implementation of the core local rename and
anonymous regional lifecycle defined above.
