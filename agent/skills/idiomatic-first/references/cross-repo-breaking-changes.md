# Breaking changes across repos: how to present them

Read this when a change crosses a repo, package, service, schema, or wire-format
boundary — i.e. whenever "deploy this first" is a real instruction.

## Step 1 — classify the break

| Kind | Meaning | What you owe |
| --- | --- | --- |
| **Free** | Every caller is yours, in repos you deploy together, and gets updated in the same batch | One line: `BREAKING:` + which repos, and the deploy order. No compatibility shims. Ship it. |
| **Windowed** | Something is live, or deployed independently, or read by something you cannot redeploy atomically | Expand → migrate → contract, with a named owner for the contract phase |
| **Unknown** | You do not know who consumes it | Say that. Do not guess "nothing else uses it"; grep for it, and if you cannot grep it all, say the scope is unverified |

Never add a backwards-compatibility shim "just in case" when the break is free. Never
call a windowed break "free" because it saves a step.

## Step 2 — the three phases (only for a windowed break)

1. **Expand.** The producer ships the new form *and* keeps serving/accepting the old
   one. Nothing else changes yet. This is deployable on its own.
2. **Migrate.** Consumers move to the new form, one repo at a time, in any order,
   because both forms still work. A client-side flag can pin a consumer to the old form
   so its deploy is decoupled from the producer's.
3. **Contract.** The old form is deleted. Requires evidence that no caller is left —
   grep, traffic/metrics, or the fact that you own every caller.

Write the contract phase down as real work with an owner. **A migrate phase that never
closes leaves the codebase worse than it started**: two ways to do the same thing, and
readers cannot tell which is current. If you cannot name who deletes the old path, the
design is incomplete — say so rather than shipping the ambiguity.

## Step 3 — deploy order

State the order as a numbered list, one step per deployable unit, each with the
verification that proves it is safe before the next step. Defaults that are usually
right — check them, do not paste them:

1. **Schema before code.** Add columns/tables first, nullable or defaulted; backfill;
   then code reads them; drop the old column only in the contract phase.
2. **Producer before consumer**, when the producer must accept/emit the new shape and
   can do so compatibly (that is what "expand" buys).
3. **Consumer before producer** when the consumer must *tolerate* the new shape first
   — widen the reader, then narrow the writer. Anything that only reads tolerates
   extra fields; anything that validates strictly does not (Postel-ish: accept wide,
   emit narrow, and do both in separate deploys).
4. **Shared library / generated client published before the apps** that import it, with
   the version bump recorded in the app change, not implied.
5. **Config, flag, or route wiring before the code that needs it**, defaulted off; flip
   last, so the flip is the only thing to roll back.
6. **Never require two deploys to land atomically** unless there is a mechanism that
   actually makes that true. If you find yourself writing "deploy these together,
   quickly", that is a design defect: go back and widen the window, or add the
   compatibility phase. Say the word *atomic* out loud so it gets challenged.

Each step needs a rollback story. "Revert the previous deploy" is only a story when the
previous deploy is still compatible with the current one — which is exactly what the
expand phase is for.

## Step 4 — how to write it up

Put this before the option list, not after it:

```
BREAKING: <what changes, and for whom — one line>
Repos: <producer> → <consumer A> / <consumer B>   (order matters / order does not)
Free or windowed: <which, and why>
Deploy order:
  1. <repo> — <what>. Verify: <how you know it is safe before step 2>. Rollback: <how>
  2. ...
Contract phase: <who removes the old path, and what evidence they need first> — or
  "none: no consumer is left after step N, verified by <method>"
Unverified: <what you could not check>
```

If the answer is "this is free, all four call sites are ours, updated in the same
change", say that in one line and skip the template. The point is that nobody has to
read a paragraph to discover that a deploy ordering constraint exists.

## Things that count as breaking even though nothing failed in dev

- A new required field, env var, or header on a service that others call
- A response shape change; stricter validation; a status-code change
- Renamed or removed shared-package export, changed default, changed peer-dep range
- A cache key, queue message, or serialized event format change (old readers exist)
- A DB constraint tightening, an index change that changes plan choice, a column rename
- A visual/layout change with no screenshot coverage — silent on CI is not safe
- A test-harness or fixture format change other repos pin against
