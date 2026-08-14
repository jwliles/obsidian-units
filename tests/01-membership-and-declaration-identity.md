# UNITS-TEST 01 — Membership and declaration identity

Every successful declaration creates one record, updates its variable, joins
its implicit label history, and joins every explicit sigil group.

## Implicit histories and latest-value variables

CAC = `=300.00`
CAC:ex = `=200.00`

Latest CAC = `=CAC` <!-- expect:value 200.00 -->
All CAC records = `=sum:cac` <!-- expect:value 500.00 -->
CAC count = `=count:cac` <!-- expect:value 2 -->
Expenses = `=sum:ex` <!-- expect:value 200.00 -->

## Explicit membership adds rather than replaces

Store:cac = `=50.00`

Store variable = `=Store` <!-- expect:value 50.00 -->
Store history = `=sum:store` <!-- expect:value 50.00 -->
CAC group with Store = `=sum:cac` <!-- expect:value 550.00 -->

## Overlapping membership is deduplicated by declaration identity

CAC:cac:ex = `=25.00`

Latest CAC after overlap = `=CAC` <!-- expect:value 25.00 -->
CAC total without duplication = `=sum:cac` <!-- expect:value 575.00 -->
CAC count without duplication = `=count:cac` <!-- expect:value 4 -->
Expense total = `=sum:ex` <!-- expect:value 225.00 -->

## Implicit histories participate in filters

CAC expenses = `=sum:ex{cac}` <!-- expect:value 225.00 -->
Non-CAC expenses = `=sum:ex{!cac}` <!-- expect:value 0 -->

## Normalization

CAC total uppercase = `=sum:CAC` <!-- expect:value 575.00 -->
CAC total mixed case = `=sum:cAc` <!-- expect:value 575.00 -->

Mixed Case = `=7.00`
Mixed-case history = `=sum:mixed case` <!-- expect:value 7.00 -->

## Variable errors remain variable errors

CPI = `=330.30`
Typo = `=CIP / 299.97` <!-- expect:error unknown-variable -->
Unknown = `=zq * 2` <!-- expect:error unknown-variable -->

## Unmarked inline code has no effect

CAC = `330.30`
Latest CAC remains marked value = `=CAC` <!-- expect:value 25.00 -->
