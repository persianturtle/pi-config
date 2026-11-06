# Worked autopsy cases

Read the matching case when you have a failure of that shape. Each one shows the
path that feels obvious, why it is wrong, and what the actual digging looks like.

---

## 1. The "flaky" e2e test that was a real race

**Symptom.** `checkout.spec.ts` fails ~1 in 6 CI runs with `expect(received).toBe("paid")`.
Passes locally, every time. Past commits contain two "fix flaky checkout test" messages.

**Obvious path.** Add `await waitForTimeout(2000)` before the assert, or retry the
test twice. Push. Green.

**What the procedure forces instead.**

1. *Classify.* Run locally with parallelism on: fails 3/7 with
   `vitest run --no-file-parallelism` off, 0/7 with it on. That single fact kills
   "flaky" — it is order-dependent, not timing-dependent.
2. *Localize.* Run `checkout.spec.ts` alone → green. Run it after
   `cart.spec.ts` → red. Diff the two files: both use the same seeded Stripe mock
   keyed by a module-level `const lastCharge`, reset in `beforeEach` of one file only.
3. *Mechanism.* `chargeId` is module state shared across suites, so the second suite
   reads the first suite's charge, whose status is still `pending`. Prediction: any
   suite pair sharing the mock fails in that order, in any combination.
   Verified by running `cart → checkout`, `checkout → cart`, and a synthetic
   third suite against the same mock: red, green, red. Matches.
4. *Home.* **Test / fixture** — hidden shared state. Product code was correct: in
   production each request gets its own charge record, which is exactly why nobody
   saw it.
5. *Plan.* (a) Make the mock per-test — factory function, no module state; this
   deletes the `beforeEach` reset that had to be remembered in each file. (b) Keep the
   retry, which leaves the race and costs 2s × N. Recommend (a): less code, and the
   race becomes structurally impossible instead of "usually fast enough".

**Report says:** intermittent 3/7, reproduces only with parallelism, root cause is
module-level mock state, home is the test, and — the part worth writing down —
*"the two previous 'fix flaky' commits added waits; the race has been there since the
mock was introduced."*

**Why the obvious path is banned.** The waits made the failure rarer, which removed
the only signal that the shared mock was unsafe. Three more suites later it fails in
production-adjacent code paths with no test left that could have caught it.

---

## 2. "Pre-existing" that my change unmasked

**Symptom.** After adding a new route, the full `tsc --noEmit` run reports an error
in a file the change never touched.

**Obvious path.** "That error is pre-existing and unrelated; my files are clean."
Mostly true, and still wrong.

**What the procedure forces instead.**

1. *Baseline.* Run `tsc --noEmit` on a clean worktree at HEAD → also errors, but only
   in the new run, and only because the whole suite previously aborted earlier. Check
   how the check is actually invoked: `npm run typecheck` is
   `tsc -p tsconfig.app.json`, which excludes that file. CI runs `tsc -b`, which
   includes it.
2. *Now the real finding.* The file was never checked by anything anyone ran. The
   local script and CI disagree about scope. The error is old and, until this change,
   unreachable by any command in the repo.
3. *Home.* **Harness / environment** — a check scope mismatch, plus a latent
   product bug in the unscanned file.
4. *Plan.* (a) Fix the unscanned file, and align `package.json` with CI so both check
   the same set — now every future error in that directory is visible. (b) Add
   `--skipLibCheck`/exclude to make the current error go away: silences one error and
   keeps an entire directory unchecked. (c) Leave it and note it: the next person to
   touch it is surprised, and nobody owns the unchecked set.

**Report says:** the error is pre-existing (proven, on a clean tree) *and* it is a
finding — the file was unchecked, which is why it survived; here is the plan to make
it checked.

**Rule to keep.** "Pre-existing" is a fact you must prove, and proving it often
uncovers a second defect: how it stayed hidden. Report both.

---

## 3. The lint error that was a real bug

**Symptom.** `biome` fails on `noFloatingPromises` in a route handler.

**Obvious path.** `// biome-ignore` with "handled elsewhere", or disable the rule —
"the code works in testing".

**What the procedure forces instead.**

