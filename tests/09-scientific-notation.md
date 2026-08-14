# Scientific notation

## Integer mantissa

No sign = `=2e3` <!-- expect:value 2000 -->
Positive exponent = `=2e+3` <!-- expect:value 2000 -->
Negative exponent = `=2e-3` <!-- expect:value 0.002 -->
No sign with arithmetic = `=2e3+1` <!-- expect:value 2001 -->
Positive exponent with arithmetic = `=2e+3+1` <!-- expect:value 2001 -->
Negative exponent with arithmetic = `=2e-3+1` <!-- expect:value 1.002 -->

## Decimal mantissa

Decimal no sign = `=1.5e3` <!-- expect:value 1500.0 -->
Decimal positive exponent = `=1.5e+3` <!-- expect:value 1500.0 -->
Decimal negative exponent = `=1.5e-3` <!-- expect:value 0.0015 -->
Decimal no sign with arithmetic = `=1.5e3+1` <!-- expect:value 1501.0 -->
Decimal positive exponent with arithmetic = `=1.5e+3+1` <!-- expect:value 1501.0 -->
Decimal negative exponent with arithmetic = `=1.5e-3+1` <!-- expect:value 1.0015 -->

## Token boundaries

Uppercase exponent = `=1.5E3*2` <!-- expect:value 3000.0 -->
Bare exponent-like variable = `=e3+1` <!-- expect:error unknown-variable -->

## Exact decimal and compact display

Cancellation = `=0.3-0.2-0.1` <!-- expect:value 0.0 -->
Tiny decimal = `=2e-12` <!-- expect:value 2 × 10⁻¹² -->
