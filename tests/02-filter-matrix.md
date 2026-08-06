---
title: 02-filter-matrix
aliases:
  - 02 filter matrix
  - 02 Filter Matrix
authors:
  - jwl
date-created: 2026-08-05T09:09:12
date-updated: 2026-08-05T11:49:08
timestamp:
  - 1785948531378
id:
  - 3f1cb285-4f77-4c63-b6fa-72d8935fda52
tags: []
---

# 02-filter-matrix

Four entries chosen so that every filter form selects a DIFFERENT
subset. If two expected values below are equal by accident, the
fixture has been edited incorrectly.

## Ledger

- 2026-08-05 | Service:ex:ls = `=50.00` | Landscaping service
- 2026-08-05 | Store:ex:gr = `=60.00` | Groceries
- 2026-08-05 | Utility:ex:ob:bi = `=180.00` | Obligation, billed
- 2026-08-05 | Market:ex:gr:ls = `=40.00` | Groceries AND landscaping

## Base aggregates

`=sum:ex` <!-- 330.00 -->
`=count:ex` <!-- 4 -->
`=avg:ex` <!-- 82.50 -->
`=min:ex` <!-- 40.00 -->
`=max:ex` <!-- 180.00 -->

## Single-term clauses

`=sum:ex{gr}` <!-- 100.00 : Store + Market -->
`=sum:ex{!gr}` <!-- 230.00 : Service + Utility -->
<!-- PARTITION: 100.00 + 230.00 = 330.00 = sum:ex -->

## Positive multi-term clause (comma is OR / union)

`=sum:ex{ob,ls}` <!-- 270.00 : Service(ls) + Utility(ob) + Market(ls) -->
<!-- Market must be counted ONCE, not twice, despite matching ls while also being in the base group via ex. -->

## Negative multi-term clause (clause-scoped: none-of)

`=sum:ex{!ob,!ls}` <!-- 60.00 : Store only -->
<!-- This is THE semantics tripwire. Under the rejected term-scoped reading, (NOT ob) OR (NOT ls) would include Service, Utility, AND Market (each escapes via the negation it does not match), giving 330.00. Expected value is 60.00. If this renders 330.00, negation scope has regressed. -->
<!-- PARTITION: 270.00 + 60.00 = 330.00 = sum:ex -->

## Equivalence of spellings

`=sum:ex{!ob,!ls}` <!-- 60.00 -->
`=sum:ex{!ob}{!ls}` <!-- 60.00 : repeated single-negative clauses -->
<!-- These two MUST be equal: {!a,!b} ≡ {!a}{!b}. -->

## Repeated clauses (AND)

`=sum:ex{gr}{ls}` <!-- 40.00 : Market only (gr AND ls) -->
`=sum:ex{ob,ls}{!gr}` <!-- 230.00 : Service + Utility; Market removed -->

## Mixed-polarity rejection

`=sum:ex{!gr,ls}`
<!-- ERROR: mixed filter clause. Diagnostic should teach: all terms in a clause share one polarity; use {!gr,!ls} to exclude both, or split into separate clauses like {ls}{!gr}. -->

## Empty selection via filters

`=sum:ex{ob}{gr}` <!-- 0 : no entry is both ob and gr; sum identity -->
`=count:ex{ob}{gr}` <!-- 0 : count identity -->
`=avg:ex{ob}{gr}` <!-- ERROR: empty selection -->
`=min:ex{ob}{gr}` <!-- ERROR: empty selection -->
`=max:ex{ob}{gr}` <!-- ERROR: empty selection -->
