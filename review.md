# Review of the Grouped Calculations Proposal

## Scope

This document reviews `GROUPED_CALCULATIONS.md` against the current behavior documented in the Obsidian Units `README`. It does not replace the proposal. Its purpose is to identify the parts that appear strong, the decisions that should be settled before implementation, and the details that can reasonably wait.

## Overall assessment

The proposal is a strong direction for Obsidian Units.

An explicit, configurable marker gives the plugin an ownership boundary; the default is `=`:

```markdown
`10 / 2`   <!-- ordinary inline code -->
`=10 / 2`  <!-- Obsidian Units expression -->
```

That change removes the need to guess whether arbitrary inline code is intended as arithmetic or a conversion. It also makes visible errors reasonable: once a user explicitly marks an expression for evaluation, failure should not silently fall back to ordinary code.

Grouped values and aggregate functions also fit the plugin well. They are useful for ledgers, inventories, measurements, test results, time tracking, nutrition, and other notes that contain repeated calculated values. The design is not inherently accounting-specific.

The duplicate-label behavior is particularly sound:

- Variable lookup receives the most recent preceding declaration.
- Group aggregation retains every successful declaration.

That preserves the existing top-to-bottom reassignment model while allowing repeated labels such as `Walmart` to remain separate group members.

## Core decisions worth retaining

The following parts of the proposal should remain unless implementation reveals a concrete problem:

1. Every inline expression owned by Obsidian Units begins with the configured marker, defaulting to `=`.
2. Named declarations use `:` rather than a second `=`.
3. A declaration may attach the value to one or more groups.
4. Aggregate functions operate on previously evaluated group members.
5. Repeated declarations replace earlier values only for subsequent variable lookup.
6. Repeated declarations remain separate members of their groups.
7. Ordinary inline code is ignored.
8. Invalid explicit expressions produce visible diagnostics.
9. Command-palette conversion input may remain valid without the leading `=` because invoking the command already supplies explicit intent.
10. The Markdown list marker, date, pipes, and trailing note remain presentational rather than required calculation syntax.

## Decisions to settle before implementation

### 1. Human-readable labels and variable identifiers

The proposal currently uses the declaration label for several purposes:

- Display text in the note.
- Variable assignment.
- Group-member identification.

These examples are not equivalent as variable identifiers:

```markdown
CPI: `=330.30`
Hourly rate:pay: `=24.50`
OG&E:ex:ob:bi: `=180.00`
```

`CPI` is a conventional identifier. `Hourly rate` contains whitespace. `OG&E` contains an arithmetic operator. The proposal should define whether all labels are referenceable in later expressions.

#### Recommended initial rule

Allow any valid display label to participate in groups, but only labels matching the plugin's variable-identifier grammar should be available through ordinary variable lookup.

For example:

```markdown
CPI: `=330.30`
ratio: `=CPI / 299.97`
```

works as a variable declaration, while:

```markdown
Hourly rate:pay: `=24.50`
```

still contributes to `:pay` but is not directly referenceable as `Hourly rate` in an arithmetic expression.

A later release could add quoted lookup if there is a real use case:

```markdown
`=value("Hourly rate")`
```

This avoids forcing display labels into a restrictive identifier grammar and avoids building a quoting system before it is needed.

### 2. Aggregation of values that carry units

The proposal defines groups as collections of evaluated numerical values, but the current plugin also evaluates unit-bearing quantities. The interaction between these features needs an explicit rule.

Example:

```markdown
Board A:mass: `=5 kg`
Board B:mass: `=10 lb`
Total: `=sum:mass`
```

Possible behaviors include:

- Convert compatible quantities to a canonical unit and add them.
- Convert all values to the first member's unit.
- Require the aggregate expression to specify an output unit.
- Reject unit-bearing values in aggregates.
- Ignore units and add only the numeric portions.

The last option should not be allowed because it could silently add incompatible dimensions.

#### Recommended initial rule

