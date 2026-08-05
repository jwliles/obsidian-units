# Grouped Calculations Implementation Plan

## Objective

Implement the explicit-expression, colon-declaration, sigil-group, and aggregate syntax specified in `GROUPED_CALCULATIONS.md` while preserving supported unit-conversion behavior and giving Live Preview and Reading View the same results and diagnostics.

The implementation should establish one pure calculation engine shared by every Obsidian adapter. Rendering code must not contain a second parser or evaluator.

## Agreed first-release behavior

The implementation targets these decisions:

- Inline expressions owned by Obsidian Units must begin with `=`.
- Named declarations use `LABEL[:SIGIL...]: \`=EXPRESSION\``.
- Ordinary inline code without the leading marker is ignored.
- Labels remain human-readable and may contain spaces or punctuation already supported by variable resolution.
- Literal colons inside labels are rejected initially.
- Text sigils compare case-insensitively after Unicode normalization; emoji sequences are preserved.
- A declaration may belong to multiple chained groups.
- Repeated labels replace the previous value for later variable lookup.
- Every repeated declaration remains a separate group member.
- Variables and aggregates see successfully evaluated preceding declarations only.
- The first release aggregates dimensionless numeric values only.
- Aggregate results cannot themselves become group members in the first release.
- `{a,b}` means `a OR b`; the base group and every brace clause are joined by AND.
- `{!a}` negates a membership test.
- Mixed positive and negative terms in one brace clause are rejected. Repeated clauses express AND, such as `{ob,ls}{!late}`.
- `sum` and `count` return `0` for an empty selection.
- `avg`, `min`, and `max` return a visible empty-selection error.
- Command-palette conversion commands continue accepting expressions without a leading `=` because invoking the command supplies intent.
- Existing inline render modes, density conversions, trailing arithmetic `=`, and tolerated plural `s` remain supported.

## Target architecture

Refactor the current single-file implementation into cohesive subsystems. `main.ts` should become the Obsidian composition root: it loads settings, registers commands and adapters, and wires services together, but does not implement parsing or calculation rules.

Suggested structure:

```text
main.ts

src/
  calculations/
    ast.ts
    values.ts
    declarations.ts
    expression-parser.ts
    aggregate-parser.ts
    arithmetic.ts
    context.ts
    evaluator.ts
    diagnostics.ts

  units/
    types.ts
    catalog.ts
    aliases.ts
    parser.ts
    converter.ts
    densities.ts
    formatting.ts

  document/
    scanner.ts
    evaluation-index.ts
    cache.ts

  obsidian/
    live-preview.ts
    reading-view.ts
    commands.ts
    widgets.ts
    settings-tab.ts

  settings/
    types.ts
    defaults.ts

tests/
  calculations/
  units/
  document/
  compatibility/
```

These are subsystem boundaries, not a requirement to create a file for every small function. Closely related code should remain together when additional files would only add navigation overhead.

### Dependency rules

- `calculations/` and `units/` are pure TypeScript and never import Obsidian, CodeMirror, DOM APIs, or plugin settings storage.
- `document/` coordinates source-order scanning and evaluation but remains independent of rendering.
- `obsidian/` adapts evaluated document results to Live Preview, Reading View, commands, and settings UI.
- `main.ts` may import every subsystem to wire the plugin, but subsystems must not import `main.ts`.
- `calculations/` may call the unit subsystem through a narrow evaluator interface; the unit subsystem must not depend on the calculation language.
- Settings passed into the core use plain data interfaces rather than the plugin instance.
- Rendering adapters never parse expression grammar themselves.
- Avoid circular imports and mutable module-level evaluation state.

The dependency direction should remain:

```text
source text
  -> declaration and expression parsers
  -> typed AST
  -> top-down evaluation context
  -> result or diagnostic
  -> Live Preview / Reading View adapter
```

Existing unit tables and conversion settings may remain where they are initially, but the core evaluator should receive conversion behavior through a shared function or injected environment rather than importing Obsidian plugin state.

During implementation, existing unit tables can be moved mechanically before their behavior is changed. This separates refactoring failures from grammar failures and makes compatibility tests meaningful.

### Public subsystem contracts

Keep the surface between subsystems small. Conceptually, the document evaluator should need APIs similar to:

