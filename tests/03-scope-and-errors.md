---
title: 03-scope-and-errors
aliases:
  - 03 scope and errors
  - 03 Scope And Errors
authors:
  - jwl
date-created: 2026-08-05T09:59:09
date-updated: 2026-08-05T11:49:10
timestamp:
  - 1785948525717
id:
  - 67634daa-0599-4ab7-b032-06efc5a2ba96
tags: []
---

# 03-scope-and-errors

## Aggregate before any member (pins the scope decision)

`=sum:pre`
<!-- ERROR expected: unknown group "pre" — no member precedes this line, so under preceding-content scope the group does not exist yet. NOTE: if whole-note collection is ever adopted instead, this expected value changes to 15.00. This line is the fixture that forces that decision to be made deliberately. -->

first:pre = `=5.00`
second:pre = `=10.00`

`=sum:pre` <!-- 15.00 : both members now precede the aggregate -->

## Later declarations do not rewrite earlier results

`=sum:pre` <!-- 15.00 -->
third:pre = `=100.00`
`=sum:pre` <!-- 115.00 : but the line above must still show 15.00 -->

## Self-reference and recursion

a:t = `=5.00`
total:t = `=sum:t`
<!-- ERROR: declaration attaches an aggregate result to the group it queries. Must be rejected, never partially evaluated to 5.00. -->

running total = `=sum:t` <!-- 5.00 : ungrouped LABELED aggregate is fine -->
doubled = `=running total * 2` <!-- 10.00 : aggregate result reusable as a variable via its label -->

self = `=self`
<!-- ERROR: unknown variable "self" — no preceding declaration; a declaration's own expression must not see its own label. -->

## Arithmetic failures

`=10 / 0` <!-- ERROR: division by zero -->
`=10 / (5 - 5)` <!-- ERROR: division by zero after evaluation, not just literal-zero detection -->

## Malformed declaration prefixes

bad:si gil = `=1.00`
<!-- ERROR: whitespace inside a sigil ("si gil" cannot be a sigil; "bad" is the label, so the second segment is invalid). -->

empty:: = `=1.00`
<!-- ERROR: empty sigil. With the secondary cascade removed, "::" has no meaning; it is an empty sigil and must be rejected, not silently treated as ":". -->

a = b = `=1.00`
<!-- ERROR: "=" inside the declaration prefix. Per the settled decision, "=" is rejected in labels alongside literal colons; this must produce a diagnostic, not silently declare label "a = b" or label "b". -->

:gr = `=1.00`
<!-- ERROR: empty label with a declaration delimiter present. -->

## Ordinary code adjacent to errors

The failures above must not leak: `echo hello` stays untouched,
and this still works: sanity = `=2 + 2` <!-- 4 -->
