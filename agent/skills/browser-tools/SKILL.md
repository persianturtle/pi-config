---
name: browser-tools
description: Interactive browser automation via Chrome DevTools Protocol — navigate, evaluate JS, extract page text, screenshot, check login state, query Google. Use when you need to visit URLs, read JS-rendered pages, drive web apps, or verify anything that needs a real browser with real sessions.
---

# Browser Tools

A separate Chrome instance, launched and driven by these scripts over CDP. It is
**not** your everyday Chrome and never touches your everyday tabs.

```bash
B=~/.pi/agent/skills/browser-tools

node $B/browser-nav.ts https://example.com          # starts Chrome if needed
node $B/browser-eval.ts 'document.title'            # any JS, top-level await/return
node $B/browser-stop.ts                             # when ALL browser work in the task is done
```

One-time setup, if `$B/node_modules` is missing: `cd $B && npm install`.

## Scripts

| Command | What it does |
| --- | --- |
| `browser-nav.ts <url> [--new] [--tab X] [--wait-for CSS] [--settle MS] [--text N]` | Navigate, wait for the page to settle, report URL/title/warnings |
| `browser-eval.ts '<js>' \| file.js \| - [--tab X] [--wait MS]` | Run JS in a tab (inline, from a file, or piped) |
| `browser-content.ts <url> \| --current [--limit N] [--html]` | Page text (or cleaned HTML) from the rendered DOM |
| `browser-screenshot.ts [path] [--full] [--tab X]` | Viewport screenshot |
| `browser-tabs.ts [--close N\|all]` | List tabs, show which one commands will hit |
| `browser-whoami.ts [url]` | Am I logged in here? |
| `browser-search.ts "<question>"` | Google search + AI Overview in one call |
| `browser-ask.ts "<question>"` | Google AI Mode question, waits for the answer |
| `browser-start.ts [--headless\|--no-copy\|--fresh\|--restart\|--profile <name>]` | Change Chrome mode / session source |
| `browser-stop.ts` | Kill only our Chrome instances |

## How it behaves

- **Chrome starts itself.** Any command launches it if nothing is listening on
  `:9222`, and reuses it if something is. Run `browser-start.ts` only to change
  mode or session source.
- **Headed by default.** Google AI Mode refuses headless Chrome outright, and bot
  checks (Cloudflare, Google `/sorry`) are likelier headless. Use `--headless` only
  when you deliberately want a hidden browser.
- **Your real Chrome session is copied in.** At launch, your Chrome profile's
  cookies are snapshotted into `~/.cache/browser-tools/profile`, so logged-in sites —
  private GitHub repos included — read as logged in. `--no-copy` keeps the automation
  profile's existing state; `--fresh` wipes it (anonymous).
- **One tab is reused.** Commands hit the tab the previous command used. `--new`
  opens a new tab, `--tab 2` / `--tab github` aims at a specific one.
- **Commands queue, they do not race.** Issuing browser commands in parallel is
  safe: they take turns on a lockfile (`⏳ … queuing behind it…`).
- **Stop it when the task is done**, not between commands: `browser-stop.ts`.

## A copied session acts as you

Reading is fine. Anything that submits, merges, or posts is an action on the user's
real accounts — do only what was asked, and prefer a read-only check when in doubt.

## Read pages honestly, not just quickly

`browser-nav.ts` and `browser-content.ts` print `⚠` lines (on stderr, so `| head`
stays clean) when the page is **not** what you asked for:

```
⚠ [auth] GitHub says NOT logged in (cookie logged_in=no). Private repos render as
  "Page not found" when logged out, so a 404 here proves nothing.
```

Treat those as blocking findings, not noise:

- A private repo and a non-existent repo are byte-identical when you are logged out.
- A Google `/sorry` CAPTCHA and a Cloudflare "just a moment" page are not content.

When a 404 or empty page matters, check the session with `browser-whoami.ts`
(`GitHub: logged in` / `NOT logged in`, plus the evidence), or prove it another way:
`git ls-remote`, `gh api`, `curl`.

If `browser-start.ts` prints `session: NOT copied — macOS blocked reading …`, the
terminal lacks access to Chrome's data dir: grant it Full Disk Access, or log in once
in the automation window (the login persists in its profile).

## Recipes

**Several steps in one command** — fewer round-trips:

```bash
node $B/browser-nav.ts https://app.example.com/settings --wait-for '#save' \
  && node $B/browser-eval.ts 'return document.querySelector("#save")?.textContent'
```

**Batch interactions** in one eval instead of one call per click:

```bash
node $B/browser-eval.ts '
for (const id of ["btn1","btn2"]) document.getElementById(id)?.click();
await new Promise(r => setTimeout(r, 500));
return document.querySelectorAll("[data-done]").length;'
```

A single expression is auto-returned; multi-statement code needs an explicit `return`.

**Fill framework-controlled inputs** (React/Vue ignore a bare `input.value =`):

```bash
node $B/browser-eval.ts '
const el = document.querySelector("#email");
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
el.focus(); setter.call(el, "user@example.com");
el.dispatchEvent(new Event("input", { bubbles: true }));
return el.value;'
```

Chip/suggestion fields usually commit on Enter — send a `keydown` Enter, then
verify via the rendered chip, not `input.value` (it often reads back empty).

**Verify a mutation persisted** — re-navigate to the canonical URL, then re-read it.

**Prefer DOM inspection over screenshots.** Use `--text N` or `browser-content.ts`
to read a page; screenshot only when layout or visual state is the question.

**Quoting pain** — write the snippet to a file and run
`node $B/browser-eval.ts /tmp/probe.js`, or pipe it: `… | node $B/browser-eval.ts -`.

## Troubleshooting

Lines starting with `↻` or `⏳` are the scripts recovering or queuing on their own;
they need no action unless the command then fails.

| Symptom | Cause → fix |
| --- | --- |
| `ERR_MODULE_NOT_FOUND: playwright` | Dependencies missing → `cd $B && npm install`. |
| `No tabs open` (eval/screenshot) | Chrome restarted mid-task. Page state is lost: `browser-nav.ts <url>` again. |
| `another browser command has the lock (pid N)` | A command died holding it. If pid N is gone: `rm ~/.cache/browser-tools/lock`. |
| `⚠ [bot-wall]` (Google `/sorry`, Cloudflare) | Bot check, not a dead network. `node $B/browser-start.ts --restart`, then fewer, slower queries. |
| AI Mode: "not currently available" | Headless Chrome, or no Google account. Restart headed for the first; use `browser-search.ts` for the second. |
| Wrong page inspected | `node $B/browser-tabs.ts`, then pass `--tab`. |
| Slow or hanging after many tabs | `node $B/browser-tabs.ts --close all`, or `node $B/browser-stop.ts`. |
