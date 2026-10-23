---
name: research
description: Use this skill for researching topics, debugging errors, and gathering technical information via Google (AI Overviews and AI Mode) plus primary sources. Use proactively for technical questions — library versions, architecture decisions, API references, error root-causing, best practices, tool evaluation.
---

Research runs through the **browser-tools** skill (sibling directory). Both skills
share one Chrome instance; the scripts start Chrome for you and **queue** on it, so
issuing two research calls in one message is safe — they take turns, they do not
clobber each other's page.

```bash
B=~/.pi/agent/skills/browser-tools
```

## Two one-shot commands

```bash
# Quick factual lookup — Google search page + AI Overview, ~6s
node $B/browser-search.ts "What is the latest version of TanStack Start?"

# Judgement/decision questions — Google AI Mode, waits for the answer (~15-60s)
node $B/browser-ask.ts "Is it safer to pin the Stripe.js major version or load it evergreen from js.stripe.com?"
```

Both print the answer text directly; both **refuse to pass a bot wall off as an
answer** (they exit non-zero and say so).

- **`browser-search.ts`** — facts, versions, "does X exist", error-message lookups.
  Add `--links` to also list external hrefs when Google exposes them.
- **`browser-ask.ts`** — comparisons, trade-offs, "which of A/B/C", anything where
  you want synthesis. Ask follow-ups by calling it again: it continues the thread
  in the same tab. Add `--new-thread` to start over.

Chrome restarts wipe the AI Mode thread, and a long wait is fragile if Chrome gets
reaped between calls. For a long exchange, keep it in one bash command:

```bash
node $B/browser-ask.ts "Q1…" && node $B/browser-ask.ts "Follow-up to Q1…"
```

## Phrasing

- Ask a **complete question**. `tanstack start version` works less reliably than
  `What is the latest version of TanStack Start?`
- For recommendations, name the options: `"…isolation via independent React roots,
  Module Federation, or iframes — which do you recommend for a payment form and why?"`
- One question per call. AI Mode answers the question it was given.
- Add the constraint that actually matters (versions, parallelism, error text,
  platform) — vague questions get fluent, useless answers.

## Do not stop at the AI answer

AI Overviews and AI Mode are leads, not evidence. Before you write a recommendation:

1. **Open the primary source** for whatever you are about to assert:
   `node $B/browser-content.ts https://…` or `curl -A <UA> https://…`,
   or read the actual repo/package you have installed.
2. **Check it locally where possible** — installed version, real source file,
   a test run. Local evidence beats any search result.
3. **Actively try to refute it.** If the answer says "X is impossible", ask once
   more in `browser-ask.ts` framing it as a bug to explain, and read the code that
   would have to be true for it to hold.

Reproduced from earlier sessions, so you can sanity-check the tooling: a
"fully rendered page + `waitForFunction` timeout" question returned actual
Playwright guidance from AI Mode; a "Stripe evergreen SDK" question returned the
real `js.stripe.com/<train>/` train model, which then matched `stripe-js` source.

## When Google gives you nothing

| What you see | What it means | Do |
| --- | --- | --- |
| `⚠ [bot-wall]` / `/sorry` / "unusual traffic" | Bot check. **Not** "the network is down". | `node $B/browser-start.ts --restart` (headed), retry once, slower. |
| `(No AI Overview on this page…)` | Query didn't trigger an overview, or a consent page. | Re-ask as a question, or use `browser-ask.ts`. |
| AI Mode: "not currently available" | Headless Chrome / no Google account. | Headed Chrome, or fall back to `browser-search.ts`. |
| Blocked even headed, twice | That IP/network is flagged. | Stop burning calls: go straight to primary sources (vendor docs, repo source, installed `node_modules`). Say so in your answer. |

If a source needs a login (private GitHub repo, internal dashboard), check
`node $B/browser-whoami.ts` first. Your Chrome session is copied into the automation
browser by default, so "logged out" is now the exception — but when it happens,
GitHub renders private repos as 404, and that mistake cost a whole investigation once.

## Report format

Per the agent instructions, end research with:

1. **What failed / what was asked** — the actual question and any dead ends.
2. **What Google said** — the claim, attributed, with which tool produced it.
3. **What you verified locally** — the source you opened, the version you checked.
4. **2–3 options** with tradeoffs and a recommendation (same shape as Explore mode).

If you could not verify something, say "unverified" instead of implying you read it.
