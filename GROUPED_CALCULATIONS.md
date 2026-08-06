# Grouped Calculations Proposal

## Status

Implemented. This document is retained as the design rationale; user-facing syntax is documented in `README.md`.

This document describes a proposed syntax and behavior for explicit calculations, grouped values, and aggregate functions in Obsidian Units. It is a design proposal, not documentation for an implemented feature.

The proposal contains one intentional breaking syntax change: every Obsidian Units inline expression must begin with `=`. Named declarations retain `=` between the declaration prefix and inline expression.

The old implicit and new explicit forms differ as follows:

```markdown
<!-- Current syntax -->
CPI = `330.30`
ratio = `CPI / 299.97`

<!-- Proposed syntax -->
CPI = `=330.30`
ratio = `=CPI / 299.97`
```

## Compatibility impact

The explicit-expression syntax break has several related behavioral consequences.

### Implicit conversions and numeric expressions

The leading marker applies to conversions and numeric literals as well as arithmetic:

```markdown
`33 meters to feet`   <!-- ordinary inline code -->
`=33 meters to feet`  <!-- Obsidian Units conversion -->

`330.30`              <!-- ordinary inline code -->
`=330.30`             <!-- Obsidian Units value -->
```


### Visible failures

An explicit expression that cannot be evaluated is an error, not ordinary inline code. This changes failure behavior intentionally: invalid expressions that previously remained visibly unchanged should instead render a diagnostic.

### Declaration and colon syntax

A declaration uses whitespace-surrounded `=` immediately before an explicit inline expression. The text to its left is the declaration prefix. Within that prefix, colons attach group sigils to the label:

```markdown
pay day:ic = `=645.24`
```

Whitespace may occur inside a label, but not inside a sigil. After trimming the declaration prefix, `=` must be the next non-whitespace token after the label or final sigil. A label must not contain `=` because it is the declaration delimiter. Labels that contain literal colons are also ambiguous and should initially be rejected with a useful error.

### Duplicate labels

Repeated labels have two distinct behaviors:

- Variable lookup uses the most recent preceding declaration with that label, preserving top-to-bottom reassignment behavior.
- Group aggregation retains every successfully evaluated entry, including entries whose labels repeat.

For example, both Vendor entries contribute to `:ex`, while a later expression that references `Vendor` receives the second value:

```markdown
Vendor:ex = `=60.00`
Vendor:ex = `=25.00`
latest = `=Vendor`        <!-- 25.00 -->
total = `=sum:ex`         <!-- 85.00 -->
```

### Inline render modes

Existing inline render modes should remain available after the leading marker:

```markdown
`=33 meters to feet | result`
`=33 meters to feet | value`
`=33 meters to feet | unit`
```

A pipe inside the code span belongs to the expression. Pipes outside it remain ledger-field separators.

### Command-palette conversions

The leading `=` requirement applies to inline expressions. Invoking a conversion command already supplies explicit user intent, so command-palette input may continue to accept plain expressions such as:

```text
5 ft to cm
```

This distinction must be confirmed during implementation and documented in the user-facing README.

### Numerical values and presentation

Groups contain evaluated numerical values. Currency symbols, LaTeX, and ledger notes are presentation rather than part of group identity. Currency-aware arithmetic or validation would be a separate feature.

## Goals

- Distinguish Obsidian Units expressions from ordinary inline code.
- Make calculation errors visible instead of silently leaving invalid expressions unrendered.
- Allow values on arbitrary lines to belong to one or more named groups.
- Calculate totals and other aggregates from those groups.
- Keep financial ledgers readable as normal Markdown without making the feature specific to financial tracking.
- Support short textual sigils, icons, and emoji.

## Explicit expressions

Every expression owned by Obsidian Units begins with `=` inside an inline code span:

```markdown
`=10 / 2`
`=33 meters to feet`
```

Inline code without the leading `=` is ordinary Markdown and is not evaluated:

```markdown
`10 / 2`
`npm run build`
```

This is intentionally a breaking change from implicit evaluation. It gives the plugin a reliable indication that an expression must either produce a result or display an error. The existing declaration assignment remains in place.

## Declarations

A named value retains the existing assignment delimiter and is followed by an explicit expression:

```markdown
CPI = `=330.30`
ratio = `=CPI / 299.97`
```

