# Quantities Future Ideas

This file preserves design exploration for both remaining ideas and recently
implemented features. `SEMANTICS.md` and `MANUAL.md` are authoritative for
runtime behavior; implemented sections below are retained as rationale rather
than competing specifications.

The present design status is:

| Area | Settled direction | Still unresolved |
| --- | --- | --- |
| Provenance | Explain actual evaluation; modal first; no semantic effects | Full arithmetic trace, sidebar, and identity across edits |
| Named completed regions (implemented) | `top:name`; readable after closure; contextual unique namespace | Multi-region selector spelling and all-regions need |
| Regional result collection (implemented) | `FUNCTION:>[]`; Design A; root-only same-function results; no bracket-derived candidates | Broader bracket forms |
| File eligibility | All/None default; path exceptions invert it; boolean frontmatter overrides | Exact glob library and case-sensitivity policy |
| `list` (implemented) | Contributor labels selected through normal aggregate scope and filters; reusable text value | `list:>[]` |

## 1. Provenance / Value Trace

Quantities could expose an inspectable trace showing how a declaration arrived at its current value.

The feature should explain what Quantities actually evaluated. It should not try to infer what the author intended.

### Initial interaction

A command such as **Trace Quantities Value** could be available when the cursor is on a Quantities declaration.

The first implementation could show a modal containing copyable plain text.

A later implementation could use a persistent sidebar that follows the declaration under the cursor or remains pinned to one declaration while the user edits elsewhere.

### Persistent sidebar concept

The sidebar would be text-oriented rather than graphical. As the note changes, the trace would rewrite itself in real time so the user can watch where the arithmetic is coming from.

Example:

```text
QUANTITIES TRACE
Line 39: Ending
Result: 266.58

Starting
  Line 37: Balance + Amount
    Balance
      Line 20: 155.89
    Amount
      Line 25: 645.22
    = 801.11

Period 1 Total
  Line 38: sum:>
  Region: lines 27-35
    Line 29: CAC          253.75
    Line 30: OG&E          83.30
    Line 31: Progressive  143.50
    Line 32: Spotify       12.99
    Line 33: Shell Oil     35.00
    Line 34: NYTGames       5.99
  = 534.53

801.11 - 534.53
= 266.58
```

### Why this is useful

Some authorial mistakes cannot be detected structurally.

For example, if the intended layout is:

```text
=top
A = 150
B = 135
=bottom

=top
A = 180
B = 155
=bottom
```

but the middle `bottom` / `top` boundary is omitted, the remaining syntax may still describe one valid region. Quantities cannot know that two regions were intended.

A trace of the resulting regional aggregate could reveal the problem by showing that all four declarations were selected.

The useful information is therefore not only the final arithmetic but also the candidate selection and provenance.

### Potential trace information

A trace may include:

- source declaration and line number;
- final result;
- variable resolution and the declaration that supplied the value;
- aggregate target;
- selected declaration members;
- excluded candidates and the reason for exclusion where useful;
- applied filters;
- regional boundaries;
- local accumulation state;
- arithmetic expansion;
- diagnostics relevant to the traced value.

For regional aggregates, a trace might look like:

```text
QUANTITIES TRACE
Line 8: Total = sum:>
Result: 620.00

Region
  Opened: line 2
  Closed: line 9

Selected
  Line 3: CAC   = 150.00
  Line 4: Reach = 135.00
  Line 6: CAC   = 180.00
  Line 7: Reach = 155.00

Evaluation
  150.00 + 135.00 + 180.00 + 155.00
  = 620.00
```

### Data model considerations

The first implementation guarantees declaration identity within one immutable
document evaluation. Source offsets can provide that snapshot identity and
deduplication key. Line numbers remain display and navigation aids.

Identity that survives arbitrary insertions, movement, or rewriting is a
separate editor-reconciliation problem. It should be deferred until persistent
trace pinning requires it rather than blocking the initial modal trace.

The evaluator would need enough provenance to answer questions such as:

