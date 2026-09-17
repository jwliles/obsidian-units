# CPT — Obsidian-Native Design Document

## 1. Purpose

CPT is an Obsidian-native budgeting and financial visualization system built on the existing Quantities calculation engine.

Its purpose is not to replace the user's files with an application database or force a prescribed budgeting workflow.

Instead, CPT provides an abstraction layer over financial information already represented in:

- Markdown notes;
- Quantities declarations;
- projections;
- checking ledgers;
- CSV transaction exports;
- CPT's synchronized structured model.

CPT allows the user to visualize, analyze, simulate, reconcile, and optionally modify that information without giving up ordinary files as the primary human-readable working medium.

The central design principle is:

> The files remain meaningful without CPT. CPT makes the relationships between them easier to see and manipulate.

---

## 2. Relationship to Quantities

CPT evolves from the existing Obsidian Quantities plugin rather than operating as a separate CLI application.

Quantities already provides:

- exact-decimal arithmetic;
- variables;
- declaration histories;
- sigils and groups;
- global aggregation;
- local accumulation;
- positional regions;
- unit conversion;
- diagnostics;
- Markdown-aware rendering;
- file eligibility;
- path and glob inclusion rules;
- explicit file and folder decisions;
- frontmatter overrides.



These capabilities remain useful independently of budgeting.

CPT adds financial semantics and cross-file analysis above them.

Conceptually:

```text
Quantities
    evaluates calculations inside one note

CPT
    interprets and combines financial information across selected notes
```

Quantities' existing note-local evaluation semantics should remain unchanged.

---

## 3. Design Philosophy

CPT should not require the user to surrender direct control of the underlying files.

The user may:

- write projections manually;
- revise them as circumstances change;
- maintain checking files;
- add notes;
- reorganize directories;
- create alternate scenarios;
- edit calculations directly;
- exclude files from CPT;
- include files temporarily;
- allow CPT to make an explicit edit.

CPT provides another way to interact with those files, not a replacement for them.

The relationship is:

```text
                    direct editing
                         ↑
                         │
User files ←────────── CPT ─────────→ visual editing
                         │
                         ↓
                 analysis / simulation
```

---

## 4. Primary Financial Views

CPT should recognize three major stages in the user's budgeting process.

### 4.1 Projection

Projection answers:

> What is my current plan?

Projection files are working planning documents.

They are deliberately mutable.

The user may revise them when circumstances change.

For example:

```text
Original plan

CAC              $200
OG&E             $180
Reach            $138.62
Remaining        $126.60
```

An unexpected tire expense may require:

```text
Revised plan

Tire             $180
OG&E             $180
Reach            $138.62
CAC              $100
Remaining         $46.60
```

This is an appropriate projection edit because the plan itself changed.

Incidental transactions such as vending-machine purchases do not belong in the projection merely because they occurred.

### 4.2 Implementation

Implementation answers:

> What have I done to carry out the current plan?

Examples:

- money transferred into savings for CAC;
- a payment submitted;
- money reserved;
- an obligation scheduled;
- an allocation changed;
- a purchase made because of a planned decision.

This layer sits between planning and final bank posting.

### 4.3 Checking

Checking answers:

> What actually posted?

Checking is the factual ledger.

It includes all relevant posted activity whether or not the transaction appeared in a projection.

Examples:

- paycheck;
- vending-machine purchase;
- utility payment;
- savings transfer;
- subscription;
- unexpected purchase.

The intended flow is:

```text
Projection
    plan

    ↓

Implementation
    action

    ↓

Checking
    result
```

---

## 5. OODA Model

CPT's workflow naturally follows an OODA loop.

```text
Observe
    transactions
    balances
    checking
    changed circumstances

        ↓

Orient
    projections
    upcoming bills
    available slack
    CPT visualizations

        ↓

Decide
    revise the projection
    move an obligation
    change an allocation
    accept or reject a new expense

        ↓

Act
    transfer
    pay
    purchase
    schedule

        ↓

Observe again
```

The projection is therefore not a fixed forecast.

It is the current planning model and may evolve throughout the week or month.

---

## 6. User-Owned Files

