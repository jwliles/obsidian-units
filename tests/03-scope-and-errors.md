# UNITS-TEST 03 — Evaluation order and errors

## Top-down scope

`=sum:pre` <!-- expect:error unknown-group -->

First:pre = `=5.00`
Second:pre = `=10.00`

Initial total = `=sum:pre` <!-- expect:value 15.00 -->
Third:pre = `=100.00`
Later total = `=sum:pre` <!-- expect:value 115.00 -->

## Aggregate results and recursion

A:t = `=5.00`
Recursive:t = `=sum:t` <!-- expect:error aggregate-group-membership -->

Running total = `=sum:t` <!-- expect:value 5.00 -->
Doubled = `=Running total * 2` <!-- expect:value 10.00 -->
Running-total history = `=sum:running total` <!-- expect:value 5.00 -->
Snapshot:summary = `=sum:t` <!-- expect:value 5.00 -->
Summary history = `=sum:summary` <!-- expect:value 5.00 -->

t = `=sum:t` <!-- expect:error aggregate-group-membership -->

Self = `=Self` <!-- expect:error circular-reference -->

Counter = `=1.00`
Counter = `=Counter + 1` <!-- expect:value 2.00 -->
Counter history = `=sum:counter` <!-- expect:value 3.00 -->

## Failed declarations do not replace successful values

Stable = `=9.00`
Stable = `=1 / 0` <!-- expect:error non-finite-result -->
Stable remains = `=Stable` <!-- expect:value 9.00 -->
Stable history excludes failure = `=sum:stable` <!-- expect:value 9.00 -->

## Arithmetic failures

`=10 / 0` <!-- expect:error non-finite-result -->
`=10 / (5 - 5)` <!-- expect:error non-finite-result -->

## Malformed declaration prefixes

bad:si gil = `=1.00` <!-- expect:error invalid-sigil -->
empty:: = `=1.00` <!-- expect:error invalid-sigil -->
a = b = `=1.00` <!-- expect:error invalid-label -->
:gr = `=1.00` <!-- expect:error invalid-label -->

## Ordinary code adjacent to errors

The failures above do not affect `echo hello`.
Sanity = `=2 + 2` <!-- expect:value 4 -->
