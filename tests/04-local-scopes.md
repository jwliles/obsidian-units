---
title: 04-local-scopes
---

# Local aggregates close the group they read

This acceptance fixture defines the selected local-scope model. A
`@` aggregate reads the active local accumulation and closes that
group after evaluation. The next member opens a fresh accumulation.

## Distinct labels in two ledger periods

Rent:ex = `=800.00`
Power:ex = `=150.00`
Water:ex = `=60.00`

Period 1 = `=sum@ex` <!-- expect:value 1010.00 -->
Repeat completed period = `=sum@ex` <!-- expect:value 1010.00 -->
Global expenses after period 1 = `=sum:ex` <!-- expect:value 1010.00 -->

Groceries:ex = `=200.00`
Fuel:ex = `=90.00`

Period 2 = `=sum@ex` <!-- expect:value 290.00 -->
Global expenses after period 2 = `=sum:ex` <!-- expect:value 1300.00 -->

## Closure is selective

Visa:debt:ex = `=50.00`
Cash:ex = `=25.00`

Expenses only = `=sum@ex` <!-- expect:value 75.00 -->
Debt remains active = `=sum@debt` <!-- expect:value 50.00 -->

Visa:debt = `=10.00`
New debt accumulation = `=sum@debt` <!-- expect:value 10.00 -->

## Implicit label histories and deduplication

CAC:ex = `=135.00`
CAC:cac:ex = `=104.90`

Latest CAC = `=CAC` <!-- expect:value 104.90 -->
All CAC declarations = `=sum:cac` <!-- expect:value 239.90 -->
Current CAC accumulation = `=sum@cac` <!-- expect:value 239.90 -->
Current expense accumulation = `=sum@ex` <!-- expect:value 239.90 -->

## Filters close the whole queried accumulation

Store:shop:food = `=40.00`
Market:shop:fuel = `=30.00`

Food selection = `=sum@shop{food}` <!-- expect:value 40.00 -->
Repeated closed shop = `=sum@shop` <!-- expect:value 70.00 -->

## Unknown local group

`=sum@missing` <!-- expect:error unknown-local-group -->

## Markdown independence

> Formatting does not establish scope.
>
> One:quoted = `=5.00`
> Two:quoted = `=7.00`
>
> Quoted total = `=sum@quoted` <!-- expect:value 12.00 -->
