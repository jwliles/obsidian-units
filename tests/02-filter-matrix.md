# UNITS-TEST 02 — Aggregate filter matrix

## Ledger

- 2026-08-05 | Service:ex:ls = `=50.00` | Landscaping service
- 2026-08-05 | Store:ex:gr = `=60.00` | Groceries
- 2026-08-05 | Utility:ex:ob:bi = `=180.00` | Obligation, billed
- 2026-08-05 | Market:ex:gr:ls = `=40.00` | Groceries and landscaping

## Base aggregates

`=sum:ex` <!-- expect:value 330.00 -->
`=count:ex` <!-- expect:value 4 -->
`=avg:ex` <!-- expect:value 82.50 -->
`=median:ex` <!-- expect:value 55.00 -->
`=min:ex` <!-- expect:value 40.00 -->
`=max:ex` <!-- expect:value 180.00 -->

## Positive, negative, OR, and AND

`=sum:ex{gr}` <!-- expect:value 100.00 -->
`=sum:ex{!gr}` <!-- expect:value 230.00 -->
`=sum:ex{ob,ls}` <!-- expect:value 270.00 -->
`=sum:ex{!ob,!ls}` <!-- expect:value 60.00 -->
`=sum:ex{!ob}{!ls}` <!-- expect:value 60.00 -->
`=sum:ex{gr}{ls}` <!-- expect:value 40.00 -->
`=sum:ex{ob,ls}{!gr}` <!-- expect:value 230.00 -->

## Implicit label histories are filter memberships

`=sum:ex{market}` <!-- expect:value 40.00 -->
`=sum:ex{!market}` <!-- expect:value 290.00 -->

## Mixed polarity is rejected

`=sum:ex{!gr,ls}` <!-- expect:error aggregate-syntax -->

## Empty selections

`=sum:ex{ob}{gr}` <!-- expect:value 0 -->
`=count:ex{ob}{gr}` <!-- expect:value 0 -->
`=avg:ex{ob}{gr}` <!-- expect:error empty-aggregate -->
`=median:ex{ob}{gr}` <!-- expect:error empty-aggregate -->
`=min:ex{ob}{gr}` <!-- expect:error empty-aggregate -->
`=max:ex{ob}{gr}` <!-- expect:error empty-aggregate -->
