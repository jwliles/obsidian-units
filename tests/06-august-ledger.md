# UNITS-TEST 06 — Real ledger regression

This is the minimal shape from the August projections note. Distinct vendor
labels share `ex`; each double-colon total closes only the current local `ex`
accumulation. No period letters or filters are required.

Balance = `=155.89`

## Period 1

Amount = `=645.22`
CAC:ex = `=250.00`
OG&E:ex = `=83.30`
Progressive:ex = `=143.50`
Spotify:ex = `=12.99`

Period 1 total = `=sum::ex` <!-- expect:value 489.79 -->
Period 1 starting = `=Balance + Amount` <!-- expect:value 801.11 -->
Period 1 ending = `=Period 1 starting - Period 1 total` <!-- expect:value 311.32 -->

## Period 2

Amount = `=645.22`
CAC:ex = `=104.90`
City Bill:ex = `=86.00`
Reach:ex = `=138.62`
Vyve:ex = `=123.84`

Period 2 total = `=sum::ex` <!-- expect:value 453.36 -->
Period 2 starting = `=Amount + Period 1 ending` <!-- expect:value 956.54 -->
Period 2 ending = `=Period 2 starting - Period 2 total` <!-- expect:value 503.18 -->

## Global and implicit histories

Global expenses = `=sum:ex` <!-- expect:value 943.15 -->
City Bill expenses = `=sum:ex{city bill}` <!-- expect:value 86.00 -->
All CAC payments = `=sum:cac` <!-- expect:value 354.90 -->
Latest CAC payment = `=CAC` <!-- expect:value 104.90 -->
Latest closed period = `=sum::ex` <!-- expect:value 453.36 -->
