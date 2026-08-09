# Regional aggregation

## Active, completed, and outside membership

`=top` <!-- expect:structure region-top -->

A = `=10`
B = `=20`
Running = `=sum:>` <!-- expect:value 30 -->
C = `=5`
Running again = `=sum:>` <!-- expect:value 35 -->

`=bottom` <!-- expect:structure region-bottom -->

Latest completed = `=sum:>` <!-- expect:value 35 -->
Outside = `=100`
Still completed = `=sum:>` <!-- expect:value 35 -->
Q1 total:period_total = `=sum:>` <!-- expect:value 35 -->

`=top`
D = `=7`
`=bottom`

Q2 total:period_total = `=sum:>` <!-- expect:value 7 -->
All periods = `=sum:period_total` <!-- expect:value 42 -->

## Filters and functions

`=top`
Food:food:paid = `=1.00`
Fuel:fuel = `=4.00`
Other = `=9.00`
Regional sum = `=sum:>` <!-- expect:value 14.00 -->
Regional count = `=count:>` <!-- expect:value 3 -->
Regional average = `=avg:>` <!-- expect:value 4.6667 -->
Regional median = `=median:>` <!-- expect:value 4.00 -->
Regional minimum = `=min:>` <!-- expect:value 1.00 -->
Regional maximum = `=max:>` <!-- expect:value 9.00 -->
Food or fuel = `=sum:>{food,fuel}` <!-- expect:value 5.00 -->
Not paid = `=sum:>{!paid}` <!-- expect:value 13.00 -->
`=bottom`

## Aggregate-containing selection

Base:base = `=10`

`=top`
Direct aggregate = `=sum:base` <!-- expect:value 10 -->
Nested aggregate = `=sum:base + 10` <!-- expect:value 20 -->
Compact aggregate = `=sum:base+5` <!-- expect:value 15 -->
Indirect scalar = `=Direct aggregate + 1` <!-- expect:value 11 -->
Raw = `=5`
Selected = `=sum:>` <!-- expect:value 16 -->
`=bottom`

Selected after close = `=sum:>` <!-- expect:value 16 -->

## Even median

`=top`
Low = `=1.00`
High = `=4.00`
Even median = `=median:>` <!-- expect:value 2.50 -->
`=bottom`
