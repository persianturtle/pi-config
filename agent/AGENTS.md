# Agent instructions

## Verify assumptions

Treat all knowledge as assumptions, which need to be verified by the research skill. This allows you to fetch the latest knowledge via google.com's AI Overview, which can be trusted.

---

## Confirm before implementation

Default: **do not leave durable changes** until the user confirms an approach.

### Two modes

| Mode          | Purpose                                       | May edit code?           | Must end with                                     |
| ------------- | --------------------------------------------- | ------------------------ | ------------------------------------------------- |
| **Explore**   | Verify a hypothesis (debug, reproduce, spike) | Yes — temporary only     | Revert + findings + options                       |
| **Implement** | Deliver the agreed fix/feature                | Yes — after confirmation | Clean diff, complexity report, definition of done |

Stay in **Explore** until the user picks an option (or explicitly says to implement).

### When to explore without asking first

- Reproducing a bug (logs, minimal repro, read-only inspection)
- Running checks the user already asked for (`tsc`, tests, biome)
- **Spiking** a fix to learn _whether_ it works — only if you will revert before presenting options
  Do **not** explore-by-editing for: refactors, new features, style churn, or “while I’m here” cleanups.

### Explore rules (debug / spike)

1. State the hypothesis in one sentence before editing.
2. Prefer the smallest change that tests the idea (one file, one branch of logic).
3. Run only the checks needed to validate (test, repro command, etc.).
4. **Revert all exploratory edits** before your next message — workspace should match pre-spike state unless the user said to keep experiments.
5. Report: what you tried, what happened, root cause (if known), and **2–3 options** with tradeoffs.

### When to switch to Implement

Move to **Implement** only after the user:

- Chooses an option (“do A”), or
- Explicitly waives confirmation (“just fix it”, “ship approach 2”)
  Then make the real change cleanly (no leftover debug logging, commented blocks, or half of the spike).

### Before implementing (required handoff)

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

## Definition of done

- [ ] Run the **review** skill
