---
name: research
description: Use this skill for researching topics, debugging errors, and gathering technical information via Google (AI Overviews and AI Mode) plus primary sources. Use proactively for technical questions — library versions, architecture decisions, API references, error root-causing, best practices, tool evaluation.
---

Research runs on the **browser-tools** skill's scripts. They start Chrome for you
and queue on it, so issuing two research calls in one message is safe.

```bash
B=~/.pi/agent/skills/browser-tools

# Facts, versions, "does X exist", error-message lookups — Google + AI Overview, ~6s
node $B/browser-search.ts "What is the latest version of TanStack Start?"

# Comparisons, trade-offs, "which of A/B/C" — Google AI Mode, ~15-60s
node $B/browser-ask.ts "Is it safer to pin the Stripe.js major version or load it evergreen from js.stripe.com?"
```

Both print the answer text, and both exit non-zero rather than pass a bot wall off
as an answer.

- `browser-search.ts --links` also lists external links when Google exposes them.
- `browser-ask.ts` continues the same thread when called again, so follow-ups work;
  `--new-thread` starts over. A Chrome restart loses the thread, so chain a long
  exchange in one command: `node $B/browser-ask.ts "Q1…" && node $B/browser-ask.ts "Follow-up…"`

## Phrasing

- Ask a **complete question**: `What is the latest version of TanStack Start?`, not
  `tanstack start version`.
- For recommendations, name the options: `"…independent React roots, Module
  Federation, or iframes — which do you recommend for a payment form and why?"`
- One question per call.
- Include the constraint that matters (version, platform, exact error text) — vague
  questions get fluent, useless answers.

## Do not stop at the AI answer

AI Overviews and AI Mode are leads, not evidence. Before you assert anything:

1. **Open the primary source**: `node $B/browser-content.ts https://…`, or the
   repo/package you have installed.
2. **Check it locally where possible** — installed version, real source file, a test
   run. Local evidence beats any search result.
3. **Try to refute it.** If the answer says "X is impossible", ask once more framed
   as a bug to explain, and read the code that would have to be true for it to hold.

## When Google gives you nothing

| What you see | What it means | Do |
| --- | --- | --- |
| `⚠ [bot-wall]` / `/sorry` / "unusual traffic" | Bot check — **not** "the network is down". | `node $B/browser-start.ts --restart`, retry once, slower. |
| `(No AI Overview on this page…)` | The query did not trigger an overview. | Re-ask as a question, or use `browser-ask.ts`. |
| AI Mode: "not currently available" | Headless Chrome, or no Google account. | Restart headed, or fall back to `browser-search.ts`. |
| Blocked twice, even headed | That IP is flagged. | Stop burning calls: go straight to primary sources, and say so in your answer. |

If a source needs a login (private GitHub repo, internal dashboard), run
`node $B/browser-whoami.ts <url>` first. Logged out, GitHub renders a private repo as
a 404 — indistinguishable from a repo that does not exist.

## Report format

1. **What was asked** — the actual question, and any dead ends.
2. **What Google said** — the claim, and which tool produced it.
3. **What you verified** — the source you opened, the version you checked.
4. **Options** with trade-offs, best first, and one recommendation.

If you could not verify something, write "unverified" instead of implying you read it.