1. Which declaration satisfied a variable reference?
2. Which declarations were candidates for an aggregate?
3. Which candidates were selected or excluded?
4. Why was a candidate excluded?
5. Which regional or local scope supplied the aggregate?
6. Which operands and subexpressions produced the final arithmetic result?

### Possible sidebar behavior

A future persistent view could support:

- follow-current-declaration mode;
- pinning a declaration while editing elsewhere;
- live reevaluation as the note changes;
- clickable source-line navigation;
- copyable plain-text output;
- expansion and collapse of nested dependencies;
- explicit display of aggregate membership and exclusions.

The provenance tracker is primarily a debugging and inspection tool. It should expose evaluator state, not alter evaluation semantics.

---

## 2. Implemented: Named Completed Regions; Future: Multi-Region Selection

Regional aggregation currently provides positional membership through `top` and `bottom`.

Quantities allows a region to be named when it is opened:

```text
=top:pay1
...
=bottom

=top:pay2
...
=bottom
```

The region name would reuse the existing normalized-name rules wherever they fit rather than introducing a separate region-name grammar.

### Completed-region lookup

A named region becomes addressable by name only after it has been closed.

While a region is active, it remains the active region and is addressed through the existing regional target:

```text
=sum:>
```

After `bottom`, its name can be used for completed-region aggregation:

```text
=sum:>pay1
=avg:>pay1
=median:>pay1
=max:>pay1
```

A named lookup of a still-active region should error; the active region already
has `:>`.

Forward references should also error under the existing top-down model:

```text
=sum:>pay1    # error: region not yet completed

=top:pay1
...
=bottom
```

### Namespace behavior

Region names should not be reserved against variables, global memberships, or local accumulations.

The syntax determines which namespace is being queried.

The same normalized spelling could legally exist in several roles:

```text
pay1              ordinary variable
sum:pay1          global label/sigil membership
sum@pay1          local accumulation
sum:>pay1         named completed region
```

No global precedence hierarchy or first-declaration cascade is required because lookup context determines the object type before the name is resolved.

### Region-name uniqueness

Within the regional namespace itself, names should be unique.

This should error:

```text
=top:pay1
...
=bottom

=top:pay1
...
=bottom
```

The second declaration should not shadow, merge with, or replace the first region.

A region name identifies exactly one positional region in the note.

### Regional semantics remain unchanged

Naming a region should not create a new aggregation system.

A named region should preserve the same regional behavior that applies to `:>`:

- positional membership;
- aggregate-containing declaration exclusion;
- declaration-identity deduplication;
- existing dimensional restrictions;
- existing empty-selection behavior;
- existing filter behavior;
- no reopening or mutation merely because the region is queried.

For example:

```text
=sum:>pay1{fuel}
```

means:

1. select completed named region `pay1`;
2. take its regional declaration members;
3. apply the existing `{fuel}` declaration-membership filter;
4. perform `sum`.

Braces should retain their current meaning and should not be overloaded to choose which regions participate.

### Main use case

Named completed regions separate data placement from report placement.

Without them, a user may need to calculate and store intermediate regional results while the region is active:

```text
=top
...
Period 1 Total:tl = =sum:>
=bottom

...

Report Total = =Period 1 Total
```

With a named region, the calculation can live at the report site:

```text
=top:pay1
...
=bottom

...

Period 1 Total   = =sum:>pay1
Period 1 Average = =avg:>pay1
Period 1 Maximum = =max:>pay1
```

A variable preserves a value.

A sigil/history preserves categorical membership.

A named region preserves positional membership for later querying.

### Design A versus Design B

There are two independent operations that can look like "combining regions."
They differ in what becomes the input to the final aggregate:

| Design | Combined input | Meaning |
| --- | --- | --- |
| A | Finished aggregate results | Aggregate over answers already calculated for each region |
| B | Original declaration members | Merge regional member sets, then calculate one aggregate |

#### Design A — combine aggregate results