```ts
interface ExpressionEngine {
  parse(source: string): ExpressionParseOutcome;
  evaluate(node: ExpressionNode, context: EvaluationContext): EvaluationOutcome;
}

interface DocumentEvaluationIndex {
  outcomeAt(sourceOffset: number): EvaluationOutcome | undefined;
  declarationAt(sourceOffset: number): Declaration | undefined;
}
```

Live Preview and Reading View should consume `DocumentEvaluationIndex`; they should not receive mutable maps of variables or groups.

### Core types

Use discriminated unions so applicable failures cannot be confused with ordinary inline code:

```ts
type EvaluationOutcome =
  | { kind: 'success'; value: EvaluatedValue; display: string }
  | { kind: 'error'; diagnostic: EvaluationDiagnostic }
  | { kind: 'not-applicable' };

type EvaluatedValue =
  | { kind: 'number'; value: number }
  | { kind: 'quantity'; value: number; unit: string; dimension: string };
```

The initial aggregate evaluator accepts only `number`. Retaining a quantity representation prevents accidental unit stripping and leaves room for deliberate unit-aware aggregation later.

```ts
interface Declaration {
  label: string;
  normalizedLabel: string;
  groups: string[];
  expression: ExpressionNode;
  sourceOffset: number;
}

interface GroupMember {
  label: string;
  value: EvaluatedValue;
  groups: string[];
  sourceOffset: number;
}

interface EvaluationContext {
  variables: Map<string, EvaluatedValue>;
  groups: Map<string, GroupMember[]>;
}
```

## Phase 0: Test and extraction foundation

### Work

1. Add a lightweight TypeScript-compatible unit-test runner and `npm test` script.
2. Create the subsystem directories and core result/diagnostic types.
3. Add characterization tests for current behavior that must survive:
   - Arithmetic precedence and implicit multiplication.
   - Variable normalization and longest-name-first lookup.
   - Unit conversions and inline render modes.
   - Density conversions.
   - Trailing arithmetic `=`.
   - Plural `s` consumption.
   - Command conversion parsing without the inline marker.
4. Extract the existing unit catalog, conversion engine, arithmetic parser, and formatting helpers from `main.ts` without changing their behavior.
5. Reduce `main.ts` toward registration and dependency wiring while leaving existing rendering behavior intact.

### Exit criteria

- `npm test` and `npm run build` both pass.
- Preserved current behavior has executable characterization coverage.
- Core calculation, unit, and document modules have no Obsidian or CodeMirror imports.
- Existing behavior still works after the mechanical module extraction.

## Phase 1: Declaration and sigil parser

### Work

1. Parse only inline code spans whose content begins with `=` as explicit expressions.
2. Parse an optional declaration from the text immediately preceding the code span.
3. Separate the final declaration colon from zero or more attached sigils.
4. Normalize labels consistently with existing variable lookup.
5. Normalize sigils using a selected Unicode normalization form and case-insensitive text comparison.
6. Reject:
   - Empty labels when a declaration delimiter is present.
   - Empty sigils.
   - Literal or ambiguous colons in labels.
   - Structural delimiters or whitespace inside sigils.
   - Sigils beyond the chosen length limit.
7. Treat list markers, dates, pipes, and trailing notes as surrounding presentation rather than required syntax.

### Representative tests

```markdown
CPI: `=330.30`
Hourly rate:pay: `=24.50`
- 2026-07-03 | CashApp:ex:ls: `=50.00` | Landscaping
Netflix:💸:📺: `=20.00`
```

Verify that these are not plugin declarations:

```markdown
CPI = `330.30`
CPI: `330.30`
Use `npm run build`.
```

### Exit criteria

- The parser produces a typed declaration containing the display label, normalized lookup name, ordered unique groups, expression source, and source offset.
- Invalid declaration syntax returns a structured diagnostic.
- Parser tests cover ASCII, spaces, punctuation, Unicode, emoji, repeated sigils, and ledger presentation.

## Phase 2: Expression and aggregate AST

### Work

1. Introduce an expression AST rather than detecting aggregates with text substitution.
2. Preserve numeric, arithmetic, variable, conversion, density, and render-mode expressions.
3. Parse aggregate nodes with:
   - Function: `sum`, `count`, `avg`, `min`, or `max`.
   - Base group.
   - Zero or more brace filter clauses.
   - Positive OR terms within a clause.
   - Negative terms within a clause.