Restrict grouped aggregates to dimensionless numeric results in the first implementation. If a group contains a unit-bearing value, return a visible error such as:

```text
Cannot aggregate group "mass": grouped unit quantities are not supported yet.
```

Same-dimension unit aggregation can then be designed deliberately as a later feature.

### 3. Mixed positive and negative filters

The proposed meanings of these forms are clear:

```markdown
`=sum:ex{ob,ls}`
`=sum:ex{!gr}`
```

The first means:

```text
:ex AND (:ob OR :ls)
```

The second means:

```text
:ex AND NOT :gr
```

The following form is less obvious:

```markdown
`=sum:ex{ob,!gr}`
```

Under the current stated grammar, it would mean:

```text
:ex AND (:ob OR NOT :gr)
```

That includes nearly every non-grocery expense, not merely obligations that are not groceries.

#### Recommended initial rule

Either reject positive and negative members mixed inside one brace expression, or support repeated brace clauses joined by AND:

```markdown
`=sum:ex{ob,ls}{!gr}`
```

Meaning:

```text
:ex AND (:ob OR :ls) AND NOT :gr
```

Repeated brace clauses keep the grammar compact while avoiding a full Boolean-expression language.

## Evaluation and rendering behavior

### Visible errors while editing

Visible diagnostics are appropriate once an expression is intended to be complete. In Live Preview, however, users will pass through incomplete states while typing:

```markdown
`=33 meters t`
`=(10 +`
`=sum:ex{`
```

The current plugin already keeps inline code editable while the cursor is inside it. The grouped-calculation implementation should preserve that editing behavior.

#### Recommended behavior

- While the cursor is inside the active code span, suppress or soften syntax diagnostics for incomplete expressions.
- Once the cursor leaves the code span, render the full diagnostic.
- Semantic errors that can already be identified without treating the expression as incomplete may still be shown, but should not interfere with editing.

This prevents ordinary typing from producing constant visual error noise.

### Empty aggregates

The proposal leaves empty-group behavior undecided.

#### Recommended behavior

Use mathematical identities where they are unambiguous:

```text
sum(empty)   = 0
count(empty) = 0
```

Return an error for functions without a useful empty identity:

```text
avg(empty) = error
min(empty) = error
max(empty) = error
```

### Recursive and self-referential aggregates

The proposal correctly requires recursive and self-referential calculations to fail rather than return partial results. This should remain.

A diagnostic should identify both the aggregate and the group involved when possible.

## Parser and context architecture

The current README notes that variable references are resolved by scanning earlier note content for each expression. Grouped calculations will need an accumulated top-down context anyway, so the context cache should be part of this implementation rather than a separate later optimization.

A render pass can maintain a structure conceptually similar to:

```ts
interface EvaluationContext {
  variables: Map<string, EvaluatedValue>;
  groups: Map<string, GroupMember[]>;
  errors: EvaluationError[];
}
```

A group member should retain more than the scalar value:

```ts
interface GroupMember {
  label: string;
  value: EvaluatedValue;
  groups: string[];
  sourceOffset: number;
}
```

The additional fields support diagnostics, later filtering, inspection, and source-aware behavior without changing the group model.

### Recommended evaluation sequence

Traverse explicit expressions in document order:

1. Identify an inline code span whose content begins with the configured marker.
2. Inspect the immediately preceding text for an optional declaration.
3. Parse the display label, group sigils, and declaration delimiter.
4. Evaluate the expression using the current top-down context.
5. If successful, update the latest variable value when the label is a valid variable identifier.
6. Append a separate member record to every attached group.
7. Evaluate aggregates against the group context accumulated so far.
8. Record visible errors without treating ordinary inline code as erroneous.

This preserves the proposal's preceding-content scope and avoids repeated rescanning of the note.

## Compatibility details to document explicitly

The proposal already confirms that inline render modes survive:

```markdown
`=33 meters to feet | result`
`=33 meters to feet | value`
`=33 meters to feet | unit`
```

The design document should also state whether these current behaviors remain:

```markdown
`=10 / 2 =`
`=33 ounces to gram`s
`=1 tsp of maple syrup to g`
```

These correspond to:

- The tolerated trailing arithmetic `=`.
- The tolerated plural `s` after an inline code span.
- Material-density conversion syntax.

They probably should remain unless the new parser makes one of them incompatible, but the behavior should be explicit.

## Labels containing literal colons

The proposal correctly identifies literal colons in labels as ambiguous.

#### Recommended initial rule

Reject literal colons in labels with a useful error. Add quoting or escaping only when a concrete use case requires it.

This keeps the first grammar smaller and makes chained group sigils predictable.

## Sigils and normalization

Supporting short text, full words, icons, and emoji is reasonable:

```markdown
Netflix:expense:subscription: `=20.00`
Netflix:💸:📺: `=20.00`
```

The proposal's normalization approach is also reasonable:

- Normalize Unicode before comparison.
- Compare alphabetic sigils case-insensitively.
- Preserve emoji sequences.
- Reject whitespace and structural delimiters.
- Apply a reasonable maximum length.

The precise Unicode normalization form and maximum length are implementation details and do not need to block the broader design.

## Aggregate syntax

The proposed aggregate syntax reads naturally with the sigil model:

```markdown
`=sum:ex`
`=count:ex`
`=avg:ex`
`=min:ex`
`=max:ex`
```

There is no strong reason to replace it with function-call syntax such as `sum(ex)`.

Internally, however, the parser should produce a dedicated aggregate AST node rather than implement aggregates through text substitution or string matching.

## Example vocabulary

Short sigils are efficient for personal notes:

```markdown
OG&E:ex:ob:bi: `=180.00`
```

They can also be opaque in documentation. The README should show both terse and descriptive forms:

```markdown
OG&E:ex:ob:bi: `=180.00`
OG&E:expense:obligation:utility: `=180.00`
```

This makes clear that the syntax does not require abbreviated accounting codes.

## Proposed implementation boundary for the first release

A practical first grouped-calculation release could include:

- Explicit `=` expressions.
- Colon-based declarations.
- Zero or more group sigils on a declaration.
- Top-to-bottom variable reassignment.
- Top-to-bottom group accumulation.
- `sum`, `count`, `avg`, `min`, and `max`.
- Positive OR filters such as `{ob,ls}`.
- Negative filters such as `{!gr}`.
- Repeated brace clauses for AND, if adopted.
- Visible errors outside the active editing state.
- Dimensionless grouped values only.
- A top-down context cache.

The following can wait:

- Quoted label lookup.
- Literal-colon escaping.
- Full Boolean filter expressions.
- Unit-aware aggregation.
- Forward references.
- Whole-document retroactive aggregation.
- Currency-aware arithmetic.
- Group inspection or debugging interfaces.

## Recommended decisions in compact form

1. Keep one explicit, configurable marker with `=` as the default.
2. Keep `:` declarations and chained group sigils.
3. Allow prose labels, but initially expose only identifier-safe labels as variables.
4. Restrict the first aggregate implementation to dimensionless values.
5. Avoid mixed positive and negative alternatives inside one brace block.
6. Consider repeated brace blocks as AND clauses.
7. Use `0` for empty `sum` and `count`; error for empty `avg`, `min`, and `max`.
8. Reject literal colons in labels initially.
9. Build the top-down context cache as part of this feature.
10. Preserve current render modes, plural handling, density conversions, and command-palette behavior unless implementation reveals a conflict.

## Final judgment

The proposal is a credible major-version design rather than a narrow accounting extension. Its strongest elements are the explicit ownership marker, top-to-bottom evaluation, duplicate-label semantics, and separation of ledger presentation from calculation syntax.

The main matters requiring a decision before implementation are:

- The relationship between display labels and variable identifiers.
- The treatment of unit-bearing grouped values.
- The exact logic of mixed aggregate filters.

Once those are settled, the remaining questions are mostly implementation and documentation details rather than structural problems.
