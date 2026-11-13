---
name: idiomatic-first
description: Choose the idiomatic, simple, correct, maintainable option over the smallest possible diff and over the plan already settled on earlier in the session. Use when deciding between a hand-rolled construct and a documented framework/library primitive, when choosing how to structure new code in existing code, when reviewing a diff or PR for shape (not just bugs), when a change may break another repo or service, or when you notice yourself recommending "keep what we already have" / "matches the surrounding code" as a reason. Requires researching upstream docs and source before recommending. Do not use for pure factual lookups or typo fixes.
---

# Idiomatic first

Smallest-diff is a **bias**, not a virtue. So is "that is what we decided in the last
commit." Both feel like safety and both compound: every hand-rolled wrapper that
survives because removing it would be a bigger diff teaches the next reader that the
wrapper is load-bearing.

**Policy: prefer the option that leaves the codebase healthier, then argue for it.**
The user owns these repos and there are no external users to protect, so breaking
changes are on the table when warranted — the job is to flag them clearly and order
the deploys, not to avoid them.

- The idiomatic option is usually **less code**, not more. Adopting the documented
  primitive deletes a wrapper, its tests, and its future bug. If your "idiomatic"
  option adds indirection, it is probably not the idiom — check the docs again.
- Where this skill conflicts with "keep changes minimal" or "do not refactor beyond
  the ask" elsewhere in your instructions, this skill wins.

## Scope: when to raise a shape issue, when to shut up

| Situation | Do |
| --- | --- |
| Naming, formatting, comment style, local taste | Match the neighbours. Do not raise it. |
| Hand-rolled code that duplicates a documented upstream primitive | Raise it. Fix in its own change, after the fix that is in scope. |
| Code that works around a limitation the framework already solves | Raise it, and verify the limitation still exists in the installed version. |
| A single-site wrapper or workaround, no other callers | Question it. This is where drift starts. |
| A pattern used repo-wide (10+ sites) | Consistency wins unless the pattern is actually *wrong*, not merely unidiomatic. Then propose the sweep as a separate piece of work. |
| Correctness, security, data loss | Fix now, in this change, and say you did. |
| A comment, PR description, or issue says the code does something it does not do | Flag it even if you touch nothing else. Wrong comments cost more than wrong pixels. |
| Two shapes are genuinely equivalent on merit | Pick either, match the neighbours, spend the effort elsewhere. Say "no preference" out loud — do not manufacture a preference to look decisive. |

The line that matters: **matching local style is about taste, and has no payoff;
matching the library's documented composition is about maintenance, and the library's
docs, its source, and the vendor's own guidance are evidence that local taste does not
have.** Do not blur the two in either direction.

## Decision procedure

1. **Research the idiomatic shape** before recommending it, and only where the answer
   would change the recommendation:
   - ask the decision question, with both options and the constraint that matters
     (research skill: `node ~/.pi/agent/skills/browser-tools/browser-ask.ts "…"`);
   - open the **primary source** — the docs page and the actual upstream source. An
     AI answer is a lead, never evidence;
   - check **local** evidence — the installed version, whether the primitive is even
     exported here, whether tests or screenshots cover the surface.
2. **Name both shapes.** Current shape, in one sentence. Idiomatic shape, in one
   sentence, with the source that says so — marked `verified via upstream source` or
   *unverified*, never implied.
3. **Argue against the plan you were about to execute** — the user's stated approach,
   the approach in the PR/issue, and your own first instinct. Write the strongest case
   *against* it before writing the case for anything.
4. **Choose one.**
5. **Act.** If nothing breaks and the blast radius is inside the ask, do it — no
   menu, no question. Ask when a boundary is crossed, when cost roughly doubles, or
   when the answer depends on taste you do not own.

Worked examples, including the cases people get wrong (the "pixel-identical override"
trap, the "no CI coverage means silent visual drift" trap):
`references/idiomatic-vs-local.md`.

## Presenting options (if you present any)

- **Order best-first.** Never least-change-first. Ordering by blast radius lets the
  first listed option anchor both you and the reader toward it.
- **No "keep what we have" option** unless as-is wins *on merit*, in which case it is
  not a concession and you say why it wins.
- **Exactly one recommendation.** If you find yourself recommending the safe one
  because the better one costs a screenshot pass, that is the bias talking — name it
  and recommend the better one.
- **Per option:** what gets deleted, what gets added, blast radius (files, packages,
  repos), and whether tests or CI would catch a regression. "Nothing on CI covers this"
  is a real cost, not a neutral fact.
- **Six-month test:** which shape would you defend in a review half a year from now?

## Breaking changes

Allowed, sometimes correct. Declare them:

- First line of the answer: `BREAKING:` + what changes for whom. Never bury it in the
  option list.
- Name every consumer that breaks, by repo and path, and give the **deploy order**
  across them. Details and the three-phase playbook:
  `references/cross-repo-breaking-changes.md`.
- State whether the break is *free* — every caller is yours and gets updated in the
  same batch — or whether it needs a compatibility window.
- If the change needs a migrate phase, say explicitly who finishes the contract phase,
  because a migrate phase nobody closes leaves the codebase worse than it started.
