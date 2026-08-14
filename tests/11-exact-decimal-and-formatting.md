# Exact decimal arithmetic and formatting boundaries

## Decimal operations

Addition = `=0.1+0.2` <!-- expect:value 0.3 -->
Cancellation = `=0.1+0.2-0.3` <!-- expect:value 0.0 -->
Unsigned zero = `=-0` <!-- expect:value 0 -->
Scaled zero = `=0.00-0.00` <!-- expect:value 0.00 -->
Implicit multiplication = `=0.1(3)` <!-- expect:value 0.3 -->
Decimal power = `=0.1^2` <!-- expect:value 0.01 -->
Repeating division = `=1/3` <!-- expect:value 0.3333 -->

First:decimal = `=0.1`
Second:decimal = `=0.2`
Variable chain = `=First+Second` <!-- expect:value 0.3 -->
Exact sum = `=sum:decimal` <!-- expect:value 0.3 -->
Exact average = `=avg:decimal` <!-- expect:value 0.15 -->

## Half-even presentation rounding

Even tie stays = `=1.23445` <!-- expect:value 1.2344 -->
Odd tie rises = `=1.23455` <!-- expect:value 1.2346 -->
Negative even tie stays = `=-1.23445` <!-- expect:value -1.2344 -->
Negative odd tie falls = `=-1.23455` <!-- expect:value -1.2346 -->

## Fixed-to-scientific boundary

Tenth decimal place = `=1e-10` <!-- expect:value 0.0000000001 -->
Beyond tenth place = `=1e-11` <!-- expect:value 1 × 10⁻¹¹ -->
Negative tenth place = `=-1e-10` <!-- expect:value -0.0000000001 -->
Negative beyond tenth = `=-1e-11` <!-- expect:value -1 × 10⁻¹¹ -->
Rounded exponent carry = `=9.99996e-12` <!-- expect:value 1 × 10⁻¹¹ -->

## Large exact values

Large integer = `=1e25` <!-- expect:value 10000000000000000000000000 -->