Markdown remains a first-class part of CPT.

Examples include:

```text
September Projection.md
September Checking.md
September Allocations.md
October Projection.md
Budget Notes.md
```

CPT must not assume a particular directory hierarchy.

The user may organize the vault however they choose.

CPT should operate on logical file eligibility rather than prescribed paths.

---

## 7. File Eligibility

Quantities already supports an eligibility model consisting of:

- an All Files / No Files default;
- path and glob exceptions;
- explicit file and folder decisions;
- a final `quantities` frontmatter override.



CPT should build on this concept.

CPT may either extend the existing eligibility system or add a parallel financial-analysis eligibility layer.

For example:

```yaml
---
quantities: true
cpt: true
---
```

A file could therefore participate in Quantities, CPT, both, or neither.

The exact frontmatter syntax is not yet settled.

The important requirement is:

> CPT must determine which user files participate without requiring a particular directory layout.

---

## 8. Cross-File Abstraction

Quantities remains note-local.

CPT introduces a separate cross-file abstraction layer.

Conceptually:

```text
Markdown file A
    ↓
Quantities evaluation
    ↓
note model A
            \
Markdown B   \
    ↓         \
note model B   → CPT index → financial model
               /
Markdown C    /
    ↓        /
note model C
```

CPT should consume structured evaluator output where possible rather than reconstructing meaning from rendered text.

Quantities records already preserve important information including:

- labels;
- normalized labels;
- values;
- memberships;
- declaration identity;
- source position;
- provenance.



These records are a natural basis for CPT's cross-file model.

---

## 9. CPT Dashboard

The primary CPT interface should be an Obsidian view rather than a generated Markdown dashboard.

Possible information includes:

```text
Current Position
────────────────────────────

Checking balance       $667.55
Pending                -$42.18
Available               ...

Current projection
Sep 9–15

Planned
  CAC                   $204.90
  Reach                 $138.62
  ...

Implementation
  CAC allocation        complete
  Reach                 paid
  ...

Upcoming
  Sep 16 paycheck       $645.22
  ...
```

The dashboard is derived.

It does not need to exist as a file.

---

## 10. Source Visibility

CPT should make it easy to identify where displayed information came from.

For example:

```text
CAC
$404.90

Source:
September Projection.md
Line 37
```

A click may open the source note at the relevant declaration.

This aligns with the existing future Quantities provenance concept, which proposes explaining values from evaluator records rather than reconstructing them from rendered output.

---

## 11. Visualization

CPT's primary contribution is visualization.

Useful views may include:

- current-period cash flow;
- paycheck-by-paycheck projection;
- monthly projected balances;
- upcoming obligations;
- plan versus implementation;
- implementation versus posted results;
- cumulative discretionary spending;
- obligation status;
- scenario comparisons;
- recurring-expense summaries.

The underlying Markdown files remain readable even if none of these visual views are available.

---

## 12. Visual Editing

CPT may allow the user to manipulate the budget visually.

Examples:

- change an obligation amount;
- move a projected expense to another paycheck;
- add or remove an expense;
- modify an allocation;
- toggle a recurring item;
- alter a due date;
- create a scenario;
- accept a simulated change.

When CPT writes to Markdown, it should preserve the user's file as much as possible.

Prefer:

```text
surgical source modification
```

over:

```text
parse whole note → regenerate whole note
```

For example:

```markdown
CAC:ex = `=404.90`
```

may become:

```markdown
CAC:ex = `=425.00`
```

without changing unrelated formatting, prose, comments, headings, or calculations.

---

## 13. Simulation

Simulation is one of CPT's primary visual functions.

A scenario is a temporary alternate financial model.

For example:

```text
Baseline

CAC             $404.90
Spotify          $12.99
ChatGPT          $20.00
```

Scenario:

```text
+ Disney+        $15.99
- Spotify        $12.99
```

CPT can immediately show:

```text
12-month difference
lowest projected balance
affected pay periods
months with negative cash flow
ending balance difference
```

The source files remain unchanged.

---

## 14. Scenario Sources

Simulation should not require one particular mechanism.

A scenario may be created by:

- temporarily changing a value in the UI;
- disabling an obligation;
- adding a hypothetical obligation;
- substituting an alternate file;
- including a test file;
- excluding a normal file;
- loading an alternate structured model.

This makes file inclusion itself useful for experimentation.

For example:

```text
normal files
+ Disney Test.md
```

can produce one financial model, while excluding that file restores the baseline.

---

## 15. Committing a Simulation

Simulation changes exist in memory until explicitly committed.

If a user decides to adopt a change, CPT may offer an action such as:

```text
Add Disney+ to budget
```

The resulting edit may update:

- CPT structured state;
- a Markdown projection;
- an implementation file;
- another explicitly selected source.

The user must know when CPT is about to write persistent data.

---

## 16. CPT Structured State

CPT requires some information that cannot reasonably be inferred every time from Markdown.

Examples:

- account definitions;
- vendor identities;
- vendor matching rules;
- recurring obligation definitions;
- transaction classification rules;
- imported CSV column mappings;
- source inclusion settings;
- user corrections to inferred data;
- plugin UI preferences.

Because this information should synchronize between Obsidian installations, the current design uses the plugin's synchronized `data.json`.

This is an implementation choice, not a user-facing budgeting format.

---

## 17. `data.json`

`data.json` should contain persistent CPT state but not every derived object.

Conceptually:

```json
{
  "version": 1,

  "settings": {},

  "sources": {},

  "accounts": {},

  "vendors": {},

  "rules": [],

  "recurring": {},

  "importProfiles": {}
}
```

The exact schema remains to be designed.

---

## 18. What Belongs in `data.json`

Good candidates include:

```text
accounts
vendors
matching rules
recurring obligations
CSV import mappings
eligibility decisions
user corrections
CPT preferences
stable IDs
```

These are pieces of CPT's long-term understanding.

---

## 19. What Should Not Normally Be Stored in `data.json`

Avoid storing information that can easily be reconstructed.

Examples:

```text
complete copies of imported CSV history
copies of every parsed Markdown declaration
rendered dashboards
projection chart points
parsed Markdown ASTs
temporary simulations
cross-file indexes
calculated totals
cached reconciliation results
```

These belong in memory or rebuildable cache structures.

This keeps the synchronized file manageable.

---

## 20. Stable Identities

Important structured entities should have stable IDs independent of display names.

Example:

```json
{
  "recurring": {
    "cac": {
      "id": "cac",
      "name": "CAC",
      "amount": "404.90"
    }
  }
}
```

Changing the display name:

```text
CAC → Credit Acceptance
```

should not break references elsewhere.

---

## 21. Human Interaction with `data.json`

Direct editing of `data.json` is not intended to be the normal workflow.

CPT should provide a UI for maintaining structured information.

For example:

```text
Recurring Obligation

CAC

Amount          $404.90
Frequency       Monthly
Due             8th
Allocation      Yes

Transaction matches
  CREDITACCEPTANCE

[Edit] [Disable]
```

The JSON remains inspectable, but the interface is the preferred editor.

---

## 22. CSV Initialization

CPT should be able to bootstrap itself from a financial CSV export.

This corresponds to the earlier conceptual:

```text
cpt init
```

but becomes an Obsidian UI operation.

For example:

```text
CPT → Initialize from CSV
```

---

## 23. Initialization Check

Before initialization, CPT should inspect the CSV and determine whether it contains data that can reasonably be interpreted as financial transactions.

It is not tied to Capital One.

CPT should attempt to identify concepts such as:

```text
date
description
amount
transaction direction
balance
account
```

Not every field is necessarily required.

For example:

```csv
Date,Description,Amount
2026-09-10,QT,-20.00
2026-09-09,Payroll,645.22
```

is still meaningful financial data.

---

## 24. CSV Mapping

When CPT understands the CSV:

```text
Transaction Date       → date
Transaction Description→ description
Transaction Amount     → amount
Transaction Type       → debit/credit
Balance                → running balance
Account Number         → account
```

it should preserve that mapping as an import profile.

Future exports with the same structure can then be recognized automatically.

---

## 25. Initialization Process

The bootstrap workflow is:

```text
CSV
 ↓
schema detection
 ↓
transaction normalization
 ↓
vendor grouping
 ↓
recurrence analysis
 ↓
candidate classification
 ↓
initial CPT structured model
 ↓
user review
 ↓
normal CPT operation
```

CPT performs the tedious initial analysis.

The user refines the result.

---

## 26. Initialization Is Not Prediction

CPT does not need to infer every financial fact correctly.

The purpose is:

> Create a useful starting model from existing transaction history so the user does not have to manually sift through every CSV row.

For example, CPT may identify:

```text
T-Mobile
appears monthly
typical amount $125.32
```

The user may then add:

```text
due date: 8
allocated: yes
```

The initial model is editable and expected to require refinement.

---

## 27. Reconciliation

CPT should provide a reconciliation interface.

Conceptually this replaces:

```text
cpt recon
```

The user loads or selects a financial CSV.

CPT then:

```text
reads bank transactions
        ↓
normalizes them
        ↓
classifies them
        ↓
compares them with checking
        ↓
identifies discrepancies
```

Example result:

```text
September 2026

Bank transactions      48
Checking transactions  48
Unknown vendors         1

Bank balance         $667.55
Ledger balance       $667.55
Difference             $0.00

Reconciled
```

---

## 28. Reconciliation and Files

CPT does not have to automatically rewrite checking files during reconciliation.

Possible workflows include:

```text
analyze only
```

or:

```text
show proposed changes
```

or:

```text
apply selected changes
```

The user should remain in control of persistent Markdown edits.

---

## 29. Projection Generation

CPT may generate projection files.

This is useful for bootstrapping future months.

However, generation is not CPT's primary purpose.

Projection files become working user documents once created.

CPT should therefore distinguish:

```text
future generated projection
```

from:

```text
active user-edited projection
```

By default, regeneration should begin with the next month rather than overwriting the current planning document.

---

## 30. Projection Regeneration

A projection-generation interface may offer:

```text
Start month
Number of months
Overwrite existing files
Preview changes
```

The safe default is:

```text
start next month
do not overwrite
```

Current or historical projections require an explicit overwrite decision.

---

## 31. Current Projection

The current projection remains a living plan.

CPT should expect it to change during the month.

For example:

```text
planned bill arrangement
        ↓
unexpected tire
        ↓
user reorients
        ↓
projection changes
```

This is normal behavior.

CPT should not interpret a changed projection as corrupted generated output.

---

## 32. Status View

The earlier conceptual:

```text
cpt status
```

becomes a CPT dashboard or view.

Its purpose is:

> Where am I right now?

Possible information:

```text
current checking balance
pending transactions
current paycheck period
planned obligations
implementation status
remaining projected slack
upcoming due dates
unreconciled activity
unknown transactions
```

This is primarily a visualization.

---

## 33. Check Function

The earlier conceptual:

```text
cpt check
```

becomes an integrity-check action.

It may validate:

```text
CPT structured state
recognized source files
Quantities syntax
broken references
duplicate IDs
invalid recurrence definitions
missing account references
malformed transaction rules
projection parsing
checking parsing
```

The action should report problems without silently repairing user files.

---

## 34. Implementation Tracking

CPT may optionally recognize or provide an implementation layer.

This represents the actions taken to carry out a plan.

Examples:

```text
CAC
planned       $200
allocated     $200
paid            $0
```

or:

```text
OG&E
planned       $180
submitted     $180
posted        $180
```

This can be derived from a combination of:

- user files;
- explicit CPT state;
- checking transactions;
- allocation notes.

The exact representation is not yet settled.

---

## 35. Plan / Implementation / Result Comparison

One valuable CPT visualization is:

| Obligation | Plan | Implementation | Result |
|---|---:|---:|---:|
| CAC | $200.00 | $200.00 allocated | $0.00 posted |
| OG&E | $180.00 | $180.00 paid | $180.00 posted |
| Reach | $138.62 | $138.62 paid | $138.62 posted |

This makes the user's budgeting loop visible without requiring all three states to live in one document.

---

## 36. Incidental Spending

CPT must distinguish planning changes from mere transaction history.

