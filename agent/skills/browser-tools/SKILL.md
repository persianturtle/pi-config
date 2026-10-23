---
name: browser-tools
description: Interactive browser automation via Chrome DevTools Protocol — navigate, evaluate JS, extract page text, screenshot, check login state, query Google. Use when you need to visit URLs, read JS-rendered pages, drive web apps, or verify anything that needs a real browser with real sessions.
---

# Browser Tools

CDP-driven Chrome for agent work. Chrome is launched and controlled by these
scripts; it is **not** your everyday Chrome and never touches your everyday tabs.

Set this once per shell:

```bash
B=~/.pi/agent/skills/browser-tools
```

## The 30-second path

```bash
node $B/browser-nav.ts https://example.com          # starts Chrome if needed
node $B/browser-eval.ts 'document.title'            # any JS, top-level await/return
node $B/browser-stop.ts                             # when ALL browser work in the task is done
```

Chrome starts itself: the scripts connect to `:9222` and, if nothing is listening,
launch Chrome (~1s, prints `↻ Chrome not running… starting it`). Run
`browser-start.ts` only to change mode or session source (`--headless`, `--no-copy`, `--fresh`, `--restart`, `--profile <name>`).

One-time setup (skip if `$B/node_modules` exists): `cd $B && npm install`.
A `ERR_MODULE_NOT_FOUND: playwright` error means that step was skipped.

## Defaults (read this before you fight them)

- **Headed by default.** A visible Chrome window is the point: Google AI Mode refuses
  headless outright ("not currently available"), and bot checks (Cloudflare, Google
  `/sorry`) are likelier headless — measured here: AI Mode worked headed, failed headless.
  Use `--headless` only when you deliberately want a hidden browser.
- **Your real Chrome session is copied in by default.** At launch, the current
  profile's `Cookies` DB is snapshotted (verified, integrity-checked) into
  `~/.cache/browser-tools/profile`, so logged-in sites — private GitHub repos
  included — read as logged in. `--no-copy` keeps the profile's own state,
  `--fresh` wipes it. See "Session and login".
- **One tab is reused.** Commands hit the tab the previous command used. Use
  `--new` for a new tab, `--tab 2` / `--tab github` to aim at a specific one,
  and `node $B/browser-tabs.ts` to see them.
- **Commands queue, they do not race.** One Chrome = one shared tab, so browser
  commands take a lockfile turn (you may see `⏳ … queuing behind it…`). Issuing
  them in parallel is safe; it just serialises. `BROWSER_TOOLS_NO_LOCK=1` opts out
  and *will* return the wrong page — that is the bug it exists to prevent.
- **Already-running Chrome is reused, never restarted.**

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
| `browser-start.ts [--headless\|--no-copy\|--fresh\|--restart\|--profile <name>]` | Change Chrome mode / session source, or inspect |
| `browser-stop.ts` | Kill only our Chrome instances |

## Read pages honestly, not just quickly

`browser-nav.ts` and `browser-content.ts` print `⚠` lines (on stderr, so `| head`
stays clean) when the page is **not** what you asked for:

```
⚠ [auth] GitHub says NOT logged in (cookie logged_in=no). Private repos render as
  "Page not found" when logged out, so a 404 here proves nothing.
```

Treat those as *blocking findings*, not noise. Two real cases they exist for:

- A private repo and a non-existent repo are byte-identical when you are logged out.
- A Google `/sorry` CAPTCHA and a Cloudflare "just a moment" page are not search results.

When a 404/empty page matters, prove it another way before concluding:
`git ls-remote`, `gh api`, `curl -A <UA>`, or log in once and re-check with
`node $B/browser-whoami.ts`.

## Session and login

`browser-start.ts` copies your Chrome profile's session cookies into the automation
profile, which is why `github.com/your-private-repo` renders instead of 404-ing. It
reports what happened, and the copy is integrity-checked before use — a torn snapshot
is discarded, never trusted. Chrome 136+ refuses to attach to your everyday Chrome
(debug ports need a non-default profile dir), so copying is how logins get in.

Check it, don't assume it:

```bash
node $B/browser-whoami.ts              # "GitHub: logged in" / "NOT logged in" + why
node $B/browser-start.ts               # prints "session: N cookies copied …"
```

- Prints `session: NOT copied — macOS blocked reading …` → the terminal lacks read
  access to Chrome's data dir. Grant Full Disk Access, or log in once in the window.
- `--no-copy` / `--fresh`: logged-out. Good for testing what an anonymous visitor sees.
- **A copied session acts *as you*.** Reading is fine; anything that submits, clicks
  "merge", or posts a comment is an action on your real accounts. Do the things the
  user asked for, and prefer a read-only check when in doubt.

## Recipes

**One command, several steps** (fewer round-trips, and immune to Chrome being
reaped between calls):

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

**Verify a mutation actually persisted** — re-navigate to the canonical URL, then
re-read:

```bash
node $B/browser-nav.ts https://app.example.com/settings/page --settle 2000
node $B/browser-eval.ts 'return document.querySelector("#field")?.value'
```

**Prefer DOM inspection over screenshots.** Use `--text N` or `browser-content.ts`
to read a page; use a screenshot only when layout/visual state is the question.

**Quoting pain:** if a JS snippet keeps breaking in shell quoting, write it to a
file and run `node $B/browser-eval.ts /tmp/probe.js`, or pipe it:
`cat /tmp/probe.js | node $B/browser-eval.ts -`. A single expression without
`return` is auto-returned; multi-statement code is not.

## Troubleshooting

| Symptom | Cause → fix |
| --- | --- |
| `ERR_MODULE_NOT_FOUND: playwright` | Dependencies missing → `cd ~/.pi/agent/skills/browser-tools && npm install`. |
| `connect ECONNREFUSED ::1:9222` | Old code: current scripts always use `127.0.0.1`, because `localhost` can resolve to `::1` and Chrome only binds IPv4. |
| `↻ Chrome not running… starting it` | Normal self-heal after Chrome was killed/reaped. |
| `No tabs open` (eval/content) | Chrome restarted mid-task. `browser-nav.ts` reopens a tab; assume page state was lost and re-navigate. |
| `↻ navigation aborted (tab still busy) — retry 1/2` | Auto-recovered. Only a problem if it repeats and then fails. |
| `⏳ … queuing behind it…` | Normal: commands take turns on the shared browser. |
| `another browser command has the lock (pid N)` | A command died holding it. If pid N is gone: `rm ~/.cache/browser-tools/lock`. |
| `⚠ [bot-wall]` (Google `/sorry`, Cloudflare) | Bot check, not a dead network. `node $B/browser-start.ts --restart` (headed), then go slower/fewer queries. |
| AI Mode: "not currently available" | Headless Chrome, or no Google account. Headed fixes the first; use `browser-search.ts` for the second. |
| Wrong page inspected | `node $B/browser-tabs.ts`, then pass `--tab`. |
| Everything slow / hangs after many tabs | `node $B/browser-tabs.ts --close all`, or `node $B/browser-stop.ts`. |

**Cleanup:** run `node $B/browser-stop.ts` when all browser work in the task is
done. Chrome is allowed to persist *within* a task; do not stop/restart it between
two commands, and do not leave it running after the task ends.