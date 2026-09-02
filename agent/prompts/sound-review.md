---
description: Sound code review — correctness, accidental complexity, UX/DX, risks; research-backed
argument-hint: "[scope: diff range, file(s), or PR]"
---

# Sound Code Review

Review the given scope. Default scope: uncommitted changes (`git diff HEAD` plus untracked files). If the argument is a PR or URL, fetch it — use the browser skill when auth or rendering is required.

## Ground rules

- **Read-only.** Produce findings; do not edit code unless explicitly asked to fix.
- **Understand intent first.** Read surrounding code, recent history (`git log --oneline -n 10 -- <touched files>`), and tests before judging. A finding that ignores intent is not a finding.
- **Verify before claiming.** Never assert "this is a bug" without evidence: run it, reproduce it, or check the library's source/docs. Label anything unverified as a *hypothesis*.
- **No padding.** If the diff is sound, say so plainly. A short, true review beats a long, hedged one.

## Review pillars (in order)

### 1. Correctness (soundness)

- Logic errors, off-by-ones, unhandled null/undefined, missing edge cases
- Error handling: swallowed errors, missing propagation, misleading messages
- Concurrency/async: races, unawaited promises, stale state, missing cleanup
- Security: injection, authz gaps, secrets in code/logs, unsafe deserialization
- Tests: do they cover the new behavior? Are they testing behavior or implementation?

### 2. Accidental complexity

For each construct ask: *is this complexity forced by the problem domain (essential), or created by the solution (accidental)?*

- Abstractions with a single caller; indirection that buys nothing
- Defensive code for impossible states; handling errors that cannot occur
- Special-cases that a slightly different data model would eliminate
- Code that is hard to follow because of *how it is written*, not *what it expresses*

For each hit: name the smell, say why it is accidental, and propose the simpler option (ideally so small you can describe the code that gets deleted).

### 3. UX / DX

- **DX**: could a newcomer understand this without the author? Are names, structure, and error messages informative? Does the code force unnecessary mental load — implicit invariants, hidden ordering, magic values, surprising side effects?
- **UX** (when user-facing): does the change make the task easier, faster, or more predictable? Does it add friction, surprise, or state the user must now manage?
- Flag friction even when "it works" — friction is a defect, not a nit.

### 4. Risks

List the risks the diff introduces, each rated:

| Risk | Likelihood | Impact | Mitigation / what to watch |

Focus on: performance at scale, breaking changes, dependency/upgrade risk, data migration, operability (observability, rollback), expanded security surface. Include risks that the change *removes* if notable.

## Research protocol

- **Unfamiliar API / library / version behavior** → use the `research` skill (browser + Google AI Overview) *before* stating the fact. Phrase queries as questions.
- **Genuinely torn between options** (e.g., "A or B for X?") → ask **Google AI mode** (`google.com/aimode`) directly. Phrase it as a decision question that includes: the options, the tradeoffs you've weighed, and the constraints. Take its opinion as one input — weigh it against codebase conventions, and verify any factual claim it makes before relying on it.
- **Provenance matters.** Tag each research-influenced finding: `verified via research` vs `assumption`.
- **Don't over-research.** Only dig in when the answer would change a recommendation.

## Output format

1. **Verdict** — Approve / Approve with nits / Request changes, with a one-line justification.
2. **Correctness** — findings as `path:line`, severity, what is wrong, evidence.
3. **Complexity** — table: `Location | Smell | Why accidental | Simpler option`
4. **UX/DX** — findings with severity; separate real friction from polish.
5. **Risks** — the table from pillar 4.
6. **Research notes** — what you asked, what came back, which recommendation it changed (omit if none).

Severity rubric:
- **blocker** — ships a bug, data loss, or security exposure
- **major** — real complexity or UX/DX cost worth fixing before merge
- **minor / nit** — polish; list at most a handful
