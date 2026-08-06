# Grouped Calculations — Consolidated Design Record

## Status

This document is the authoritative design record for grouped calculations. It consolidates every design decision, proposal, defect,
and open question produced during the 2026-08-05 design review and
live testing of the grouped-calculations feature. `GROUPED_CALCULATIONS.md`
provides the original rationale and `IMPLEMENTATION_PLAN.md` tracks work;
where either conflicts with this record, this record states the settled
position. Sections are marked **Settled** (decided, in some cases
implemented and verified), **Proposed** (design direction agreed,
details open), or **Defect record** (a historical problem and its resolution).

---

# Part I — Settled semantics

## 1. Explicit expressions and declarations (Settled, implemented)

Every plugin-owned expression begins with the configured marker inside an
inline code span. The default marker is `=` and exactly one marker is active.
Inline code without the configured marker is ordinary Markdown: no render,
no error, no declaration. Verified: `npm run build`, prose fractions,
and unmarked pseudo-declarations (`CAC = ` followed by a plain code
span) all remain untouched and do not disturb adjacent evaluation.

A declaration is `LABEL[:SIGIL...] = ` followed by an explicit
expression. The assignment delimiter is whitespace-surrounded `=`.
Changing the configured marker does not erase declaration structure: a
declaration using the previous marker is retained without a value or group
membership and receives an incorrect-marker diagnostic. The active-file
marker update command changes recognized declarations, aggregates, and
conversions; ambiguous standalone arithmetic remains unchanged.

**Label character rules.** Labels may contain whitespace. Labels may not
contain literal colons or `=`; both are rejected with a diagnostic and are
documented in the implementation plan.

**Declaration prefix boundary.** A declaration occupies the current line or
the final ledger field before the assignment. A list marker is presentation;
the last `|` establishes the start of a ledger field. There is no silent
prose-colon boundary. Colons attach sigils directly (`Label:group`) and a
colon followed by whitespace is rejected as an unsupported literal colon.
Put prose on a separate line or before a ledger `|` boundary.

**One declaration per line** is policy (see D5 for its diagnostic).

## 2. Namespaces (Settled, implemented, verified)

Labels name variables; sigils name groups; aggregates see only
sigils. The same string may exist in both namespaces with different
values and both resolve correctly side by side:

```markdown
CAC:cac = `=300.00`
CAC:cac:ex = `=200.00`
Latest CAC = `=CAC`      <!-- 200.00 : variable, most recent -->
Total CAC = `=sum:cac`   <!-- 500.00 : group, all members -->
```

The 500-vs-200 divergence is the regression guard against any future
unification of the namespaces (fixture 01).

**Idiom.** To make a label summable, tag entries with a sigil
spelling the label (`CAC:cac`). Aggregates never fall back to
matching labels; the blessed answer to "unknown group" for an
existing label is the self-sigil, not namespace blurring.

## 3. Duplicate labels (Settled, implemented, verified)

Variable lookup takes the most recent preceding successful
declaration. Group aggregation retains every successful entry,
including repeated labels. Both behaviors verified live.

## 4. Sigils (Settled)

Text, numbers, icons, emoji. Case-insensitive comparison after NFKC
normalization (verified both directions: `sum:CAC` and `sum:cAc` resolve
`:cac`); emoji sequences are preserved. Sigils are limited to 64 Unicode
code points. Whitespace and structural characters (`:`, `=`, braces, comma,
`!`, and backtick) are invalid. A ledger `|` establishes a field boundary
and is never sigil content. No interval punctuation is reserved yet.

## 5. Filters (Settled, implemented, fully verified)

Braces filter a base group. Within a clause, comma-separated terms
are alternatives; repeated clauses AND.

**Negation is clause-scoped.** A clause is all-positive or
all-negative; mixed clauses are rejected. A negative clause excludes
members belonging to ANY listed group:

```text
sum:ex{!ob,!ls}   ≡   :ex AND NOT (ob OR ls)   ≡   sum:ex{!ob}{!ls}
```

The rejected alternative (term-scoped: (NOT ob) OR (NOT ls)) is a
De Morgan dual that excludes only members in BOTH groups — a
near-useless filter that silently diverges from the plain-language
reading. Fixture 02 carries the tripwire: `sum:ex{!ob,!ls}` over the
four-entry ledger must render 60; the term-scoped regression renders
330.

**Per-term negation markers are required** (`{!a,!b}`, never
`{!a,b}` or `!{a,b}`). Redundant for the parser, load-bearing for
error detection: a partially negated clause becomes a detectable
contradiction (the mixed-clause diagnostic) instead of a well-formed
wrong filter. Single-marker spellings would make the most likely
mistake — forgetting the marker — evaluate silently as the positive
filter. Redundancy that converts silent wrong answers into loud
parse errors is the good kind.