The declaration form itself is unchanged. Only the inline code span gains the explicit marker:

```markdown
CPI = `330.30`   <!-- ordinary Markdown; does not declare CPI -->
CPI = `=330.30`  <!-- Obsidian Units declaration -->
```

General form:

```text
LABEL[:SIGIL...] = `=EXPRESSION`
```

The assignment delimiter is whitespace-surrounded `=`. Colons attached directly to the label are group sigils. The label is the first prefix segment and may contain whitespace, but it may not contain `=`. Every subsequent segment is a sigil and may not contain whitespace.

## Ledger form

Pipes can separate the structural fields of a ledger entry:

```text
- DATE | LABEL[:SIGIL...] = `=EXPRESSION` | OPTIONAL NOTE
```

Example:

```markdown
- 2026-07-03 | Service:ex:ls = `=50.00` | Example service
- 2026-07-03 | Store:ex:gr = `=60.00` | Example purchase
- 2026-07-03 | Utility:ex:ob:bi = `=180.00` | Recurring charge
```

The Markdown list marker is recognized only at the beginning of a line. The pipes provide clear field boundaries, while everything after the second pipe is commentary and does not affect evaluation.

The ledger form is a convention rather than a separate data format. A declaration can appear outside a list or without a date:

```markdown
Hourly rate:pay = `=24.50`
```

## Group sigils

Each colon-attached sigil adds the value to a group:

```markdown
Service:ex:ls = `=50.00`
```

This declaration has:

- Label: `Service`
- Value: `50.00`
- Group memberships: `:ex` and `:ls`

An entry contributes its evaluated value once to every attached group. Repeated labels are allowed and do not overwrite earlier group members.

Chaining provides classification without requiring a prose note:

```markdown
Store:ex:gr = `=60.00`
```

Notes remain available when additional context is useful:

```markdown
- 2026-07-03 | Service:ex:ls = `=50.00` | Example service
```

### Allowed sigils

Sigils are not limited to ASCII letters. Text, numbers, icons, and emoji should be supported:

```markdown
Subscription:expense:recurring = `=20.00`
Subscription:💸:📺 = `=20.00`
```

Whitespace and structural delimiters cannot occur inside an unquoted sigil. At minimum, the following terminate or invalidate a sigil:

```text
whitespace  :  |  =  `
```

Implementations should normalize Unicode before comparing sigils. Alphabetic sigils should compare case-insensitively, while emoji sequences should be preserved. A reasonable maximum length, such as 64 Unicode code points, can prevent accidental malformed matches.

## Aggregates

An aggregate uses a function name followed by a group sigil:

```markdown
- Total | `=sum:ex` | Expense total
```

Using the example entries above, `sum:ex` evaluates to `290.00`.

Initial aggregate functions may include:

```markdown
`=sum:ex`
`=count:ex`
`=avg:ex`
`=min:ex`
`=max:ex`
```

Aggregate lines do not include themselves unless they are explicitly declared as members of the queried group. Self-reference and recursive aggregation must produce an error rather than silently returning a partial value.

## Aggregate filters

Braces filter a base group by additional group memberships:

```markdown
`=sum:ex{ob,ls}`
```

The base group and the brace expression are joined by AND. Comma-separated members inside braces are alternatives joined by OR:

```text
:ex AND (:ob OR :ls)
```

With the ledger above, this includes Service (`:ex:ls`) and Utility (`:ex:ob:bi`) but excludes Store (`:ex:gr`).

Negation is clause-scoped. Prefixing every member of a clause with `!` complements the union named by that clause:

```markdown
`=sum:ex{!gr}`
```

Its meaning is:

```text
:ex AND NOT :gr
```

For multiple exclusions:

```markdown
`=sum:ex{!ob,!ls}`
```

the clause means:

```text
:ex AND NOT (:ob OR :ls)
```

By De Morgan's law, this is equivalent to `:ex AND NOT :ob AND NOT :ls`. It does not mean `(NOT :ob) OR (NOT :ls)`: `!` selects negated-clause mode rather than binding independently to each term. Every member of a negated clause must carry `!` for readability. Mixed clauses such as `{ob,!ls}` are invalid.

Therefore:

```markdown
`=sum:ex`          <!-- all expenses -->
`=sum:ex{ob,ls}`   <!-- expenses categorized as obligations or landscaping -->
`=sum:ex{!gr}`     <!-- expenses not categorized as groceries -->
`=sum:ex{!ob,!ls}` <!-- expenses categorized as neither obligations nor landscaping -->
```

### Primary totals and secondary breakdowns

Filters provide secondary or temporary tabulations without creating a separate kind of cascade. Every entry remains in one primary group, and an additional sigil marks only the entries that need a separate subtotal:

```markdown
paycheck:ic = `=645.45`
bonus:ic:bonus = `=723.98`

