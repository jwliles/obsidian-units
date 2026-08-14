# Defect Log

## Status

No confirmed defects remain open. This file retains resolved defects and
investigated false leads to prevent regressions and repeated investigation.
Proposed capabilities remain separate in
[`FUTURE_IDEAS.md`](FUTURE_IDEAS.md).

---

## Resolved D1. Scientific notation failed before trailing arithmetic

**Resolution:** complete numeric literals are masked before unresolved-variable
detection, so exponent markers reach the arithmetic parser as part of their
numbers. Bare names such as `e3` remain unknown variables.

Regression coverage in `tests/09-scientific-notation.md` and
`tests/calculations.test.ts` spans integer and decimal mantissas, unsigned,
positive, and negative exponents, standalone values, trailing arithmetic,
uppercase `E`, and the bare-identifier boundary.

**Historical severity:** correctness-adjacent, but failed loudly rather than
producing a silent wrong number.

**Observed.**

| Expression | Result |
|---|---|
| `=1.5e3` | 1500.0 — correct |
| `=1.5^3 + 500` | 503.375 — correct |
| `=1.5e3 + 500` | **error: Unknown variable "e3"** |
| `=2e3` | 2000 — correct |

A scientific-notation literal evaluates correctly on its own. The identical literal, followed by any further arithmetic, fails with the exact error signature scientific notation used to produce before it was apparently fixed for the standalone case: the tokenizer treats `e3` as a bare identifier rather than part of the numeric literal.

The historical workaround was to expand scientific notation as multiplication
by a power of ten:

```text
1.5e3 + 500  ->  1.5*10^3 + 500
2e-3 * 4     ->  2*10^-3 * 4
```

Do not replace `1.5e3` with `1.5^3`; those expressions mean 1500 and 3.375,
respectively.

---

## Investigated, not defects — recorded to prevent re-investigation

**`=2e-3` rendering `0`.** Initially traced to the decimal-precision setting,
but presenting a non-zero result as zero is unsafe. Resolved in 0.6.0: the
configured precision remains the normal cap, but rendering extends just far
enough to expose the first significant digit whenever rounding would otherwise
show only zeros. Values whose first significant digit lies beyond ten decimal
places now use compact scientific notation; this also applies to conversions.

**`=2*e-3` and `=e` reporting "Unknown variable e."** Correct behavior. `e` has no special meaning outside the `<digits>e<digits>` adjacency; used as a bare identifier, it is unresolved like any other undeclared label.

**`=2**3` reporting "Malformed arithmetic expression."** Not a correctness defect — `**` was never specified as an exponent operator; only `^` is. This is a coverage gap (a spelling common in other languages isn't recognized), not a wrong-answer defect, and it fails the safe way, with a visible diagnostic. Worth a low-priority ergonomics item — accept `**` as a synonym for `^` at the tokenizer level — but not urgent, since `^` already covers the same ground correctly.