1. *Reproduce.* Not reproducible by reading; write one test that POSTs to the route
   with the audit-write slow (stub a 200ms delay). Response returns in 5ms.
   Kill the process 10ms after the response and the audit row is missing: 4/5 runs.
2. *Mechanism.* The audit write is fire-and-forget, so the response ends the request
   scope; on a warm worker the promise usually wins the race, on a cold one it does
   not. Prediction: awaiting it makes the missing rows impossible, and the "it works
   in testing" case is just a warm worker. Verified both ways.
3. *Home.* **Product code.** The lint rule was right and had been right since it was
   written — the suppression would have deleted the only thing standing between an
   audit log with holes and the truth.
4. *Plan.* (a) `await` it — the rule then passes with no suppression, and the
   slow-write test becomes the permanent guard. (b) Suppress + comment: keeps the
   defect and now it is commented-over, so the next reader trusts it.

**Report says:** rule correct, bug real, `verified via repro`, home is product code,
and the new test covers the pattern repo-wide if you go on to grep the other
fire-and-forget call sites — offer that as separate work, do not fold it in.

---

## 4. Environment drift: green locally, red on CI

**Symptom.** Three tests fail on CI, pass locally, identical commit.

**Obvious path.** "CI is flaky." Or: bump the timeout and re-run until green.

**What the procedure forces instead.** Diff the two environments before theorising
about the code:

| Axis | Check it | Bit here? |
| --- | --- | --- |
| Version | runtime, `node_modules` lockfile resolution, native modules | no |
| Locale / TZ / clock | `TZ`, `LANG`, ICU build, system time skew | **yes — CI is `Etc/UTC`, local is `Asia/…`; the fixture compares a hardcoded local-midnight timestamp** |
| Filesystem | case sensitivity, path separators, `/tmp` shared between jobs | no |
| Concurrency | core count, test parallelism, shared DB or port between workers | **yes — CI has 8 cores, so the parallelism case finally fires** |
| Network | egress allowed, DNS, proxies, real third-party calls | **yes — one test hits a live sandbox API; CI has no key so it silently takes the fallback branch** |

Three distinct causes, three different fixes, and all three invisible from the
error text. Report each with its axis named, and note which ones the local machine
*cannot* exercise — that is the coverage hole.

**Home.** **Harness.** Fix the harness so the difference is visible (pin `TZ`, give CI
a stub instead of a live call, run one worker behind a flag for comparison), and say
what you deliberately did not fix.

---

## 5. When the dig runs out

**Symptom.** A worker-pool test fails ~1/15 with no assertion message — an unhandled
rejection escapes, which is also why the run aborts instead of reporting.

Five probes: seed logging (no pattern), run with `--no-parallel` (still fails, so not
the pool), swap in a fake timer (still fails), bisect to the commit that introduced it
(the test and the code both came in the same commit, so no signal), grep upstream
issues (nothing matching).

**Correct stop.** Report, do not quiet it:

```
Failed:     vitest run pool.spec.ts — "Unhandled rejection: worker died" — 1/15 local, 2/2 CI
Baseline:   unknown — test and code landed together, no clean baseline exists
Evidence:   not parallelism (fails serially), not timers, not seed; no upstream match
Root cause: hypothesis — teardown races an in-flight job (~40%). Unconfirmed.
            Confirming needs a repro with the pool capped at 1 worker and the job
            logged from enqueue to settle: ~1h of spikes, may still not pin it.
Home:       product (likely), harness (possible)
Plan:       1. Quarantine loudly: keep the test running and keep it red-on-fail, with
               a comment naming this hypothesis, so CI surfaces it and the next reader
               inherits the five dead ends.
            2. Spend the hour on the capped-pool repro.
            3. Skip the test. Explicitly not recommended: 1/15 is not "flaky", it is
               an unreproduced crash in code that reports dying workers.
Reverted:   scratch logging removed, fake-timer spike deleted, worktree unmounted
Done looks like: 50 clean runs of pool.spec.ts under --no-parallel AND parallel
```

The difference between case 5 and a bad stop is not that it found the cause. It is
that it left the failure visible, the hypotheses ranked, and the dead ends
documented — so the next dig starts at probe six, not probe one.
