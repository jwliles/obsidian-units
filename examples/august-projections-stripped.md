---
title: august-projections-stripped
aliases:
  - august projections stripped
  - August Projections Stripped
date-created: 2026-08-06T16:56:15
date-updated: 2026-08-06T16:58:34
timestamp:
  - 1786035375510
id:
  - a78fe5f3-2fcb-42c9-a7ac-ac0c7130479e
---

# august-projections-stripped

Regression note derived from an earlier projection ledger with every manual
period letter (`:a` through `:d`) removed. Under the selected semantics, each
`sum@ex` reads and closes that period's local expense accumulation. The four
period totals must be 489.79, 453.36, 138.62, and 134.46. The final global
`sum:ex` is 1216.23, while the final local read repeats the most recently
closed period, 134.46.

Checking:
- Balance = `=155.89` | Balance on 2026-08-05 before paycheck.

## 2026-08-05

PAY:
- Amount = `=645.22`
- Days Covered | 2026-08-05–2026-08-11

EXPENSES:
- CAC:cac:ex = `=250.00` | Partial payment made on time
- OG&E:ex = `=83.30` | Electricity Bill
- Progressive:ex = `=143.50` | Vehicle Insurance.
- Spotify:ex = `=12.99`
- Total = `=sum@ex`

BALANCES:
- Starting = `=Balance+Amount`
- Ending = `=Starting-Total`

## 2026-08-12

PAY:
- Amount = `=645.22`
- Days Covered | 2026-08-12–2026-08-18

EXPENSES:
- CAC:cac:ex = `=104.90` | Remaining balance paid four days later
- City Bill:ex = `=86` | This is for water, sewer, trash, and other municipal services.
- Reach:rf:ex = `=138.62` | Bi-weekly payment
- Vyve:vy:ex = `=123.84` | Broadband Service.
- Total = `=sum@ex`

BALANCES:
- Starting = `=Amount+Ending`
- Ending = `=Starting-Total`

## 2026-08-19

PAY:
- Amount = `=645.22`
- Days Covered | 2026-08-19–2026-08-25

EXPENSES:
- Reach:rf:ex = `=138.62` | Bi-weekly payment
- Total = `=sum@ex`

BALANCES:
- Starting = `=Amount+Ending`
- Ending = `=Starting-Total`

## 2026-08-26

PAY:
- Amount = `=645.22`
- Days Covered | 2026-08-26–2026-09-01

EXPENSES:
- Proton:ex = `=12.99`
- Vyve:vy:ex = `=121.47`
- Total = `=sum@ex`

BALANCES:
- Starting = `=Amount+Ending`
- Ending = `=Starting-Total`

Vyve Total = `=sum:vy`
CAC Total = `=sum:CAC`
Reach Total = `=sum:rf`
Latest CAC = `=CAC`
Expenses (global, all periods) = `=sum:ex`
Expenses (local, last read) = `=sum@ex`

Expected values:

- Period 1: 489.79
- Period 2: 453.36
- Period 3: 138.62
- Period 4: 134.46
- Global expenses: 1216.23
- Most recently closed local expenses: 134.46

The retired same-label continuity implementation instead produces cumulative
period totals because the vendor labels differ and no declaration closes
`ex`. That behavior is the regression this note preserves.
