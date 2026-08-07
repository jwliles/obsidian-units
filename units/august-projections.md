---
title: august-projections
aliases:
  - august projections
  - August Projections
authors:
  - jwl
date-created: 2026-08-03T13:51:43
date-updated: 2026-08-03T20:03:42
timestamp:
  - 1785784096211
id:
  - b0fccfdd-eb17-479e-b77a-2670cfe71365
tags: []
---

# august-projections

Checking:
- Balance = `=155.89` | Balance on 2026-08-05 before paycheck.

## 2026-08-05

PAY:
- Amount = `=645.22`
- Days Covered | 2026-08-05–2026-08-11

EXPENSES:
- CAC:cac:ex:a = `=250.00` | Partial payment made on time
- OG&E:ex:a = `=83.30` | Electricity Bill
- Progressive:ex:a = `=143.50` | Vehicle Insurance.
- Spotify:ex:a = `=12.99`
- Total = `=sum::ex{a}`

BALANCES:
- Starting = `=Balance+Amount`
- Ending = `=Starting-Total`

## 2026-08-12

PAY:
- Amount = `=645.22`
- Days Covered | 2026-08-12–2026-08-18

EXPENSES:
- CAC:cac:ex:b = `=104.90` | Remaining balance paid four days later
- City Bill:ex:b = `=86` | This is for water, sewer, trash, and other municipal services.
- Reach:rf:ex:b = `=138.62` | Bi-weekly payment - This leaves 48 payments. Moved from 2026-08-05 make space for Progressive. Progressive no longer has a flexible due date. It will be paid on time each month.
- Vyve:vy:ex:b = `=123.84` | Broadband Service. This leaves 121.47 unpaid.
- Total = `=sum::ex{b}`

BALANCES:
- Starting = `=Amount+Ending`
- Ending = `=Starting-Total`

## 2026-08-19

PAY:
- Amount = `=645.22`
- Days Covered | 2026-08-19–2026-08-25

EXPENSES:
- Reach:rf:ex:c = `=138.62` | Bi-weekly payment - This leaves 47 payments. This is back on schedule.
- Total = `=sum:ex{c}`

BALANCES:
- Starting = `=Amount+Ending`
- Ending = `=Starting-Total`

## 2026-08-26

PAY:
- Amount = `=645.22`
- Days Covered | 2026-08-26–2026-09-01

EXPENSES:
- Proton:ex:d = `=12.99`
- Vyve:vy:ex:d = `=121.47` | This will be a decision made in the moment.
- Total = `=sum:d`

BALANCES:
- Starting = `=Amount+Ending`
- Ending = `=Starting-Total`

Vyve Total = `=sum:vy`
CAC Total = `=sum:CAC`
Reach Total = `=sum:rf`
Latest CAC = `=CAC`
Expenses = `=sum:ex`
Expenses A = `=sum:ex{a}`
Expenses B = `=sum:ex{b}`
Expenses C = `=sum:ex{c}`
Expenses D  = `=sum:ex{d}`

## on hold

This is my payment arrangement with T-Mobile. The monthly bill was split into two equal payments two weeks apart.

- T-Mobile = `=125.32` | First arrangement payment; disputed pending account review.
- T-Mobile = `=125.32` | Second arrangement payment; disputed pending account review.
- Potential Liability = `=125.32+125.32`