**Partition invariant.** A positive clause and its negated twin
always partition the base group; positive + negative = unfiltered
sum. Only true under clause scoping, which makes it a property-style
regression test for the semantics itself. Verified: 100+230=330,
270+60=330.

**Empty selection.** `sum` and `count` return 0 (identities);
`avg`, `min`, `max` error. Verified, with per-function messages.

**Primary totals and secondary breakdowns.** Exceptional entries
carry an extra sigil; the positive filter selects them, the negated
filter the complement, and the base total can never accidentally
omit them (`bonus:ic:bonus`; `sum:ic{!bonus}` / `sum:ic{bonus}` /
`sum:ic`). This replaced the original secondary-cascade exclusion
semantics for the bonus use case. The cost — every "regular only"
aggregate must repeat the filter — is a query-shorthand concern; if
it grates, the future feature is named/default filters.

## 6. Evaluation order and scope (Settled, implemented, verified)

Top to bottom; aggregates and variable references see successfully
evaluated preceding declarations only; later declarations never
rewrite earlier results (verified: 15 above, 115 below, with the
new member between). Aggregate before any member of a group is an
unknown-group error — the fixture line pinning the
preceding-content-scope decision, now verified live. Whole-note
collection remains explicitly rejected unless revisited.

Aggregate results cannot be attached to the group they query
(`total:t = \`=sum:t\`` → error, verified). In the first release, aggregate
results cannot be attached to any group. Labeled UNGROUPED
aggregates are supported and reusable as variables
(`running total = \`=sum:t\``, then `\`=running total * 2\``) —
inferred from the plan's Phase 3 allowance, now pinned by fixture 03.

**Adopted diagnostic wording** (better than specified; keep
verbatim): `Declaration "self" cannot reference itself before it
has a value.`

## 7. Aggregate functions (Settled, implemented)

`sum`, `count`, `avg`, `min`, `max`, all verified against the
fixture ledger.

---

# Part II — Scope tiers and intervals (Superseded exploration)

The `::group` declaration tiers and explicit terminators below are retained as
historical design exploration. They are not the implemented local-scope model.
`LOCAL_SCOPES_DESIGN.md` records the active model and its executable acceptance
fixture. Qualified declarations accumulate locally and returning the same label
to an unqualified declaration closes its preceding local accumulations without
involving Markdown structure. Local aggregates use `function::group`.

## Motivation

The August projections ledger is the compelling use case the
proposal's scope section deferred: four pay periods, each needing a
local expense total, alongside note-wide totals (`:vy`, `:cac`).
Under whole-note cascading the only expression is uniquely named
groups per period (`ex1..ex4`) — a namespace workaround for a scope
problem, and the main source of the note's visual clutter. Both
prior mechanisms tried against this problem (the original secondary
cascade and the filter idiom) reduce to the same workaround, because
both are namespace answers; the missing primitive is a boundary.

## Design: two tiers

`:` and `::` are scope tiers of the same conceptual group, not
parallel namespaces:

- **Primary (`:ex`)** — always note-wide cumulative. Cannot be
  closed. Invariant: a note-wide total can never be silently
  truncated.
- **Secondary (`::ex`)** — local; boundable by a terminator. The
  forgotten-close hazard is confined to the tier that opts into
  boundaries.

This supersedes the removed v1 cascade (which was a deliberate pilot
stage of this design, not a finished mechanism — the staged plan was
always pilot, then terminators, then evaluation against real use).
The tier reading also defuses the original one-keystroke typo
objection: the two spellings are two scopes of one group, and the
trace shows which tier a member landed in.

## Open decision (recommended answer): does `::ex` feed `:ex`?

The v1 cascade said no (exclusion served the bonus case). Filters
own the bonus case now, and exclusion costs the grand total: per-
period subtotals AND a monthly `sum:ex` would require double-tagging
every entry. **Recommended: additionally-local semantics** — a
`::ex` entry joins cumulative `:ex` and the current `::ex` interval.
One sigil per entry then yields both readings: `sum::ex` per
section, `sum:ex` for the note. Local is a refinement of global,
which is what "tier" should mean.

## Terminators

- No punctuation is reserved until the interval grammar is accepted.
- Spelling `:;` preferred over bare `;` — a lone semicolon is
  common prose punctuation and would need positional disambiguation;
  `:;` is unambiguous in sigil position and reads as "sigil, ended."
- Both forms have roles: bare `:;` = close ALL open secondaries (the
  natural one-marker-per-section gesture); named `:;ex` = selective
  close for interleaved groups.
