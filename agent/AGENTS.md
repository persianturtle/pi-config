# Agent Instructions

## Research Errors Before Guessing

When a **command, test, or build fails** with an unfamiliar error, use the **research** skill before proposing a fix.


**Research when:**

- The error message or code is unfamiliar
- A fix attempt failed and the cause is unclear
- The failure involves an external tool, API, or library version



**Skip research when:**

- The error is obviously local (typo, wrong path, missing import you can see in the file)
- You already researched this exact error in the same task
- The failure is transient (timeout) and a single retry succeeds
- The error comes from the research/browser tools themselves — diagnose locally instead
After research, report: **what failed**, **what Google’s AI Overview suggested**, **what you verified locally**, then **2–3 options** (same as Explore).

---

## Confirm Before Implementing

Default: **do not leave durable changes** until the user confirms an approach.

### Two Modes


| Mode          | Purpose                                       | May edit code?           | Must end with                                     |
| ------------- | --------------------------------------------- | ------------------------ | ------------------------------------------------- |
| **Explore**   | Verify a hypothesis (debug, reproduce, spike) | Yes — temporary only     | Revert + findings + options                       |
| **Implement** | Deliver the agreed fix/feature                | Yes — after confirmation | Clean diff, complexity report, definition of done |


Stay in **Explore** until the user picks an option (or explicitly says to implement).

### When to Explore Without Asking First

- Reproducing a bug (logs, minimal repro, read-only inspection)
- Running checks the user already asked for (`tsc`, tests, biome)
- **Spiking** a fix to learn *whether* it works — only if you will revert before presenting options
Do **not** explore-by-editing for: refactors, new features, style churn, or “while I’m here” cleanups.

### Explore Rules (debug / spike)

1. State the hypothesis in one sentence before editing.
2. Prefer the smallest change that tests the idea (one file, one branch of logic).
3. Run only the checks needed to validate (test, repro command, etc.).
4. **Revert all exploratory edits** before your next message — workspace should match pre-spike state unless the user said to keep experiments.
5. Report: what you tried, what happened, root cause (if known), and **2–3 options** with tradeoffs.

### When To Switch To Implement

Move to **Implement** only after the user:

- Chooses an option (“do A”), or
- Explicitly waives confirmation (“just fix it”, “ship approach 2”)
Then make the real change cleanly (no leftover debug logging, commented blocks, or half of the spike).

### Before Implementing (required handoff)

Present briefly:

- **Problem** (one line)
- **Options** (numbered; each: approach, pros/cons, scope)
- **Recommendation** (one option + why)
- **Question**: “Which should I implement?” (or “Proceed with #2?”)
Skip the handoff only when the user already gave a clear, scoped instruction to implement.

### Anti-patterns

- Leaving spike code in the tree “because it works”
- Implementing the recommended option without waiting for confirmation
- Large refactors during Explore
- Asking for confirmation on every micro-step after the user said “go ahead”

---

## Tech Stack for Pi Skills & Extensions

Assume the user is using Node v26+ which allows executing typescript directly, with no compilation step. Prefer to write scripts in TypeScript, executed via `node`.

When creatig a skill/extension that require scripts, prefer using TypeScript, and make sure to add the following files:

- `.gitignore` (igorning `node_modules`)
- `biome.json`
- `tsconfig.json`

The `~/.pi/agent/skills/browser-tools` skill is a good example.

Ensure that the skill/extension has at least the following npm scripts:

- `npm run biome`
- `npm run tsc`

---

## Prefer Functional Style Over Classes

Default to a **functional style**: pure functions, immutable data, and declarative patterns
over class-based implementations.

Prefer:
- Pure functions and first-class functions over methods
- Immutable data and data transformations over mutable state
- Composition over inheritance
- Records / interfaces over class definitions

**Exceptions** — using classes is appropriate when required by the platform or library:
- Cloudflare Durable Objects (must extend `DurableObject`)
- DOM APIs (e.g., `HTMLElement` subclasses)
- Any framework or library that mandates class-based patterns

When an exception applies, keep the class scoped and minimize its surface area.

---

## Definition of Done

- Run the **review** skill