regular income = `=sum:ic{!bonus}`
bonus income = `=sum:ic{bonus}`
total income = `=sum:ic`
```

The base `:ic` group rolls the complete income total forward. The `:bonus` membership selects the secondary amount, while `{!bonus}` selects the complement. Only exceptional entries require the extra sigil, and the overall total cannot accidentally omit them. The same pattern can create any number of named breakdowns without adding another kind of cascade.

Explicit `|` and `&` operators could be added later if expressions need nested Boolean logic. The initial comma-as-OR and `!` grammar should remain deliberately small.

## Evaluation order and scope

Calculations are evaluated from top to bottom, consistent with existing variable behavior. An aggregate sees successfully evaluated group members that precede it in the note. Later declarations do not retroactively change an earlier result.

This makes totals at the end of a section or note predictable and avoids requiring a document-wide dependency graph. Supporting forward references or whole-document aggregates can be considered separately if a compelling use case appears.

Repeated variable declarations replace the earlier value for subsequent variable references, but they remain separate entries in every group to which they belong.

## Error handling

Because every plugin expression starts with `=`, failure should be visible in both Live Preview and Reading View. Evaluation should distinguish three outcomes:

```text
success         render the calculated result
error           render a visible diagnostic
not applicable  leave ordinary inline code unchanged
```

Examples of useful diagnostics include:

- Unknown variable, with a close-name suggestion when possible.
- Unknown group or aggregate function.
- Missing parenthesis or brace.
- Unexpected character or operator.
- Forbidden `=` in a variable name.
- Division by zero or a non-finite result.
- Empty aggregate group.
- Recursive or self-referential calculation.

For example:

```markdown
CPI = `=330.30`
ratio = `=CIP / 299.97`
```

should display an error similar to:

```text
Unknown variable "CIP". Did you mean "CPI"?
```

Ordinary inline code remains unchanged because it lacks the leading marker:

```markdown
Use `npm run build` to build the plugin.
```

## Parsing principles

The implementation should parse the syntax in small stages rather than relying on one expression for an entire Markdown line:

1. Identify inline code whose content begins with `=`.
2. Inspect the text immediately preceding the code for a whitespace-surrounded assignment `=` and an optional declaration prefix.
3. Split the trimmed prefix into its label and attached group sigils.
4. Evaluate the explicit expression.
5. Store a successful named value and append it to each attached group.
6. Evaluate aggregate functions against the group context accumulated so far.

The optional date, list marker, pipes, and note are presentational fields. They should not be required for the calculation engine to understand a declaration.

## Decisions still to confirm

The following details should be settled before implementation:

- **Literal colons in labels:** reject them initially or introduce escaping/quoting.
- **Empty aggregates:** render an error, or define identities such as `sum = 0` and `count = 0` while leaving `avg`, `min`, and `max` as errors.
- **Command input:** confirm that command-palette conversions remain valid without a leading `=`.
- **Aggregate scope:** retain the proposed preceding-content scope or deliberately adopt whole-note collection.
- **Boolean filters:** initially support only comma-as-OR and `!`, or include explicit `|` and `&` operators.
- **Sigil limits:** finalize normalization, permitted structural characters, and maximum length.

## Complete example

```markdown
## Expenses

- 2026-07-03 | Service:ex:ls = `=50.00` | Example service
- 2026-07-03 | Store:ex:gr = `=60.00` | Example purchase
- 2026-07-03 | Utility:ex:ob:bi = `=180.00` | Recurring charge

- Total | `=sum:ex` | Expense total
- Total | `=sum:ex{ob,ls}` | Obligations and landscaping
- Total | `=sum:ex{!gr}` | Non-grocery expenses
```

Expected results:

```text
sum:ex          = 290.00
sum:ex{ob,ls}   = 230.00
sum:ex{!gr}     = 230.00
```
