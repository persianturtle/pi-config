---
name: browser-tools
description: Interactive browser automation via Chrome DevTools Protocol. Use when you need to visit URLs, read web pages, interact with web apps, scrape content, take screenshots, etc. Essential for any task requiring a real browser with account sessions.
---

# Browser Tools

Chrome DevTools Protocol tools for agent-assisted web automation. These tools connect to Chrome running on `:9222` with remote debugging enabled.

## Viewport

All scripts use a viewport of **1512×827** CSS pixels (a common laptop-sized viewport). Screenshots, DOM inspection, and page interactions all reflect this viewport size. This can be adjusted in `shared.ts` if needed.

## Setup

Run once before first use:

```bash
cd {baseDir}/browser-tools
npm install
```

Note: `baseDir` is likely ~/.pi/agent/skills

**⚠️ Always run scripts with `node`** — these are TypeScript scripts. Node v23.6.0+ has built-in TypeScript support. For example:

```bash
node {baseDir}/browser-nav.ts https://example.com
node {baseDir}/browser-eval.ts 'return document.title'
```

## Start Chrome

```bash
node {baseDir}/browser-start.ts                      # Copy Default (default), headless
node {baseDir}/browser-start.ts --fresh              # Fresh profile, headless (no cookies, logins, extensions)
node {baseDir}/browser-start.ts --headed             # Copy Default (default), headed (visible window)
node {baseDir}/browser-start.ts --fresh --headed     # Fresh profile, headed (visible window)
node {baseDir}/browser-start.ts --profile "Profile 1"  # Copy a specific Chrome profile
```

**Important:** Be sure to stop chrome (via `node {baseDir}/browser-stop.ts`) once your usage is complete.

**Default behavior:** Chrome runs in **headless** mode with a copy of your Chrome Default profile (cookies, logins, history preserved). Add `--fresh` to use a clean anonymous profile instead. Add `--headed` to launch a visible window.

**When to use `--fresh`:**

- Use `--fresh` only for anonymous testing or when you explicitly need a clean session without your personal data
- Default (no flags) always copies Default — this is what you want for almost everything

**How Chrome profiles work:**

- Copies your **Chrome Default** profile data (or the one given via `--profile`) into a private directory — the copy is read-only with respect to your real profile, so it is safe even while your main Chrome is open
- Creates a minimal Local State to prevent Chrome from showing the profile picker
- The profile is stored at `~/.cache/browser-tools/profile/Default`
- Login sessions, cookies, and history from the copied profile are preserved

**Finding your Chrome profile:** Open Chrome and navigate to `chrome://version/`. Look for **Profile Path** — the profile name is the part after `Chrome/` (e.g., `Default`, `Profile 1`).

**If Chrome is already running on :9222**, `browser-start.ts` will detect it and exit immediately — no need to restart.

**Safety:** All tools use `try/finally` to ensure the Playwright connection is always cleanly disconnected (via `browser.close()`), even on errors. This disconnects the client from Chrome without killing the Chrome process — your personal Chrome tabs are never affected. `browser-stop.ts` only kills processes launched with our private user-data-dir, so it can never touch your main Chrome.

**⚡ Always check first:** Before running `browser-start.ts`, check if Chrome is already running:

```bash
ps aux | grep Chrome | grep 9222
```

If Chrome is already running, **skip `browser-start.ts` entirely** and go straight to `browser-nav.ts`. Chrome sessions persist between pi sessions — it's almost always already running. Starting it again is wasteful and can trigger race conditions.

## Navigate

```bash
node {baseDir}/browser-nav.ts https://example.com
node {baseDir}/browser-nav.ts https://example.com --new
```

Navigate to URLs. Use `--new` flag to open in a new tab instead of reusing current tab.

**IMPORTANT**: Whenever you're asked to visit or open a URL, always use `browser-nav.ts`. Do not fall back to `open`, `start-chrome`, or any other method — this ensures the browser is managed by the CDP automation pipeline.

## Evaluate JavaScript

```bash
node {baseDir}/browser-eval.ts 'return document.title'
node {baseDir}/browser-eval.ts ./scripts/my-script.js
```

Execute JavaScript in the active tab. You can pass a raw JavaScript string or a path to a `.js` file.

**Code runs in an async function** — you can use `await` and `return` at the top level without wrapping in an IIFE:

```bash
node {baseDir}/browser-eval.ts 'await new Promise(r => setTimeout(r, 500)); return document.title'
```

- Use `return` to send a value back to the terminal (a bare expression without `return` yields `undefined`)
- String results print as-is; other values are pretty-printed as JSON (wrap complex objects in `JSON.stringify` if you want a single-line compact form)

## Screenshot

```bash
node {baseDir}/browser-screenshot.ts
node {baseDir}/browser-screenshot.ts /path/to/output.png
```

Capture current viewport and return file path. Defaults to `/tmp/screenshot-<uuid>.png`. Use this to visually inspect page state or verify UI changes.

## Extract Page Content

```bash
node {baseDir}/browser-content.ts https://example.com
node {baseDir}/browser-content.ts --current   # Extract from the page currently loaded in the browser
```

Navigate to a URL and extract the rendered page's text content (from `document.body.innerText`). Works on pages with JavaScript content because it reads the live DOM.

**Tip:** Use `--current` to extract from the page already loaded in the browser (faster, no re-navigation).

## Stop Chrome

```bash
node {baseDir}/browser-stop.ts
```

**MANDATORY:** Call this after every browser session to clean up Chrome processes. Chrome persists between pi sessions for efficiency (so you don't need to start it every time), but lingering processes accumulate and waste resources. Chrome will stay running across multiple browser-tool calls within a single task — only stop it when **all** browser work is finished.

## When to Use

- Testing frontend code in a real browser
- Interacting with pages that require JavaScript
- When user needs to visually see or interact with a page
- Debugging authentication or session issues
- Scraping dynamic content that requires JS execution
- **The user asks to visit or open a URL**

**Mandatory:** Always call `node {baseDir}/browser-stop.ts` at the end of every browser task. Skipping this leaves orphan Chrome processes running.

### Starting and stopping Chrome

```bash
# Start Chrome (if not already running)
node {baseDir}/browser-start.ts

# Use browser tools...
node {baseDir}/browser-nav.ts https://example.com
node {baseDir}/browser-eval.ts 'return document.title'

# Stop Chrome when done (mandatory — don't skip this)
node {baseDir}/browser-stop.ts
```

**Note:** `browser-start.ts` copies your Chrome Default by default (cookies, logins, history). Only add `--fresh` if you need a clean anonymous session. Use `--profile <name>` to copy a different profile.

---

## Efficiency Guide

### DOM Inspection Over Screenshots

**Don't** take screenshots to see page state. **Do** parse the DOM directly:

```javascript
// Get page structure
return document.body.innerHTML.slice(0, 5000);

// Find interactive elements
return Array.from(document.querySelectorAll('button, input, [role="button"]')).map(
  (e) => ({
    id: e.id,
    text: e.textContent.trim(),
    class: e.className,
  }),
);
```

### Top-Level `await` and `return`

Code runs in an **async context** — use `await` directly:

```javascript
// Async code works natively — no IIFE needed
await new Promise((r) => setTimeout(r, 500));
return document.querySelector("#target").textContent;
```

For multiple operations, just write plain statements ending in `return`:

```javascript
const data = document.querySelector("#target").textContent;
const buttons = document.querySelectorAll("button");
return JSON.stringify({ data, buttonCount: buttons.length });
```

### Batch Interactions

**Don't** make separate calls for each click. **Do** batch them:

```javascript
["btn1", "btn2", "btn3"].forEach((id) => document.getElementById(id).click());
return "Done";
```

### Waiting for Updates

```javascript
await new Promise((r) => setTimeout(r, 500));
return document.querySelector("#status").textContent;
```

Or use `sleep` in bash between separate tool calls.

### Investigate Before Interacting

Always start by understanding the page structure:

```javascript
return {
  title: document.title,
  forms: document.forms.length,
  buttons: document.querySelectorAll('button').length,
  inputs: document.querySelectorAll('input').length,
  mainContent: document.body.innerHTML.slice(0, 3000),
};
```

Then target specific elements based on what you find.

### Detect Logged-In Users on JS-Rich Sites

For sites like GitHub that embed data in JSON scripts:

```javascript
const scripts = document.querySelectorAll("script[data-target='react-partial.embeddedData']");
for (const script of scripts) {
  try {
    const data = JSON.parse(script.textContent);
    if (data.props?.userMenu?.owner?.login) {
      return data.props.userMenu.owner;
    }
  } catch {
    /* skip */
  }
}
return null;
```
