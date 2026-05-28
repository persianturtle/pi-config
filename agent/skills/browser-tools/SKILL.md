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
node {baseDir}/browser-eval.ts 'document.title'
```

## Start Chrome

```bash
node {baseDir}/browser-start.ts              # Copy Default (default), headless (cookies, logins, history)
node {baseDir}/browser-start.ts --fresh      # Fresh profile, headless (no cookies, logins, extensions)
node {baseDir}/browser-start.ts --headed     # Copy Default (default), headed (visible window)
node {baseDir}/browser-start.ts --fresh --headed  # Fresh profile, headed (visible window)
```

**Important:** Be sure to stop chrome (via node {baseDir}/browser-stop.ts}) once your usage is complete.

**Default behavior:** Chrome runs in **headless** mode with your Chrome Default by default (cookies, logins, history preserved). Add `--fresh` to use a clean anonymous profile instead. Add `--headed` to launch a visible window.

**When to use `--fresh`:**

- Use `--fresh` only for anonymous testing or when you explicitly need a clean session without your personal data
- Default (no flags) always uses Default — this is what you want for almost everything

**How Chrome profiles work:**

- Copies your **Chrome Default** data
- Creates a minimal Local State to prevent Chrome from showing the profile picker
- The profile is stored at `~/.cache/browser-tools/profile/Default`
- Login sessions, cookies, and history from the chosen profile are preserved
- **Safety:** The script will refuse to run if your main Google Chrome application is currently open, to prevent profile corruption.

**Finding your Chrome profile:** Open Chrome and navigate to `chrome://version/`. Look for **Profile Path** — the profile name is the part after `Chrome/` (e.g., `Default`, `Profile 1`, `Default`).

**If Chrome is already running on :9222**, `browser-start.ts` will detect it and exit immediately — no need to restart.

**Safety:** All tools use `try/finally` to ensure the Playwright connection is always cleanly disconnected (via `browser.close()`), even on errors. This disconnects the client from Chrome without killing the Chrome process — your personal Chrome tabs are never affected.

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
node {baseDir}/browser-eval.ts 'document.title'
node {baseDir}/browser-eval.ts ./scripts/my-script.js
```

Execute JavaScript in the active tab. You can pass a raw JavaScript string or a path to a `.js` file. **Code runs in an async context** — you can use `await` at the top level without wrapping in IIFE. Return values via `return` and wrap complex results in `JSON.stringify()`.

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

Navigate to a URL and extract readable content as markdown. Uses Mozilla Readability-style DOM extraction and converts to markdown. Works on pages with JavaScript content (waits 1.5s for rendering by default).

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
node {baseDir}/browser-eval.ts 'document.title'

# Stop Chrome when done (mandatory — don't skip this)
node {baseDir}/browser-stop.ts
```

**Note:** `browser-start.ts` uses your Chrome Default by default (cookies, logins, history). Only add `--fresh` if you need a clean anonymous session. Use `--profile <name>` to specify a different profile.

---

## Efficiency Guide

### DOM Inspection Over Screenshots

**Don't** take screenshots to see page state. **Do** parse the DOM directly:

```javascript
// Get page structure
document.body.innerHTML.slice(0, 5000);

// Find interactive elements
Array.from(document.querySelectorAll('button, input, [role="button"]')).map(
  (e) => ({
    id: e.id,
    text: e.textContent.trim(),
    class: e.className,
  }),
);
```

### Complex Scripts in Single Calls

Code runs in **async context** — use `await` directly:

```javascript
// Async code works natively now — no IIFE needed
await new Promise((r) => setTimeout(r, 500));
const data = document.querySelector("#target").textContent;
return data;
```

For multiple operations, still use a single statement or `async () => { ... }()` pattern:

```javascript
// Simple multi-statement (works because it's in an async IIFE wrapper)
const data = document.querySelector("#target").textContent;
const buttons = document.querySelectorAll("button");
JSON.stringify({ data, buttonCount: buttons.length });
```

### Batch Interactions

**Don't** make separate calls for each click. **Do** batch them:

```javascript
const actions = ["btn1", "btn2", "btn3"];
actions.forEach((id) => document.getElementById(id).click());
("Done");
```

### Waiting for Updates

Use `sleep` in bash as needed.

### Investigate Before Interacting

Always start by understanding the page structure:

```javascript
{
  title: document.title,
  forms: document.forms.length,
  buttons: document.querySelectorAll('button').length,
  inputs: document.querySelectorAll('input').length,
  mainContent: document.body.innerHTML.slice(0, 3000)
}
```

Then target specific elements based on what you find.

### Detect Logged-In Users on JS-Rich Sites

For sites like GitHub that embed data in JSON scripts:

```javascript
// Extract user from embedded React partial data
(async () => {
  const scripts = document.querySelectorAll(
    "script[data-target='react-partial.embeddedData']",
  );
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
})();
```