4. Reject mixed positive and negative terms within the same clause.
5. Support repeated clauses as AND:

```markdown
`=sum:ex{ob,ls}{!late}`
```

6. Produce source-position-aware diagnostics for malformed braces, unknown aggregate functions, empty filters, and invalid sigils.
7. Preserve the command parser as a separate explicit-intent entry point that does not require the leading marker.

### Representative tests

```markdown
`=sum:ex`
`=sum:ex{ob,ls}`
`=sum:ex{!gr}`
`=sum:ex{ob,ls}{!late}`
```

Invalid cases include:

```markdown
`=sum:`
`=sum:ex{}`
`=sum:ex{ob,!gr}`
`=unknown:ex`
`=sum:ex{ob`
```

### Exit criteria

- Every explicit inline expression yields an AST node or a structured parse error.
- Ordinary inline code yields `not-applicable`.
- Aggregate grammar and compatibility syntax have focused parser tests.

## Phase 3: Variable and group evaluation context

### Work

1. Traverse explicit expressions in source order with one `EvaluationContext`.
2. Evaluate each expression using only preceding context.
3. On a successful declaration:
   - Update the latest value for the normalized label.
   - Append one `GroupMember` record to each unique attached group.
4. Keep repeated declarations as distinct group members.
5. Evaluate aggregate filters against every member's complete group set.
6. Implement aggregate behavior:
   - `sum`: numerical sum; empty selection is `0`.
   - `count`: number of selected members; empty selection is `0`.
   - `avg`: arithmetic mean; empty selection is an error.
   - `min` and `max`: numerical extrema; empty selection is an error.
7. Reject unit-bearing members in aggregates with a diagnostic identifying the group and offending declaration.
8. Reject declarations that attach aggregate results to groups. Continue allowing an ungrouped aggregate to receive a label for later variable lookup if desired and covered by tests.
9. Detect unknown variables and suggest the nearest known label when confidence is sufficient.
10. Reject non-finite arithmetic results, division by zero, recursion, and other semantic failures with typed diagnostics.

### Representative scenario

```markdown
Walmart:ex:gr: `=60.00`
Walmart:ex:gr: `=25.00`
latest: `=Walmart`
expense total: `=sum:ex`
```

Expected behavior:

```text
latest        = 25.00
expense total = 85.00
```

### Exit criteria

- The evaluator is deterministic and independent of Obsidian rendering.
- Unit tests cover reassignment, repeated membership, filters, empty groups, invalid quantities, typo suggestions, and aggregate-group rejection.
- No evaluator path silently reduces a unit-bearing quantity to an untyped number.

## Phase 4: Live Preview and Reading View adapters

### Shared work

1. Replace `collectVariables` rescans with a shared document evaluation service or cache keyed by source text and relevant settings.
2. Ensure both renderers request the same outcome for a source offset.
3. Render:
   - Success as the existing result widget/span.
   - Error as a consistent diagnostic widget/span.
   - Not applicable as untouched inline code.
4. Refresh cached evaluation when the document or calculation-affecting settings change.

### Live Preview

1. Preserve editable source while the cursor intersects the code span.
2. Suppress or soften incomplete-expression diagnostics during active editing.
3. Render the result or full diagnostic after the cursor leaves the span.
4. Preserve the live-rendering toggle and generation refresh behavior.

### Reading View

1. Map rendered `<code>` elements back to source offsets reliably.
2. Reuse the document evaluation result rather than reconstructing context from rendered DOM text.
3. Preserve diagnostic styling and trailing plural consumption.
4. Handle Obsidian section post-processing without changing top-to-bottom scope.

### Commands

1. Keep selection/current-line unit conversion commands accepting plain conversion text.
2. Update result-insertion behavior to recognize the new explicit marker and declarations.
3. Ensure commands report structured diagnostic messages through notices.

### Exit criteria

- The same expression produces the same result or diagnostic in Live Preview and Reading View.
- Editing an incomplete expression remains comfortable.
- Ordinary inline code is never replaced.
- Large notes do not rescan the complete prefix independently for every visible expression.

## Phase 5: Grammar, evaluation, error, and compatibility verification

Tests are added throughout every phase; this phase closes coverage gaps and verifies the assembled plugin.

### Grammar matrix

- Explicit versus ordinary inline code.
- Colon declarations with zero, one, and multiple sigils.
- Multiword and punctuated labels.
- Text, Unicode, and emoji sigils.
- Ledger lines with and without dates, notes, or list markers.
- Aggregate functions and repeated filters.
- Invalid delimiters, colons, braces, and mixed filter clauses.

### Evaluation matrix

- Variable declaration, reference, and reassignment.
- Longest-name-first variable resolution.
- Repeated group members.
- OR, NOT, and repeated-clause AND filtering.
- Empty aggregate identities and errors.
- Unit-bearing member rejection.
- Aggregate result group-membership rejection.
- Preceding-content scope and lack of forward references.

### Error matrix

- Unknown variable with suggestion.
- Unknown group or aggregate function.
- Incomplete and malformed syntax.
- Division by zero and non-finite results.
- Empty `avg`, `min`, and `max`.
- Unsupported quantity aggregation.
- Ambiguous literal colon.
- Active-editor suppression versus inactive full diagnostic.

### Compatibility matrix

- Unit conversions in every existing category.
- Density conversions.
- `| result`, `| value`, and `| unit` modes.
- Trailing arithmetic `=`.
- Plural `s` consumption.
- Command-palette conversion input without a leading marker.
- Rendering toggle and settings refresh.

### Exit criteria

- `npm test` passes.
- `npm run build` passes.
- Manual smoke tests pass in both Live Preview and Reading View.
- The README accurately reflects implemented behavior rather than proposal syntax.

## Phase 6: Migration and documentation

### Migration command

Add a deliberate command that uses the old parser to classify existing notes:

1. Prefix recognized arithmetic and conversions with `=`.
2. Convert recognized `NAME = \`EXPRESSION\`` declarations to `NAME: \`=EXPRESSION\``.
3. Leave unrecognized inline code untouched.
4. Preview or report changed, ambiguous, and skipped expressions before destructive vault-wide use.
5. Operate on the active note first; consider vault-wide migration only as a separate, explicitly confirmed action.

Because there is currently one user, a legacy mode is unnecessary unless migration testing reveals a practical need.

### Documentation

1. Replace implicit-expression examples in `README.md`.
2. Document declarations, chained sigils, aggregates, filters, scope, and errors.
3. Show both terse and descriptive sigils.
4. Explain that grouped values are dimensionless in the first release.
5. Document preserved command behavior and the migration command.
6. Retain `GROUPED_CALCULATIONS.md` as the design rationale or mark it implemented once behavior matches it.

### Exit criteria

- Existing personal notes can be migrated deliberately and reviewed before saving.
- User documentation contains no examples of unsupported implicit inline evaluation.

## Manual acceptance example

Given:

```markdown
- 2026-07-03 | CashApp:ex:ls: `=50.00` | Landscaping
- 2026-07-03 | Walmart:ex:gr: `=60.00` | Groceries
- 2026-07-03 | OG&E:ex:ob:bi: `=180.00` | Electricity bill
- Total | `=sum:ex` | Expense total
- Total | `=sum:ex{ob,ls}` | Obligations and landscaping
- Total | `=sum:ex{!gr}` | Non-grocery expenses
```

Both Live Preview and Reading View must produce:

```text
sum:ex        = 290.00
sum:ex{ob,ls} = 230.00
sum:ex{!gr}   = 230.00
```

While this typo:

```markdown
CPI: `=330.30`
ratio: `=CIP / 299.97`
```

must produce a visible diagnostic similar to:

```text
Unknown variable "CIP". Did you mean "CPI"?
```

and this remains untouched:

```markdown
Use `npm run build`.
```

## Definition of done

- The agreed grammar is implemented without implicit inline evaluation.
- Core parsing and evaluation are independent of Obsidian rendering.
- Live Preview and Reading View share results and diagnostics.
- Group aggregation is dimension-safe and top-to-bottom.
- Breaking changes have a deliberate migration path.
- Automated grammar, evaluation, error, and compatibility tests pass.
- Production build and manual Obsidian smoke tests pass.
- README and design documentation match the shipped behavior.