For example:

```text
Nayax      $2.90
Breakfast $13.48
```

may appear in checking but do not automatically become projection entries.

However, their cumulative effect may change the user's financial orientation enough that the projection must be revised.

Thus:

```text
checking influences projection decisions
```

without:

```text
checking mechanically rewrites projection
```

---

## 37. Provenance

CPT should retain strong provenance for displayed values.

Examples:

```text
value
source note
source declaration
source position
membership
aggregation path
transaction source
inference source
```

The proposed Quantities trace feature already provides a model for explaining declaration and aggregate provenance.

This can later support:

```text
Why is this $584.90?
```

with an explanation such as:

```text
Current planned obligations

CAC              $253.75
OG&E              $83.30
Progressive      $143.50
Spotify           $12.99
Shell              $35.00
NYT Games           $5.99
```

---

## 38. Inferred vs. Explicit Information

CPT should distinguish between:

```text
observed
    directly supported by transaction or note data

inferred
    CPT's interpretation of patterns

user-set
    explicitly confirmed or corrected by the user
```

For example:

```text
T-Mobile appears every month
```

may initially be inferred.

After the user confirms:

```text
Frequency: monthly
Due: 8th
```

those values become explicit.

This distinction helps CPT avoid treating guesses as authoritative.

---

## 39. Editing Source Notes

When CPT modifies user-authored Markdown:

1. edits must be explicit;
2. source formatting should be preserved;
3. only the relevant declaration or block should change;
4. unrelated notes should not be reformatted;
5. comments and prose should remain intact;
6. CPT should show the proposed change where practical.

Source fidelity is more important than producing standardized Markdown.

---

## 40. Generated Files

CPT may create files where useful.

Examples:

```text
new projection
new checking ledger
new implementation note
scenario export
report
```

Generated files immediately become normal vault files.

Once the user begins editing them, CPT must treat them as user-owned documents rather than ephemeral generated artifacts.

---

## 41. Quantities Language Independence

CPT should not turn the Quantities calculation language into a budgeting-specific language.

These remain general:

```text
variables
groups
histories
aggregates
regions
unit conversion
filters
```

CPT interprets budgeting meaning at a higher layer.

For example:

```markdown
CAC:ex = `=404.90`
```

has ordinary Quantities semantics.

CPT may additionally know that:

```text
CAC
is a recurring obligation
due monthly
associated with a vendor
appears in projections
```

Those financial semantics belong to CPT rather than the core expression grammar.

---

## 42. Mobile and Portability

CPT must preserve the reason budgeting is done in Obsidian:

> The budget follows the user.

The user should be able to:

- inspect projections on mobile;
- modify Markdown directly;
- view CPT dashboards;
- inspect current status;
- adjust a plan;
- review obligations;
- run simulations where practical.

The system should not require a desktop-only external executable for normal operation.

---

## 43. Derived State

CPT should treat most analytical state as disposable.

Examples:

```text
parsed note models
cross-file index
chart data
projection comparison
current dashboard
scenario state
aggregate caches
```

If these are lost, CPT rebuilds them from:

```text
Markdown
+
data.json
+
user-provided CSV when needed
```

---

## 44. Core Data Flow

The central architecture is:

```text
                 User Markdown
                       │
                       ▼
             Quantities evaluator
                       │
                       ▼
               note-level records
                       │
                       │
data.json ─────────────┤
                       │
CSV import ────────────┤
                       │
                       ▼
                CPT financial model
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Dashboard     Simulation   Reconciliation
          │            │            │
          └────────────┼────────────┘
                       │
                optional edits
                       │
                       ▼
               User Markdown /
                 CPT state
```

---

## 45. Primary User Experience

A normal session should not require the user to remember scripts or execution order.

Instead, CPT exposes financial tasks directly:

```text
Dashboard
Initialize from CSV
Reconcile
Check
Project
Simulate
Review recurring items
Review vendors
Review sources
```

These may appear through:

- CPT's view;
- Obsidian command palette;
- context menus;
- ribbon actions where useful.

---

## 46. Initialization Experience

Example:

