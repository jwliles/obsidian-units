---
title: defects-and-fixes
aliases:
  - defects and fixes
  - Defects And Fixes
authors:
  - jwl
date-created: 2026-08-05T09:58:38
date-updated: 2026-08-05T11:50:06
timestamp:
  - 1785948558136
id:
  - 8ccafb06-fdcf-4520-a90d-77a526b7a5f9
tags: []
---

# defects-and-fixes

## Status

Findings from running the three grouped-calculations fixtures
(01-namespaces-and-duplicates, 02-filter-matrix, 03-scope-and-errors)
against the working implementation on 2026-08-05. The evaluation
semantics — declarations, groups, filters, scope, and structural
error detection — have no known defects. Everything below is in
diagnostics, name resolution on error paths, or presentation.

Each defect lists the observed behavior, the fixture line that
reproduces it, and the proposed fix. Severity reflects likelihood of
producing a wrong or misleading result in a real note.

---

## D1. Suggestion engine is a stub with the wrong candidate pool

**Severity:** high — produces confident, wrong diagnostic text.

**Observed.** In fixture 01:

```text
ratio = Unknown variable "CIP". Did you mean "cac"?
```

`CPI` is declared on the previous line at Damerau distance 1 and is
never suggested. `cac` is distance 2 and is a group sigil, not a
variable. The stub draws candidates from the sigil table for a
variable error. The companion hint is also absent: the unknown-group
error for `sum:Walmart` offers nothing even though `Walmart` exists
as a variable.

**Repro.** Fixture 01, sections “Typo diagnostic” and
“Cross-namespace diagnostic”.

**Fix.** Replace the stub with the settled policy:

- Unknown **variable**: rank the variable table only, using
	Damerau-Levenshtein (transposition counts as one edit). Suggest at
	distance ≤ 1 always; at distance 2 only when the candidate is
	≥ 5 characters. On ties or no candidate within threshold, emit the
	plain error with no suggestion (the current `zq` behavior, which is
	already correct).
- Unknown **group**: exact-match probe of the variable table only.
	On a hit, append the cross-namespace hint (“X is a variable;
	aggregates operate on group sigils — tag entries with a sigil or
	reference `=X`”). No fuzzy matching across namespaces in either
	direction.

**Interim.** Until the real engine lands, the stub must return no
suggestion rather than a plausible one. A diagnostic is trusted
text; a placeholder that answers is worse than one that stays quiet.

**Acceptance.** Fixture 01: the CIP line must suggest `CPI`, the
Walmart line must emit the variable hint, and the `zq` line must stay
silent.

---

## D2. Diagnostics echo normalized spelling instead of source spelling

**Severity:** medium — misleading but not wrong-valued.

**Observed.** Errors print the internal lookup form:

```text
Unknown group "walmart".     <!-- user wrote Walmart -->
Did you mean "cac"?          <!-- user's sigil reads cac, but the
                                  general case echoes lowercase -->
```

First seen on the original `sum:CAC` → `Unknown group "cac"` error.

**Fix.** Carry the source span alongside the normalized key through
every diagnostic path; normalization is for lookup, display always
uses the user's spelling. This is one field on the diagnostic type,
not a parser change.

**Acceptance.** Fixture 01 error text quotes `Walmart` and suggests
`CPI` in their declared spellings.

---

## D3. Failed declarations shadow longer successful names in resolution

**Severity:** high — blocks a correct expression from evaluating.

**Observed.** In fixture 03:

```text
total:t = Aggregate results cannot be attached to groups.   (correct)
running total = 5                                            (correct)
doubled = Variable "total" is declared but has no calculated value.
```

`=running total * 2` should resolve `running total` (successful,
longer match, value 5) and render 10. Instead resolution finds the
failed declaration `total`. The declared-but-valueless tracking that
powers the (genuinely good) diagnostic participates in name
resolution ahead of, or outside, longest-name-first ordering. This
violates two spec rules at once: “variables see successfully
evaluated preceding declarations only” and “longest-name-first
variable resolution.”

**Fix.** Sequence, don't merge: run longest-name-first over
*successful* declarations only, exactly as specced. Only when
resolution finds nothing may the evaluator consult the
failed-declaration record to upgrade “unknown variable” to
“declared but has no calculated value.” The improved message is
preserved for the case it was built for and unreachable when a
legitimate longer match exists.

**Acceptance.** Fixture 03: `doubled` renders 10. A dedicated test
should pin the interaction — failed short name that is a prefix of a
successful long name — since no unit test of either feature alone
catches it.

---

## D4. Computed values strip trailing zeros; inconsistent with ledger inputs

**Severity:** medium — cosmetic, but pervasive in the primary use case.

**Observed.** Across all three fixtures:

```text
first:pre = 5.00      (declaration echoes source)
Latest CAC = 200      (variable reference: computed form)
avg:ex = 82.5         (aggregate: computed form)
sum:ex = 330          (inputs were 50.00, 60.00, 180.00, 40.00)
```

The implicit rule is source-echo for declarations, canonical
trailing-zero-stripped form for anything computed. Coherent for
general math; wrong for money, where entries and totals will render
in different styles within one ledger.

**Fix (proposed).** Decimals preservation: render a computed value
with at least the maximum number of decimal places among its
contributing inputs (`sum:ex` over `*.00` entries → `330.00`;
`avg` may exceed it, e.g. `82.50`). Pure integer inputs keep integer
output, so non-financial arithmetic is unaffected and no setting is
needed. Alternative: a display-precision setting, at the cost of a
setting.

**Acceptance.** Fixture 02 comments as written (`330.00`, `82.50`,
`40.00`, `180.00`); update comments instead if a different rule is
chosen — the current bare forms should not be blessed by editing the
fixtures to match the bug.

---

## D5. Multi-declaration lines get a miscategorized diagnostic

**Severity:** low — only reachable via flattened/pasted input, but the
message misdirects.

**Observed.** When soft line breaks are flattened (clipboard through
another app, sync artifacts, imports) and two declarations share a
line, the second declaration's prefix scan ingests the first and
reports:

```text
second:pre = Variable labels cannot contain "=".
```

The one-declaration-per-line policy is fine; the error names a
phantom problem and quotes a garbage label.

**Fix.** When the bounded prefix scan encounters a complete earlier
declaration (a code span plus assignment `=`), report
“only one declaration per line” pointing at the second span, instead
of letting the swallowed text trip the label rules.

---

## D6. Mixed-polarity diagnostic states the rule without the remedy

**Severity:** polish.

**Observed.** Fixture 02:

```text
Positive and negative sigils cannot be mixed in one filter clause.
```

Accurate, and the rejection itself is correct.

**Fix.** Append the remedy, since this is the one filter error users
will actually hit and the confusion behind it took real effort to
untangle during design:

```text
Positive and negative sigils cannot be mixed in one filter clause.
Use {!gr,!ls} to exclude both, or separate clauses like {ls}{!gr}
to combine polarities.
```

---

## Documentation gaps (settled in review, not yet in the docs)

These are decisions already made and in some cases already
implemented, that neither GROUPED_CALCULATIONS.md nor
IMPLEMENTATION_PLAN.md currently states:

- **Declaration prefix boundary.** The spec says only “the text
	immediately preceding the code span.” The working rule: an
	unattached colon (colon followed by whitespace) terminates the
	label's leftward extent silently, because it cannot be attaching a
	sigil and cannot be inside a label; a colon attached to
	non-whitespace claims sigil position and is validated as one.
	Consequences to document: prose-colon-then-declaration
	(“...still works: sanity =...”) is a sanctioned idiom with a
	load-bearing colon, and the same sentence without the colon
	absorbs the prose into a multiword label — spec-consistent, but
	the one remaining surprise in prefix parsing. One README paragraph
	covering the pair closes the topic.
- **“=” rejected in labels**, alongside literal colons — decided,
	implemented, visible in fixture 03 output, absent from both docs.
- **Diagnostic spelling policy** (D2): normalize for lookup, display
	source text.
- **Suggestion policy** (D1): pools, algorithm, thresholds, silence
	rule, and the interim no-suggestion stub behavior.
- **Numeric presentation rule** (D4), once decided.
- **Keep as-is:** the self-reference wording — `Declaration "self"
	cannot reference itself before it has a value` — is better than
	the generic unknown-variable error the fixture asked for; adopt it
	as the specified message.
- **Mechanical:** IMPLEMENTATION_PLAN.md Phase 1 contains two items
	numbered 7.
- **Test corpus.** The three fixtures plus the two early screenshot
	notes belong in `tests/` as characterization input for the Phase 0
	runner; the HTML-comment convention (`<!-- value -->`,
	`<!-- ERROR:... -->`) needs one parser to make all of them
	executable.

---

## Verified passing (no action)

For the record, behaviors confirmed correct across the three fixture
runs: clause-scoped negation including the 60-vs-330 tripwire and
`{!a,!b} ≡ {!a}{!b}`; positive-clause union without double-counting;
repeated-clause AND; both partition invariants; empty-selection
identities (`sum`/`count` = 0) and errors (`avg`/`min`/`max`);
mixed-polarity rejection; duplicate-label divergence (variable-latest
vs group-all, 200 vs 500); case-insensitive sigil normalization in
both directions; preceding-content scope including
aggregate-before-member and non-retroactivity; aggregate-into-own-
group rejection; labeled ungrouped aggregates; self-reference and
both division-by-zero forms; all four malformed-prefix rejections;
suggestion silence below threshold; and not-applicable inline code
remaining untouched adjacent to declarations, errors, and prose.
