# Remaining Parser Work

This file is a temporary issue ledger. Normative grouped-calculation behavior
lives in [../SEMANTICS.md](../SEMANTICS.md).

## Accepted design changes

- Every declaration joins its implicit normalized label history.
- Explicit sigils add memberships to the same declaration record.
- Aggregates deduplicate overlapping memberships by declaration identity.
- Labels and same-named sigils may coexist; the proposed collision errors and
  fixture 07 are rejected.
- A single-colon aggregate reads note-wide history without changing state.
- A double-colon aggregate reads and then closes the queried local
  accumulation. Its next member opens a fresh accumulation.
- Same-label unqualified redeclarations no longer close local accumulations.
- Markdown structure and unrelated bare declarations never establish scope.

The regression case is `august-projections-stripped.md`. Its period totals are
489.79, 453.36, 138.62, and 134.46; global expenses are 1216.23.

## Confirmed fixes to preserve

- Damerau-based suggestions use the correct lookup domain, stay silent on
  ties, and exclude sigils from variable suggestions.
- Diagnostics preserve source spelling.
- Failed declarations do not shadow earlier successful values.
- Mixed-filter and one-declaration-per-line diagnostics explain the remedy.
- Fenced code and HTML comments are excluded from evaluation.
- Aggregate results preserve useful decimal scale; `count` remains integral.
- Marker migration separates recognized expressions from ambiguous spans.

## Implemented in the current refactor

- Implicit label histories and identity-based deduplication.
- History-aware filters, including whitespace-bearing label histories.
- Double-colon read-and-close with closure only after successful evaluation.
- Selective group closure and fresh accumulation reopening.
- Provenance restricted to the queried local accumulation.
- Safe aggregate-derived histories and rejection of direct aggregate recursion.
- Repeated reads of the most recently closed accumulation, as specified.

## Remaining unrelated work

- Resolve general arithmetic scale propagation. In particular, determine
  whether `2.00 * 3.5` should render `7`, `7.0`, or `7.00` and document one
  consistent rule.
- Verify the marker migrator's previously flagged ambiguous spans with a
  dedicated automated fixture.
- Publish one canonical sigil grammar table covering normalization, length, and
  reserved characters.
- Decide whether fixture markers remain permanently `=` or become configurable
  per fixture.

## Test infrastructure

- Six executable Markdown fixtures now contain 114 assertions covering
  membership, identity deduplication, filters, evaluation order, local
  lifecycle, and the August ledger regression.
- The harness reports all fixture mismatches in one run. The evaluator passes
  all 114 specification assertions plus the calculation and compatibility
  suites.
- Perform a forced-failure check on the Markdown fixture harness before treating
  it as a release gate.
