---
name: root-cause-first
description: Standing authorization plus a procedure for investigating failing checks — lint, tsc/type-check, unit or e2e tests, build, a command that errored, or CI. Use the moment any check goes red, especially a failure the current change introduced. Use it before you call a failure "flaky", "pre-existing", "environmental", or "unrelated to my change"; before proposing to skip, suppress, disable, retry-to-green, or widen a timeout; and before asking the human for permission to investigate. Ends with root cause + a fix plan, never a question about whether digging is allowed. Do not use for design-shape decisions (see idiomatic-first) or plain factual lookups (see research).
---

# Root cause first

**You already have authorization to dig.** Do not pause to ask whether you may
investigate a red check — the answer is always yes.

Two permissions get conflated. Keep them apart:

| | Granted? | What it covers |
| --- | --- | --- |
| **Finding out** | Yes, unconditionally, for the whole session | Reproduce, re-run, restart services, spike a throwaway experiment, read dependency source, bisect, temporarily instrument code |
| **Shipping** | No — needs the plan accepted | The durable fix: the change that stays in the tree |

So: investigate freely, then come back with **cause + plan**. That is the deliverable —
not "seems unrelated", and not a menu of whether-to-investigate options.

## Pre-approved without asking

- **Re-run the check** as many times as you want — alone, in parallel, with
  `--fail-fast` off, one file at a time, and with the full suite.
- **Restart things.** Dev server, database, containers, `docker compose down -v`,
  the browser, the whole stack. Say what caches or local data you dropped.
- **Get a baseline** with `git stash push -u`, a throwaway `git worktree add` at HEAD,
  or a detached `git checkout <base>`. Always restore, and verify the restore with
  `git status --porcelain` compared before and after.
- **Instrument temporarily**: logging, verbose reporters, `DEBUG=`, trace flags,
  `--record` for a browser run, a scratch script whose only job is to prove a
  hypothesis wrong.
- **Read anything**: the installed source under `node_modules`, the upstream repo,
  CI logs, the config that produces the check.
- **One retry** of a genuinely non-deterministic failure — to classify it, never to
  clear it.

One limit on all of the above: none of it may survive into the final diff. Delete
scratch files and instrumentation, or name what you left in the report.

## Banned, with the reason

| Banned move | Why |
| --- | --- |
| `@ts-ignore`, blanket `@ts-expect-error`, `eslint-disable`, `# noqa`, prettier-ignore to make red go green | You silenced the sensor. The error was evidence about real code. |
| Delete or weaken the failing assertion; `.skip`, `xit`, `.only`, or a `todo` left in the file | A test that cannot fail is not a test. Green is now meaningless. |
| Raise the timeout, add a `sleep`, retry the test until it passes | Timing hides the race; it does not resolve it. If you must widen something to unblock, file it as a known-failing test in the same change. |
| "It's flaky" | Not a diagnosis. The finding is: *intermittent — failed 3 of 7 runs, under `-p 4`, no repro yet, next probe is X.* |
| "Pre-existing" / "unrelated to my change" / "environment issue" | Unproven until you ran the check on a clean tree or another env. A pre-existing failure your change merely *unmasked* is still your failure to report. |
| Pin, downgrade, or `--force` a dependency until the error disappears | That is suppression with extra steps, and it costs a future outage. |
| "Couldn't reproduce, nothing more I can do" | Premature stop. See the timebox below. |

## Procedure

### 1. Reproduce and classify

Get the exact command and the exact error text — verbatim, not paraphrased. Then:

- **Deterministic** → proceed.
- **Intermittent** → count it. `N/M runs`, and record what varies (parallelism, seed,
  clock, order, network, leftover state).
- **Environment-only** → name both environments, local and CI, versions included.

Do not call anything flaky on the basis of one pass.

### 2. Establish the baseline

*Was this green before the change?* Three honest answers: **yes** (you broke it),
**no** (it was already broken — now find out why nobody noticed), **cannot tell**
(say so, and say what it would take to tell).