Compute each region separately, producing finished scalar values, then combine
those values. Ordinary arithmetic can do this directly.

Example:

```text
=(avg:>pay1 + avg:>pay2) / 2
```

The regional aggregate-result collector provides the same Design A
operation when the finished results are declarations in a summary region:

```text
=top
Pay 1 Average = avg:>pay1
Pay 2 Average = avg:>pay2
=bottom

Average of Period Averages = avg:>[]
```

`avg:>[]` averages the two finished answers. It does not reopen `pay1` or
`pay2`, inspect their members, or weight an answer by its original member count.

#### Design B — combine regional member sets

Take the declaration members of several regions, merge them into one candidate
pool, and only then run one aggregate function over that pool.

Conceptually:

```text
pay1 members
     \
      -> merged candidate pool -> aggregate
     /
pay2 members
```

For example:

```text
pay1 = 10, 20
pay2 = 100
```

Design A could average the two regional averages:

```text
avg(10, 20) = 15
avg(100)    = 100

avg(15, 100) = 57.5
```

Design B instead merges the original members:

```text
avg(10, 20, 100) = 43.333...
```

These are different operations.

Named regions alone do not complete Design B across several regions. Naming
makes each completed member set addressable. A separate multi-region selector
is still required to choose `pay1` and `pay2`, union their members, and pass the
merged pool to one aggregate.

The responsibilities are therefore separate:

```text
named region             preserve and address one completed member set
FUNCTION:>[]             Design A over finished results in a summary region
future multi-region form Design B over members from several named regions
```

Both designs can involve named-region data. Design A combines answers returned
from named-region reads. Design B combines the named regions' source members.

### Scope of the future multi-region syntax

Only Design B needs multi-region selection syntax. Design A can use ordinary
arithmetic or the independently proposed `FUNCTION:>[]` summary-region
collector.

The syntax does not need to define new arithmetic. Its only job is:

> Select several named regions and produce one merged declaration pool.

After that pool exists, `sum`, `avg`, `median`, `min`, `max`, and `count` should behave normally.

The semantic pipeline should be:

```text
select named regions
    -> union their declaration identities
    -> deduplicate
    -> apply normal regional exclusions
    -> apply ordinary declaration filters
    -> aggregate
```

The exact syntax for selecting multiple regions is intentionally unresolved.

It should not overload existing braces, because braces already answer a different question: which declarations within the selected target satisfy the membership filter?

### No current all-regions selector

A built-in selector for every region does not currently have a demonstrated need.

In many cases, summing every region would be equivalent to, or no clearer than, aggregating the relevant declarations through existing global mechanisms.

If a real note later demonstrates a useful distinction between "all declarations in the file" and "all declarations that belong to any region," that can justify an all-regions selector at that time.

### Current proposal summary

```text
=top:pay1       open uniquely named region pay1
...
=bottom         close it; pay1 becomes addressable by name

=sum:>pay1      aggregate completed region pay1
=avg:>pay1
=sum:>pay1{ex}  filter declarations inside pay1

duplicate region name    -> error
forward region lookup    -> error
named lookup while open  -> error; use :> for the active region
multi-region member-set syntax -> deferred
all-regions selector -> no current requirement
```

The named-region extension should remain small. Its purpose is to make completed positional member sets addressable later without changing the semantics of regional aggregation itself.

---

## 3. Implemented: Regional Aggregate-Result Collection

The concrete August-expenses note establishes one narrow use for square
brackets: within a region, apply an aggregate function to declarations that are
themselves first-level, pure results of that same aggregate function.

```text
=top
DoorDash Total = sum:doordash
Nayax Total    = sum:nayax
OpenAI Total   = sum:openai
Walmart Total  = sum:walmart
=bottom

Discretionary Spending = sum:>[]
```

The region already establishes which subtotals belong together. Requiring a
shared `:discretionary` sigil on every subtotal would duplicate that positional
grouping.

`sum` is the motivating use case, but the selector applies uniformly:

```text
sum:>[]     sum pure sum results
count:>[]   count pure count results
avg:>[]     average pure avg results
median:>[]  take the median of pure median results
min:>[]     take the minimum of pure min results
max:>[]     take the maximum of pure max results
```

### Semantics

`FUNCTION:>[]`:

1. resolves the active region, or latest completed region, exactly as the
   corresponding ordinary `FUNCTION:>` read;
2. considers only successful declarations in that region;
3. selects declarations whose entire value expression is one ordinary
   aggregate using the same function;
4. excludes declarations produced by any `FUNCTION:>[]` expression;
5. applies the outer function to the selected declarations' evaluated values;
6. does not follow variable or dependency provenance;
7. does not close or otherwise mutate the region.

“Pure aggregate result” is a syntactic classification of the root expression:

```text
A = sum:doordash         selected
B = sum:nayax{paid}      selected
C = sum:openai + 10      not selected
D = sum:reach-sum:refund not selected
E = A                    not selected
F = sum:>[]              not selected by a later sum:>[]
G = avg:nayax            selected by avg:>[], not sum:>[]
```

Excluding bracket-derived declarations prevents automatic subtotal accumulation:

```text
A = sum:x
B = sum:y
C = sum:>[]
D = sum:>[]
```

Both `C` and `D` select `A` and `B`. `D` does not additionally select `C`.

Only declarations participate. A standalone aggregate expression creates no
declaration record and is not a candidate. Normal declaration-identity
deduplication, dimensional restrictions, and each function's existing
empty-selection behavior continue to apply: `sum` and `count` return zero;
`avg`, `median`, `min`, and `max` report an empty-selection error.

### Interaction with braces

Existing membership filters may narrow the selected aggregate-result
declarations:

```text
sum:>[]{approved}
sum:>[]{approved}{!obsolete}
```

Braces inspect the aggregate-result declarations' ordinary memberships. They
do not re-filter the raw declarations consumed by the inner aggregates.

### Overlapping inner sums

Pure sums can still overlap:

```text
CAC:ex = 253.75
OG&E:ex = 83.30
Walmart:ex:gr = 61.47

Total = sum:ex
Groceries only = sum:ex{gr}
```

Collecting both results counts the grocery value twice because `Groceries only`
is a subset of `Total`. This is structurally valid and cannot be diagnosed as
an error without guessing intent.

When a breakdown is intended as a separately reusable subtotal, prefer its own
target:

```text
Total = sum:ex
Groceries only = sum:gr
```

A future provenance trace should list every subtotal selected by `sum:>[]`,
making accidental overlap inspectable without altering evaluation semantics.

### Deliberately deferred

The August use case does not justify a general aggregate-provenance query
language. These forms remain undefined:

```text
sum:[]
sum:>[reach]
sum:[reach,walmart]
```

Sigils remain the general solution for combining arbitrary calculated values,
including adjusted totals, mixed expressions, or values that are not already
grouped by one region.

Square brackets are reserved for this future grammar. They have no other
intentional Quantities use, so reserving them introduces no meaningful
compatibility requirement for this private plugin.

---

## 4. File Eligibility

File eligibility uses a global default plus granular path exceptions. The
settings UI exposes:

```text
Evaluate by default:  All files | No files

Path exceptions:
  [vault-relative file, folder, or glob]
```

Path exceptions invert the global default:

- under **All files**, matching paths are excluded;
- under **No files**, matching paths are included.

This directly supports all, none, and selected-path configurations:

```text
All files, no exceptions
    -> evaluate every Markdown file

No files, no exceptions
    -> evaluate no Markdown files

No files, exceptions Finance/** and Recipes/**
    -> evaluate those paths only

All files, exception Templates/**
    -> evaluate everything except Templates/**
```

### Frontmatter override

Frontmatter has final precedence over the global default and path exceptions:

```yaml
---
quantities: true
---
```

forces evaluation, while:

```yaml
---
quantities: false
---
```

