---
title: 01-namespaces-and-duplicate-labels
aliases:
  - 01 namespaces and duplicate labels
  - 01 Namespaces And Duplicate Labels
authors:
  - jwl
date-created: 2026-08-05T09:09:12
date-updated: 2026-08-05T11:49:05
timestamp:
  - 1785948536265
id:
  - ac9ea2d5-acce-4a78-9772-8712342f5f66
tags: []
---

# 01-namespaces-and-duplicate-labels

Characterization of the 8:52 AM screenshot, extended with the two
diagnostics that namespace separation makes possible. Each expression
is followed by an HTML comment stating the expected outcome.

## Entries

CAC:cac = `=300.00`
CAC:cac:ex = `=200.00`
Walmart:ex:gr = `=150.00`

## Duplicate-label semantics

Total CAC = `=sum:cac` <!-- 500.00 : group retains BOTH CAC entries -->
Latest CAC = `=CAC` <!-- 200.00 : variable lookup takes most recent -->

<!-- REGRESSION GUARD: the two lines above MUST differ (500 vs 200). If they ever agree, the variable and group namespaces have been accidentally unified. -->

## Case-insensitive sigil normalization

Total CAC upper = `=sum:CAC` <!-- 500.00 : resolves against :cac -->
Total CAC mixed = `=sum:cAc` <!-- 500.00 -->

## Group aggregation with the shared entry

Total Expenses = `=sum:ex` <!-- 350.00 : 200 + 150 -->
Total Expenses w/o Groceries = `=sum:ex{!gr}` <!-- 200.00 -->

## Cross-namespace diagnostic (exact-match hint)

Walmart total = `=sum:Walmart`
<!-- ERROR: unknown group "Walmart" (echo the user's spelling, not "walmart"). "Walmart" exists as a variable, so the exact-match probe should fire: suggest tagging entries with a sigil or referencing `=Walmart` as a variable. -->

## Typo diagnostic (Damerau distance 1, transposition)

CPI = `=330.30`
ratio = `=CIP / 299.97`
<!-- ERROR: unknown variable "CIP", suggestion "CPI". Transposition must count as ONE edit (Damerau), not two. -->

## Non-suggestions

tiny = `=zq * 2`
<!-- ERROR: unknown variable "zq", NO suggestion. Nothing within the acceptance threshold; a wrong suggestion is worse than none. -->

## Ordinary inline code must remain untouched

Use `npm run build` to build the plugin.
Plain fraction in prose: `10 / 2`.
Not a declaration: CAC = `330.30`
<!-- All three: not-applicable. No render, no error, no CAC reassignment — Latest CAC above must still be 200.00 even though this line appears later, because it is ordinary code. -->
