---
name: review
description:
  Verify behavior, then simplify, static analysis (Biome + tsc), and complexity
  review before marking work done. Simplifies without breaking working code;
  re-verifies after each change. Use before finishing Implement work, when the
  user asks for a code review, or when checking whether a solution is ready to
  ship.
---

# Review

Required **before** marking Implement work done.

## Workflow

1. **Verify** — confirm the fix/feature works (test, repro, or check the user asked for)
2. **Simplify pass** — complexity review and fixes **without breaking behavior**
3. **Static analysis** — Biome and TypeScript
4. **Done** — complexity report in the final message; behavior still verified; all checks clean

Do **not** start the simplify pass until step 1 passes. Simplification is cleanup on working code, not another way to find the fix.

## Verify first

Before reading the diff for complexity:

1. Run the **same verification** you used to confirm the fix (test command, repro script, manual check, etc.).
2. If it fails, **stop** — you are not ready for review. Fix behavior first, then return here.
3. Keep that command handy; you will re-run it after simplification changes.

## Simplify pass

1. Read the **full diff** (not just files touched last).
2. Produce a **Complexity report** (format below).
3. **Fix** every `fix-now` item in the same session — one concern or small batch at a time.
4. **Re-verify** after each `fix-now` (or batch). Goal: simpler code, **same behavior**.
5. If re-verify fails → fix the regression before simplifying anything else. Do not stack simplifications on broken code.
6. Re-run the simplify pass if you changed more than ~20 lines or introduced a new abstraction.
7. Only then proceed to static analysis.

## Complexity report

Include this table in the final Implement message:

| Location    | Smell            | Why it feels hacky                  | Simpler option         | Action  |
| ----------- | ---------------- | ----------------------------------- | ---------------------- | ------- |
| `path:line` | e.g. double cast | Bypasses types instead of narrowing | Parse at boundary once | fix-now |

**Action** must be one of:

- `fix-now` — simplify before marking done
- `accept` — intentional tradeoff; one-line reason required
- `ask` — needs user call; blocks "done" until answered

If nothing concerns you, write **"No complexity concerns in diff."** An empty table alone is not enough.

## Red flags

Scan the diff for:

- **Suppressions**: `@ts-ignore`, `biome-ignore`, `eslint-disable`, `as any`, `as unknown as`
- **Explaining comments**: "hacky", "workaround", "for some reason", bare `TODO`
- **Control-flow noise**: extra boolean flags, `let` mutated across branches, nested ternaries
- **Indirection**: wrapper → wrapper, single-use util, config object with one caller
- **Duplication**: near-copy helpers, copy-pasted branches differing by one field
- **Scope creep**: drive-by refactors, unrelated cleanups, debug logging left in
- **Spike residue**: commented blocks, `console.log`, temporary paths

When reviewing TypeScript, also read `typescript-style-guide` — casts and suppressions usually mean the approach is wrong.

## Static analysis

Run from the **package root** for the changed files (the directory with `tsconfig.json` and `biome.json`). Fix every reported issue; do not add ignore/suppress comments without user approval.

### Commands

[Biome](https://biomejs.dev/) for JS/TS/JSON/CSS/HTML:

```sh
npm run biome
npm run tsc # or npm run typecheck
```

### After static analysis

- Any fix that changes more than ~20 lines or adds a new abstraction → re-run the simplify pass and **re-verify**.
- Suppressions and type hacks (`@ts-ignore`, `biome-ignore`, `as any`) usually mean the approach is wrong. Fix the cause; if stuck, explain what you tried and **ask** the user before silencing the checker.

## Iteration rule

- Any `fix-now` → fix, re-verify, then simplify pass again (max **3** rounds).
- A simplification that breaks behavior counts as a failed round — fix it before the next `fix-now`.
- After 2 rounds, remaining items become `ask` with options.
- **Done** only when: verification still passes, no open `fix-now`, no unanswered `ask`, `biome check --write` clean, and `tsc --noEmit` clean (no suppressions/hacks unless the user approved them).

## Example

| Location       | Smell                     | Why it feels hacky | Simpler option                                  | Action  |
| -------------- | ------------------------- | ------------------ | ----------------------------------------------- | ------- |
| `parser.ts:88` | `as Foo` after JSON.parse | Type casting       | Schema at boundary (see typescript-style-guide) | fix-now |

Re-verify after change. Re-run simplify pass — no new concerns → run Biome and `tsc --noEmit` from the package root → re-verify once more → all clean → done.