forces exclusion. Values must be YAML booleans; strings such as `"false"`
must not silently acquire boolean meaning.

Eligibility therefore resolves in this order:

```text
explicit frontmatter
    -> matching path exception inverts the global default
    -> global default
```

### Path exceptions and suggestions

Each exception accepts:

- an exact vault-relative Markdown path;
- a folder subtree such as `Finance/**`;
- a documented glob pattern such as `Journal/2026-*.md`.

The text field should use Obsidian's public `AbstractInputSuggest` mechanism.
Suggestions draw from vault Markdown files and folders. Selecting a file inserts
its exact `.md` path; selecting a folder inserts `Folder/**`. Free-form glob
entry remains available.

Suggested values do not replace validation. Invalid glob patterns produce a
visible inline settings error rather than silently matching nothing. The final
implementation must document vault-relative normalization, `/` separators,
case sensitivity, `*` and `**`, and cache invalidation after settings,
frontmatter, or path changes.

File eligibility is an integration-layer gate used consistently by Live
Preview, Reading View, marker migration, traces, and future diagnostics. It is
not part of calculation-language parsing.

### Purpose

File scoping is not part of the Quantities calculation language. It is an eligibility gate that determines whether the plugin should attempt to interpret a note at all.

The intended model is:

```text
file eligibility
    -> Quantities parser/evaluator
    -> normal language semantics
```

This keeps vault organization and language semantics separate while giving the user explicit control over where Quantities is active.

---

## 5. Implemented: `list` Function

The seventh aggregate function alongside `sum`, `count`, `avg`,
`median`, `min`, and `max`. Instead of reducing selected declaration values to
a number, it joins their source labels into human-readable text. Its concrete
use case is showing which declarations contribute to an aggregate selection.

```text
DoorDash:ss = `=30.47`
OpenAI:ss = `=7.04`
Walmart:ss = `=61.47`

Subscriptions = `=list:ss`
```

`Subscriptions` renders `DoorDash, OpenAI, Walmart`.

### Settled selection behavior

`list` reuses aggregate candidate selection: scope, memberships, filters, and
declaration-identity deduplication are unchanged. The reduction preserves
document order and joins labels with `, `.

Repeated labels remain repeated when they belong to distinct declaration
records. A declaration found through overlapping memberships appears once
because identity deduplication occurs before reduction.

`list` is intended for all three existing scopes:

```text
list:ss     global — every successful :ss record, note-wide
list@ss     local — the active accumulation, closes on read like any other @ function
list:>      regional — positional membership, does not close the region
```

Labels render exactly as written. No escaping or quoting is introduced for
commas because this is human-readable display text, not a machine-parseable
serialization.

Unlike numeric aggregates, `list` does not inspect member values. Numeric,
unit-bearing, and text-valued declarations can all contribute their
labels.

### Empty selection

For a known target whose filters select no declarations, `list` returns an empty
string. An unknown global target or local accumulation remains an error.

### Implemented text-valued result model

`list` is not implemented exactly like `median`: the value model includes a
text result because `list` produces text. The settled behavior is:

- a declared list can be referenced later as display text;
- text used in arithmetic or numeric aggregates produces an explicit error;
- text concatenation is unsupported;
- an empty selected list renders as an empty string.

No implicit numeric or string coercion should be introduced.

### Relationship to regional aggregate-result collection

`list:>[]` remains deferred. Under Design A it could mean listing the labels of
pure `list`-result declarations, while flattening their produced strings would
be a different operation. Neither behavior is justified by the contributor-list
use case.

### Relationship to the provenance trace

This is a narrow, permanent, inline slice of what the trace feature (Section 1) is designed to expose more fully — "selected declaration members" is already listed as trace content. `list` differs by being a first-class function producing a stable value at a fixed point in the note, rather than an on-demand inspection of evaluator state. The two are complementary: `list` for a value you want visible every time the note renders, the trace for inspecting membership without adding anything to the source.