- **Closing-total idiom:** attach the close to the line every
  section already has — `Total:;ex = \`=sum::ex\`` aggregates and
  rules the line under the column in one gesture. Forgetting the
  close then requires forgetting the total, which the section's
  purpose already prevents.
- **Ordering rule (must be one explicit spec sentence):** a close on
  the total line takes effect AFTER that line's own aggregate
  evaluates; otherwise the total closes its own interval before
  reading it.

## Interval semantics and edge diagnostics

- Reopening a closed `::ex` (next tagged entry) starts a fresh
  interval.
- `sum::ex` between a close and the next reopen: distinct diagnostic
  ("no open ::ex interval"), NOT 0 — silent zero is the bleed class
  in reverse.
- A close with no matching open: loud error (almost certainly a
  typo'd name).
- Cross-interval grand totals: no spelling yet; under
  additionally-local semantics `sum:ex` already covers the known
  use case. Wait for a real need.

## Sequencing constraint

A forgotten close is well-formed — the only error class in the
system that cannot produce a diagnostic. Its instrument is the
calculation trace (Part III). **Provenance capture must land with
or before intervals**; shipping intervals first opens a window where
silent cross-period bleed has no recovery path anywhere.

---

# Part III — Calculation trace (Proposed)

## Framing

The plugin cannot detect that a result differs from the user's
expectation; the feature is on-demand explanation for any
expression, invoked when the user is surprised. Every real confusion
during testing was resolution, not arithmetic — which declaration
won, what a filter admitted, whether normalization matched — so the
trace's payload is substitution and selection:

- **Variable expressions:** each name, the substituted value, and
  provenance ("oldPay = 1000, line 9, superseding line 3"), then the
  fully substituted expression and result.
- **Aggregates:** the member roster — label, value, source line,
  and **section** (for interval debugging, "## 2026-08-05" beats a
  bare line number) — plus exclusions WITH reasons
  ("Market 40.00: excluded by {!gr}"). Subsumes the empty-selection
  diagnostic. For interval aggregates, the interval's own story:
  opening marker, bounding close or "open — accumulating since
  line N."
- **Soft interval warning:** a group closed in previous sections but
  never in the current one is the forgotten-close signature; the
  trace surfaces it as a note, never an error — never-closed is also
  the legitimate cumulative case and a hard warning would
  false-positive on every intentional note-wide group.

## Surfacing

View-state toggle via the existing widget hide/show machinery — a
third presentation state (hidden / result / trace), per-line
(existing current-line command pattern) or whole-file. Whole-file
trace is an audit view: the ledger as its own worked statement. Not
a `| work` render mode: that would put invocation in note source,
making explanation a property of the expression instead of the view.

**Two-tier compactness** (whole-file mode multiplies whatever form
is chosen): inline widget shows the substituted expression
("sum:ex → 50 + 60 + 180 + 40 = 330"), roughly line-height; the full
roster with verdicts lives one hover/click deeper. Elide large
rosters (first N + count + excluded tally).

## Architecture commitment

**Capture provenance unconditionally during evaluation**; the widget
layer decides display. Building traces only when trace mode is on
couples evaluation to view state (the coupling Phase 4's
source-not-DOM mandate exists to prevent) and can make toggling
trigger re-evaluation. Capture is references to values and positions
the evaluator already holds. Core always produces result + trace;
traces are plain assertable values, testable in the fixture
convention independent of any widget.

---

# Part IV — Defect record

## D1. Suggestion ordering — FIXED

The old ordinary-Levenshtein implementation treated the `CIP`/`CPI`
transposition as two edits and tied it with the earlier `CAC` variable.
This is fixed with Damerau-Levenshtein, conservative thresholds, silence on
ties, source-spelling preservation, and an exact variable-namespace probe
for unknown groups.

Fix (policy assembled and pre-tested by fixture 01):
- Unknown variable → rank the VARIABLE table only,
  Damerau-Levenshtein (transposition = 1 edit); suggest at
  distance ≤ 1 always, distance 2 only for candidates ≥ 5 chars;
  silence on ties or misses (current `zq` behavior — already
  correct).
- Unknown group → EXACT probe of the variable table; on hit, the
  cross-namespace hint ("X is a variable; aggregates operate on
  sigils"). No fuzzy matching across namespaces in either direction.

## D2. Diagnostics echoed normalized spelling — FIXED

`"walmart"`, `"cac"` where the user wrote `Walmart`, `CAC`.
Normalize for lookup; display source spelling. One field on the
diagnostic type.

## D3. Failed declarations shadowed longer successful names — FIXED

`=running total * 2` resolved failed `total` instead of successful,
longer `running total`, erroring with "declared but has no
calculated value." Violates both "successful declarations only" and
"longest-name-first." Fix: sequence, don't merge — longest-first
over successful declarations only; consult the failed-declaration
record ONLY when resolution finds nothing, to upgrade "unknown
variable" to the better message. Pin the interaction (failed short
name prefixing successful long name) as a dedicated test; no unit
test of either feature alone catches it.

## D4. Computed values stripped trailing zeros — FIXED

Number values retain a minimum decimal scale. Variable references preserve
their declaration scale; arithmetic and aggregates use at least the maximum
scale of their contributing numeric values; `count` remains an integer.
Configured precision remains the maximum calculation display precision.

## D5. Multi-declaration lines were misdiagnosed — FIXED

Flattened input (paste, sync, import) fusing two declarations onto one line
formerly reported `Variable labels cannot contain "="`. The parser now
reports "Only one declaration is allowed per line" at the second span.

## D6. Mixed-polarity message lacked the remedy — FIXED

The diagnostic now appends: "Use {!gr,!ls} to exclude both, or separate
clauses like {ls}{!gr} to combine polarities."

---

# Part V — Presentation

## Sigil concealment

The August note's clutter has two sources; solve them in order.
Sections 1–2 of Part II remove the larger one (numbered groups).
The remainder — `:cac:ex` glued to labels — is presentation, and
concealment is the established Obsidian idiom, not a hack: Live
Preview already hides syntax away from the cursor. Sigils are
syntax; the CodeMirror decorations from the existing pipeline are
the Live Preview mechanism, and Phase 4's source mapping lets the
Reading View post-processor wrap sigil spans for CSS despite their
living outside the code span.

**Caution:** fully hidden sigils make membership invisible, and
invisible membership is the silent-wrong-total class. Prefer tiered
visibility: conceal in Reading View, dim/shrink or chip-collapse in
Live Preview, full text under cursor — with hover expansion, and
the trace as the recovery path when an entry lands in the wrong
group. Emoji sigils converge visually with chips anyway.

## Numeric presentation

See D4; once decided, document as the presentation rule alongside
the existing "currency symbols and notes are presentation, not
identity" stance.

---

# Part VI — Documentation gaps and test corpus

Settled but absent from GROUPED_CALCULATIONS.md /
IMPLEMENTATION_PLAN.md:

- Clause-scoped negation with explicit examples — **done** per
  author; verify the partition invariant example is included.
- Per-term negation markers and their error-detection rationale.
- `=` rejected in labels (implemented; unwritten).
- Declaration prefix boundary: current line or final ledger field;
  attached colons introduce sigils and unattached colons are errors.
- Diagnostic spelling policy (D2) and suggestion policy (D1).
- Adopted self-reference wording (Part I §6).
- `;` reserved in the sigil character set.
- The label/sigil/aggregate triangle and the self-sigil idiom
  (README, with the CAC example).
- One-declaration-per-line policy and its honest diagnostic (D5).
- Mechanical: IMPLEMENTATION_PLAN.md Phase 1 has two items
  numbered 7.

**Test corpus.** Fixtures 01–03 plus the two early screenshot notes
belong in `tests/` as Phase 0 characterization input. The
HTML-comment convention (`<!-- value -->` / `<!-- ERROR: ... -->`,
plus PARTITION / REGRESSION GUARD / NOTE prose assertions) needs one
parser to make every fixture executable; the same convention should
carry trace assertions once Part III lands. The suggestion-stub
incident is the convention's proof of value: a confident wrong
suggestion reads as plausible to a human skimmer and was caught only
by the comment asserting `CPI`.

**Verified passing** (no action; full list): clause-scoped negation
incl. the 60-vs-330 tripwire and `{!a,!b} ≡ {!a}{!b}`; union without
double-counting; repeated-clause AND; both partitions;
empty-selection identities and errors; mixed rejection;
duplicate-label divergence (200 vs 500); case-insensitive sigils
both directions; preceding scope incl. aggregate-before-member;
non-retroactivity; aggregate-into-own-group rejection; labeled
ungrouped aggregates; self-reference; both division-by-zero forms;
all four malformed-prefix rejections; suggestion silence; and
not-applicable inline code untouched adjacent to declarations,
errors, and prose.

---

# Recommended sequencing

1. Keep the executable Markdown fixtures and compatibility tests as the
   regression gate for the completed grouped-calculations milestone.
2. Provenance capture in the core + trace widget (Part III) —
   prerequisite for intervals.
3. Scope tiers and terminators (Part II), with its fixture file
   written before implementation, including the ordering rule and
   both edge diagnostics.
4. Sigil concealment (Part V) after Part II removes the numbered
   groups — judge the aesthetics of the real syntax, not the
   workaround.
5. Complete the remaining documentation gaps in Part VI opportunistically.
