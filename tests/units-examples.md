---
title: units-examples
aliases:
  - units examples
  - Units Examples
authors:
  - jwl
date-created: 2026-08-05T08:35:17
date-updated: 2026-08-05T11:50:09
timestamp:
  - 1785948563207
id:
  - a90eaba5-8108-484f-ae0a-233947cb7705
tags: []
---

# units-examples

CAC:cac = `=300.00`
CAC:cac:ex = `=200.00`
Walmart:ex:gr = `=150.00`
Fuel:ex:fl = `=40.00`
Aldi:gr = `=80.00`
Total Expenses = `=sum:ex{!gr,fl}`
Total Expenses w/o Groceries = `=sum:ex{!gr}`
Total CAC = `=sum:CAC`
Latest CAC = `=CAC`
Total Groceries = `=sum:gr`
