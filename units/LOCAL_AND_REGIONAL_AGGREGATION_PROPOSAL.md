# LOCAL_AND_REGIONAL_AGGREGATION_PROPOSAL

## Status

Proposal. Supersedes the earlier `REGIONAL_AGGREGATION_PROPOSAL.md` draft.
Not implemented, not yet in SEMANTICS.md. Consolidates the local-scope
symbol rename and the full regional aggregation design as currently agreed.
Both changes are pure additions to or renames of syntax; neither alters
existing global-group semantics.

## Membership and scope, three forms

Aggregation varies along two independent axes: how a declaration becomes a
member (tag or position), and whether the aggregate that reads a group
accumulates forever or is bounded.

| Form | Spelling | Membership | Closes on read? |
|---|---|---|---|
| Global | `sum:ex` | explicit sigil | never — accumulates for the whole document |
| Local | `sum@ex` | explicit sigil | yes — reading closes the accumulation |
| Regional | `sum:>` | position | no — see below |

## Part 1 — Local scope: `::` renamed to `@`

### Rationale

`sum::ex` differs from `sum:ex` by one repeated, low-contrast glyph. Reading
it correctly requires counting punctuation, which is easy to misjudge at a
glance. `@` replaces the second colon with a visually distinct character
carrying its own mnemonic — "point at the current instance of."

```markdown
Global Total = `=sum:ex`
Local Total = `=sum@ex`
```

This is a pure rename. Nothing about local scope's semantics changes:

- A qualified declaration still joins both its global group and the current
  local accumulation for the same sigil, unchanged.
- `sum@ex` still reads the active local accumulation and closes it as a side
  effect of evaluating successfully.
- The next matching declaration still opens a fresh accumulation.
- A failed local aggregate still does not close anything.
- Closure is still selective — `sum@ex` closes only `ex`, not every
  active group.

### Migration

`::` is live across SEMANTICS.md, MANUAL.md, README.md, DESIGN_RECORD.md,
all existing fixtures, and real notes. This is exactly the case the
sequential migration-chain approach was built for: a token rename with zero
semantic change, applied once, in order, alongside whatever else has
changed by the time it ships.

### Open question

`@` has not been checked against community-plugin conventions the way the
default expression marker was checked against Dataview. Core Obsidian and
Markdown itself do not claim the glyph; some community plugins may. Worth a
deliberate pass before treating this as final, on the same precedent already
set for the marker itself.

## Part 2 — Regional aggregation

### Motivation

Global and local both require explicit tag membership. Real files —
quarters sharing no sigil, ledger sections whose entries carry distinct
vendor labels — repeatedly need "everything physically between these two
points," regardless of tag. No existing mechanism expresses this; every
attempt to approximate it today falls back to tagging every member by hand
with an otherwise-unneeded sigil.

### Syntax

```markdown
`=:>`              opens a region, or closes the current one and opens a new one
...declarations...
`=sum:>`           reads the current region; does not close it
...more declarations...
`=sum:>`           reads again, including anything added since the last read
`=:<`              closes the current region explicitly, with no reopening
```

`count`, `avg`, `min`, and `max` are expected to carry over identically:
`count:>`, `avg:>`, `min:>`, `max:>`. Regional scope does not introduce a
separate family of arithmetic behavior.

### Why regional does not close on read

Local scope's positional membership already has a filter: an untagged
declaration was never a member, so an "open" local window can't accumulate
anything unintended while waiting for a read to close it. Regional
membership has no such filter — position alone is membership, so every
otherwise-eligible declaration between an open and a close is a candidate,
whether or not it has any logical relationship to the block that opened the
region. Because regional has no safety net equivalent to local's tag
requirement, its boundary cannot be safely deferred to "whenever someone
happens to read it" the way local's can. An explicit close lets the author
end positional membership at the exact point the logical boundary is known,
independent of whether any calculation happens there.

This also gives regional a genuine capability neither other form has: the
same still-open region can be read any number of times, returning a growing
total as more declarations accumulate, without ever being reset. Global
grows monotonically over the whole document; local resets completely on
every read; regional can be checked mid-accumulation and continue growing
afterward.