Non-destructive baseline probe:

```bash
git worktree add --detach /tmp/base-probe HEAD          # or: git stash push -u
cd /tmp/base-probe && <the failing check>                # needs deps present; if not, say so
```

Also read the history of the thing that fails: `git log --oneline -8 -- <files>`, and
`git bisect` when the answer is "no" and the failure is worth tracing.

### 3. Localize

Shrink until the failure stops: one file, one test, one function, then a
`/tmp` repro. Break the chain at a boundary — hard-code the input, stub the
collaborator, or invert the condition — and see whether red follows.

Unfamiliar error text, or a library-behaviour hypothesis you cannot settle by reading
the local source → **research skill** (`~/.pi/agent/skills/research/SKILL.md`). Quote
the error verbatim in the query, then verify the answer against installed source.

### 4. Name the mechanism, then try to kill it

Write one sentence in this shape:

> It fails because `<mechanism>`. If that is true, then `<something else>` must also
> be true — and `<this experiment>` should show it.

Run the experiment. This is the step that separates a cause from a well-worded
guess. If you cannot state a prediction, you have a correlation; keep digging or
label it *hypothesis* out loud. A cause that merely restates the symptom
("it fails because the value is undefined") is not a cause — say *why* it is undefined.

### 5. Say where the defect actually lives, then plan

Four possible homes. Picking the wrong one produces a green build with the defect
intact, so choose deliberately:

| Home | How you recognise it | Fix family |
| --- | --- | --- |
| **Product code** | The check caught a real bug | Fix the code; the failing check is now your regression test |
| **Test / fixture** | Correct code, wrong expectation: stale assert, hidden order dependency, shared state, real clock or network in a unit test | Fix the test **and name which of those it was** |
| **Harness / environment** | Green in one env, red in another; the difference is version, cwd, locale, port, seed, or leftover data | Fix the harness or config, then re-run in *both* envs |
| **The check itself** | A lint rule or type config that is wrong, misapplied, or mis-scoped | Fix the rule/config with a written justification — never a per-file suppression |

Then the plan: options best-first, one recommendation, and for each the blast radius,
what gets deleted, and whether CI would catch a recurrence. If a check exists nowhere
in CI, that is a cost you report, not a neutral fact.

## Output format (this replaces "Done.")

```
Failed:     <command> — <error verbatim> — first seen <commit / earlier>
Baseline:   green before my change? yes|no|unknown — checked by <method>
Evidence:   <runs and counts, output, source or docs read, what you ruled out>
Root cause: <one-sentence mechanism>  [verified | hypothesis, confidence]
Home:       product | test | harness | check
Plan:       1. <recommended> — cost, blast radius, what it deletes
            2. <alternative> — why it is worse
Reverted:   <scratch changes removed>, or "<server left on :3000>", or "worktree /tmp/base-probe still mounted"
Done looks like: <exact commands that must pass> + <the guard that would catch this again>
```

`Reverted` is not optional. If you restarted, stashed, or instrumented anything, the
reader needs to know what state the workspace is in right now.

## Timebox: when you cannot crack it

After roughly three dead ends, stop looping. Do **not** trade the truth for a green
build. Instead:

1. State the best hypothesis with a confidence level, and what evidence would confirm it.
2. List what you eliminated — that is real progress and it tells the next reader where
   not to look.
3. Name the next probe, and what it would cost.
4. Leave the failure **loud**: the test keeps failing, or it is quarantined in a way
   that still turns CI red, or it ships with a comment naming the open question.

## Dig even when it looks fine

- Passed on the second run → classify it, do not celebrate.
- A suite or lint pass that got slower → evidence. Timeouts are how races announce themselves.
- Green with no coverage on the path you changed → say so. Uncovered is not verified.
- CI red, local green → that is a harness finding, not "CI being flaky".

`references/worked-examples.md` has five full cases, including the two people get
wrong most: the "pre-existing" failure that the change actually unmasked, and the
test-side fix that was correct.
