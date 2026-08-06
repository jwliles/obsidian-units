---
title: 04-local-scopes
---

# Local scopes

This fixture is an acceptance specification for the local-scope evaluator. It
is intentionally not part of the passing fixture runner until local evaluation
is implemented.

## First accumulation

CAC:cac:ex = `=135.00`
Walmart:ex = `=80.00`
CAC:cac:ex = `=104.90`
Aldi:ex = `=40.00`

Latest CAC = `=CAC` <!-- expect:value 104.90 -->
Local CAC = `=sum::cac` <!-- expect:value 239.90 -->
Local expenses = `=sum::ex` <!-- expect:value 359.90 -->
Local expense count = `=count::ex` <!-- expect:value 4 -->
Local expenses without Walmart = `=sum::ex{!walmart}` <!-- expect:value 359.90 -->

## Closing by returning to an unqualified declaration

CAC = `=150.00`

Latest CAC = `=CAC` <!-- expect:value 150.00 -->
Most recently completed CAC = `=sum::cac` <!-- expect:value 239.90 -->
Most recently completed expenses = `=sum::ex` <!-- expect:value 359.90 -->

The unqualified CAC declaration closes both local accumulations because the
most recent qualified CAC declaration participated in `cac` and `ex`.
Walmart and Aldi declarations did not close either accumulation.

## A new accumulation

CAC:cac:ex = `=75.00`
Walmart:ex:walmart = `=25.00`

Latest CAC = `=CAC` <!-- expect:value 75.00 -->
Second local CAC = `=sum::cac` <!-- expect:value 75.00 -->
Second local expenses = `=sum::ex` <!-- expect:value 100.00 -->
Filtered local expenses = `=sum::ex{walmart}` <!-- expect:value 25.00 -->

## Unknown local group

`=sum::missing` <!-- expect:error unknown-local-group -->

## Markdown independence

> Formatting does not establish or close scope.
>
> CAC:cac = `=5.00`
>
> Local CAC inside a blockquote = `=sum::cac` <!-- expect:value 80.00 -->

The active local `cac` accumulation is implicitly completed at end-of-file.