### The two authoring hazards

Regional membership being positional rather than tagged means boundary
mistakes are possible in two independent ways, with different signatures:

- **Forgotten close** — a region is opened and no `:>` or `:<` follows it
  anywhere in the document. Later, unrelated declarations continue to be
  swept in indefinitely.
- **Forgotten new opener** — a region is properly closed, but the next
  logical block begins without a new `:>`. Two logically distinct blocks
  remain merged into whatever the current (closed or absent) region state
  actually is.

These are not the same mistake and do not share a detection story.

**Forgotten close is catchable, and should be checked.** Because evaluation
already proceeds top-down through the entire document in one pass, the
evaluator reaches end-of-file regardless. At that point, "is a region still
open with no matching close" is answerable using only information already
gathered during the pass already being performed — no lookahead, no second
pass, no change to the no-forward-references invariant. This is the same
class of check as flagging an unclosed parenthesis: not predictive, just
noticing an unbalanced token at the one point where nothing is left ahead of
it. Where this diagnostic surfaces is an open implementation question — no
expression naturally sits at end-of-file to attach it to, so it may need a
synthetic end-of-document anchor or a separate summary surface rather than
the usual inline rendering.

**Forgotten new opener is not catchable, by design or by any amount of
lookahead**, and this is treated as an accepted, permanent limitation rather
than a gap awaiting future work. In this case the source is fully
well-formed — every `:>` and `:<` correctly paired, nothing unbalanced. What
is wrong is a mismatch between the boundaries as written and the boundaries
the author intended, and that intent was never encoded in the text at all.
No analysis recovers information that was never represented. Preventing
this would require the author's own discipline in placing boundaries
correctly — a claim being made explicitly here rather than left implicit:
the grammar catches malformed structure, not misplaced intent, and this is
the accepted boundary of what punctuation can be expected to enforce.

### Aggregate-derived declarations inside a region

A `Subtotal = `=sum:ex`` line written inside an open region is a candidate
for regional membership under a purely positional reading, and would
double-count against a later `sum:>` over the same region if included by
default.

**Proposed default: aggregate-derived declarations are excluded from
regional membership**, consistent with the bias already established
everywhere else in this design — narrow by default, explicit to widen
(sigils require opt-in, self-reference defaults to a hard error, empty
selections error rather than guess). Because regional aggregates do not
close on read, a running subtotal and a later grand total are very likely to
sit inside the same still-open region under ordinary ledger authoring
habits; excluding aggregate-derived values by default keeps that common
pattern safe without requiring the author to remember an exclusion.

**Open**: the exact mechanism for opting an aggregate-derived declaration
back into regional membership, if ever needed. Should be its own modifier at
the aggregate call site, not a new term inside the existing `{}` filter
grammar — filters currently express boolean logic over sigil membership
only; "was this record produced by an aggregate" is a question about a
record's provenance, not its tags, and folding it into brace syntax risks
colliding with an ordinary sigil that happens to be named the same as the
modifier.

### Empty regional selections

No new rule needed — this follows the existing empty-aggregate invariant
once the aggregated/raw question above is settled: `sum:>` and `count:>`
return zero on an empty selection; `avg:>`, `min:>`, and `max:>` error.

### Deferred, not yet decided

- Whether `sum:>{tag}` (filtering a regional read by sigil membership, as
  distinct from the raw/aggregated question above) is worth adding, or
  whether that composition should wait for a concrete need.
- Whether `sum:>` with no region ever opened should error the same way an
  unknown global or local group does. Current lean: yes, for consistency
  with every other "nothing to aggregate" case in the design.
- Where the unclosed-region diagnostic renders, per above.

### Testing

Per the project's established discipline, this needs its own fixture
coverage before implementation: open/read/read-again showing a region grows
across repeated non-closing reads; the two named hazards demonstrated
directly, including confirming forgotten-close is flagged at EOF and
forgotten-new-opener is confirmed to produce a valid-but-wrong merge with no
diagnostic; `:<` closing with no reopener, followed by ordinary declarations
that must not join anything; and the aggregate-derived exclusion default,
once its opt-in mechanism is decided.
