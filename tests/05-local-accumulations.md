# UNITS-TEST 05 — Closing local accumulations

Local accumulations are closed by a successful declaration of the same label
that omits a qualifier used by its preceding qualified declaration. Markdown
headings and unrelated declarations do not close them.

## Closing a local CAC accumulation

CAC:cac = `=135.00`
CAC:cac = `=75.00`
Open CAC accumulation = `=sum::cac` <!-- expect:value 210.00 -->

CAC = `=150.00`

The unqualified declaration updates the global `CAC` variable but does not
join the local accumulation it closes.

Global CAC after close = `=CAC` <!-- expect:value 150.00 -->
Completed CAC accumulation = `=sum::cac` <!-- expect:value 210.00 -->

## Reopening starts a fresh accumulation

CAC:cac = `=40.00`
Reopened CAC accumulation = `=sum::cac` <!-- expect:value 40.00 -->

CAC = `=0.00`
Second completed CAC accumulation = `=sum::cac` <!-- expect:value 40.00 -->

## Unrelated declarations do not close an accumulation

CAC:cac = `=100.00`
Memo = `=1.00`
Still-open CAC accumulation = `=sum::cac` <!-- expect:value 100.00 -->

CAC:cac = `=50.00`
Continued CAC accumulation = `=sum::cac` <!-- expect:value 150.00 -->

CAC = `=0.00`

## Omitting one qualifier closes only that qualifier

CAC:cac:ex = `=100.00`
CAC:cac = `=50.00`

Completed expense accumulation = `=sum::ex` <!-- expect:value 100.00 -->
Continuing CAC accumulation = `=sum::cac` <!-- expect:value 150.00 -->

CAC = `=0.00`

## Closing a qualifier shared by different labels

Rent:ex = `=800.00`
Power:ex = `=150.00`
Open expense accumulation = `=sum::ex` <!-- expect:value 950.00 -->

Rent = `=0.00`
Completed expense accumulation = `=sum::ex` <!-- expect:value 950.00 -->

Groceries:ex = `=200.00`
Fresh expense accumulation = `=sum::ex` <!-- expect:value 200.00 -->

Groceries = `=0.00`
