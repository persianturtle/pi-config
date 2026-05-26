# Agent instructions

## Verify external facts (browser-tool)

Before stating version-specific facts, CLI flags, or library behavior, search the web via **browser-tool**. Do not trust memory for “latest” details.

When choosing or upgrading dependencies, check official docs and release notes first, then align install commands and config with what you find.

Repo-only work (reading code, refactors, local config) does not need a web search unless the answer depends on an external tool or version.

---

## Verify before editing code

When debugging, it's okay to make code changes to code to debug or prototype ideas. However, once the issue is resolved, you **must revert** any debugging-only changes to match the original state. Then, ask the user to proceed and provide options when possible.

---

## Code quality (run before finishing changes)

### Biome — format and lint

[Biome](https://biomejs.dev/) for JS/TS/JSON/CSS/HTML:

```sh
npx @biomejs/biome check --write .
```

Fix reported issues; do not add ignore/suppress comments without user approval (see below).

### TypeScript — style and type check

When writing or reviewing TypeScript, **read the `typescript-style-guide` skill first** and follow its patterns. The skill defines how we write TS; Biome and `tsc` catch formatting and compile errors.

If you are type casting (e.g. `as ...`, `as unknown as ...`) then you're not following the style guide.

```sh
npx tsc --noEmit
```

### Structure and duplication

Read the diff and surrounding code. Fix copy-pasted logic, near-duplicate helpers, and dead code from refactors. Prefer small shared abstractions over heavy frameworks.

### Errors — fix the cause, ask before workarounds

When lint, type check, or review surfaces an error you cannot resolve cleanly, **pause and ask the user** before:

- Ignore/suppress comments (`// @ts-ignore`, `biome-ignore`, `eslint-disable`, etc.)
- Casts or assertions that only silence the checker (`as any`, `!` without proof)
- Other hacks that make the error disappear without fixing the root cause

Suppressions and hacks often mean the approach is wrong. Prefer a real fix; if stuck, explain the error, what you tried, and ask how to proceed.

---

## Definition of done

- [ ] TypeScript follows `typescript-style-guide`; `biome check --write` and `tsc --noEmit` clean (no suppressions/hacks unless the user approved them)
- [ ] No unnecessary duplication introduced
- [ ] Version/API claims verified via browser-tool when stated