```text
Initialize CPT

Selected:
transactions.csv

Detected:
✓ Date
✓ Description
✓ Amount
✓ Debit/Credit
✓ Balance
✓ Account

1,318 transactions

Potential recurring items: 17
Potential vendors: 84
Accounts: 1

[Review] [Initialize]
```

After initialization, the user reviews CPT's inferred model.

---

## 47. Simulation Experience

Example:

```text
Simulation

Baseline ending balance    $3,421.18

Changes
+ Disney+                    $15.99/month
- Spotify                    $12.99/month

Scenario ending balance    $3,385.18
Difference                   -$36.00

Lowest projected balance
Baseline                     $187.42
Scenario                     $174.43

[Discard] [Save Scenario] [Apply]
```

No file changes occur until the user explicitly applies something.

---

## 48. Source Selection Experience

CPT should make participating sources visible.

For example:

```text
Included Sources

✓ September Projection.md
✓ October Projection.md
✓ November Projection.md
✓ Monthly Charges.md
✓ September Checking.md
✗ Disney Test.md
```

Changing inclusion immediately changes CPT's analytical model.

This makes alternate files useful without modifying them.

---

## 49. Non-Goals

CPT is not intended to:

- replace Markdown with an opaque database;
- prescribe a vault directory structure;
- force every budget into the same document layout;
- automatically rewrite projections from checking activity;
- require an external CLI;
- require the user to manually classify every historical CSV row;
- hide the source of calculated values;
- make financial decisions automatically;
- turn Quantities into a budgeting-only expression language.

---

## 50. Initial Development Priorities

### Phase 1 — Preserve Quantities

Keep current Quantities behavior stable:

```text
evaluation
rendering
eligibility
declarations
groups
regions
precision
diagnostics
```

### Phase 2 — Cross-file index

Add a CPT layer capable of:

```text
finding eligible financial notes
evaluating them
collecting records
tracking source provenance
building a cross-file model
```

### Phase 3 — Basic dashboard

Display:

```text
included sources
current balances
income
expenses
projection periods
basic summaries
```

### Phase 4 — Structured CPT model

Extend `data.json` with versioned CPT data for:

```text
accounts
vendors
rules
recurring obligations
import profiles
```

### Phase 5 — CSV initialization

Add:

```text
CSV schema detection
normalization
vendor discovery
recurrence analysis
initial model generation
review UI
```

### Phase 6 — Reconciliation

Compare imported transaction data with checking documents and expose differences visually.

### Phase 7 — Simulation

Allow temporary changes to the cross-file financial model.

### Phase 8 — Visual editing

Allow selected visual operations to perform controlled edits to Markdown and CPT structured state.

### Phase 9 — Projection generation

Generate future projection files while protecting active user-edited projections by default.

---

## 51. Core Design Rules

1. Markdown remains meaningful without CPT.
2. Quantities remains a general-purpose calculation engine.
3. CPT adds cross-file financial understanding.
4. User-written files are authoritative within their domain.
5. CPT may analyze files without modifying them.
6. Persistent modifications require explicit user action.
7. Simulations are non-destructive by default.
8. Current projections are living planning documents.
9. Checking represents actual posted results.
10. Incidental transactions do not automatically become projection entries.
11. CPT does not prescribe directory organization.
12. The system should work across Obsidian installations.
13. Structured CPT state should synchronize through the existing plugin mechanism.
14. Derived analytical state should be rebuildable.
15. Provenance should be retained wherever practical.
16. The user should never need to remember a chain of helper scripts.

---

## 52. Summary

CPT is best understood as:

> A cross-file financial visualization and manipulation layer built into Obsidian and backed by the existing Quantities calculation engine.

Its inputs are:

```text
user-authored Markdown
Quantities declarations
CPT structured state
financial CSV data
source eligibility decisions
```

Its outputs are primarily:

```text
understanding
visualization
projection
simulation
reconciliation
decision support
```

File generation and editing are supported capabilities, but they are not the center of the design.

The intended relationship is:

```text
Files
  remain portable,
  readable,
  editable,
  and useful.

Quantities
  evaluates their calculations.

CPT
  lets the user see the larger financial system those files represent.
```