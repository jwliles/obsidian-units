# 06-local-accumulations

Verifies MANUAL.md "Local accumulations." Sigils tracked in this file: `cac` and `ex` run continuously from block A through block D — nothing isolates them at a heading, only an unqualified same-label declaration does. `loc` runs continuously from block G through block I for the same reason. `ex2` and `base` are each used in exactly one place and are not part of any chain. Every running total below is computed from everything above it in the file, not from its own heading section. Not yet wired into the runner; format assumes single-line `expect:` directives immediately following the asserted expression, matching fixture 04.

## A. Open, accumulate, close via unqualified reuse

CAC:cac:ex = `=135.00`
CAC:cac:ex = `=75.00`
Current CAC block = `=sum::cac`
<!-- expect:value 210.00 -->

CAC = `=150.00`
<!-- unqualified: omits both cac and ex, closes both, after its own 150.00 evaluates -->
Completed CAC block = `=sum::cac`
<!-- expect:value 210.00 -->
CAC global variable = `=CAC`
<!-- expect:value 150.00 -->

State after A: cac closed at 210.00. ex closed at 210.00.

## B. Unrelated label does not close; reopens cac fresh

CAC:cac = `=135.00`
Memo = `=1.00`
CAC:cac = `=75.00`
CAC Total = `=sum::cac`
<!-- expect:value 210.00 -->

State after B: cac open at 210.00 (reopened fresh since A's close; B never closes it). ex still closed at 210.00, untouched by B.

## C. Continues B's open cac; reopens then closes ex

CAC:cac:ex = `=100.00`
<!-- continues open cac: 210.00 + 100.00 = 310.00. reopens ex fresh since A's close: 100.00 -->
CAC:cac = `=50.00`
<!-- omits ex: closes ex at 100.00. continues cac: 310.00 + 50.00 = 360.00 -->
Local ex after C = `=sum::ex`
<!-- expect:value 100.00 -->
Local cac after C = `=sum::cac`
<!-- expect:value 360.00 -->

State after C: cac open at 360.00. ex closed at 100.00.

## D. Continues C's open cac; explicit close and reopen

CAC:cac = `=100.00`
<!-- continues open cac: 360.00 + 100.00 = 460.00 -->
CAC = `=0.00`
<!-- closes cac at 460.00, after its own 0.00 evaluates -->
First = `=sum::cac`
<!-- expect:value 460.00 -->

CAC:cac = `=40.00`
<!-- reopens fresh since the line above closed cac -->
CAC = `=0.00`
Second = `=sum::cac`
<!-- expect:value 40.00 -->

State after D: cac closed at 40.00. ex still closed at 100.00 (D never touches ex).

## E. Distinct-label period, fresh sigil (the August case)

Uses `ex2`, not `ex`, so this block's result depends only on whether a heading or a change of label closes anything — not on interaction with A-D's chain. No label below repeats.

Rent:ex2 = `=800.00`
Power:ex2 = `=150.00`
Water:ex2 = `=60.00`
Period 1 total = `=sum::ex2`
<!-- expect:value 1010.00 -->

Groceries:ex2 = `=200.00`
Fuel:ex2 = `=90.00`
Period 2 total = `=sum::ex2`
<!-- expect:value 1300.00 -->
<!-- this is not a failure mode, it is what the documented model specifies: no label repeated, so nothing closed ex2 at the heading boundary. It is also the practical problem for a real multi-label ledger: the closing mechanism never fires without a deliberate unqualified re-declaration, and no worked example currently shows what that declaration should look like. -->

## F. Stale read after a close, before reopening

Uses cac again, deliberately, picking up the chain from D. State entering F: cac closed at 40.00.

CAC:cac = `=500.00`
<!-- reopens fresh since D's close -->
CAC = `=0.00`
<!-- closes cac at 500.00 -->
Too-early read = `=sum::cac`
<!-- expect:value 500.00 -->
<!-- known, documented exception: everywhere else in this design an absent value errors rather than guessing; a closed accumulation instead falls back to its last completed value -->

New:cac = `=10.00`
<!-- reopens fresh since the close above -->
After reopen = `=sum::cac`
<!-- expect:value 10.00 -->

## G. Fresh sigil, left open on purpose

X:loc:card = `=30.00`
Y:loc:cash = `=20.00`
Z:loc:card = `=15.00`
Card only = `=sum::loc{card}`
<!-- expect:value 45.00 -->
Cash only = `=sum::loc{cash}`
<!-- expect:value 20.00 -->
Card or cash = `=sum::loc{card,cash}`
<!-- expect:value 65.00 -->

State after G: loc open at 65.00. No declaration here closes it, and this is not the end of the file, so it is not a completion case.

## H. Continues G's open loc across a heading, with an unrelated label between

Trailing:loc = `=42.00`
<!-- continues open loc: 65.00 + 42.00 = 107.00. Trailing carries no card/cash sigil. -->
Unfiltered loc = `=sum::loc`
<!-- expect:value 107.00 -->
<!-- makes the carry-through explicit. the filtered sums below stay unchanged from G only because Trailing matches neither filter, not because loc reset at this heading -->
Card only again = `=sum::loc{card}`
<!-- expect:value 45.00 -->
Cash only again = `=sum::loc{cash}`
<!-- expect:value 20.00 -->

Trailing = `=42.00`
<!-- same label as above, no qualifiers: closes loc at 107.00 -->

## I. Base group must exist; filter sigil need not; genuine end-of-file case

Q:base = `=5.00`
Filtered on absent sigil = `=sum::base{neverused}`
<!-- expect:value 0 -->
<!-- filter sigil matching no members is the sum-identity case, not an error -->

Open:base = `=7.00`
<!-- left open deliberately, with no further declarations in the file: this is the actual end-of-file case that block G was mislabeled as. per the documented rule this should be treated as completed for evaluation provenance. no assertion is possible from source alone here; verify via the calculation trace or a subsequent note that this value is readable as 12.00 (5.00 + 7.00), not lost. -->