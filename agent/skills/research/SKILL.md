---
name: research
description: Use this skill for researching topics, debugging errors, and gathering technical information via Google search. Leverages Google's AI Overview for rich, synthesized answers. Use proactively for any technical question — library versions, architecture decisions, API references, best practices, error debugging, performance comparisons, and tool evaluation.
---

### Browser scripts

The browser scripts used below live in the **browser-tools** skill (sibling directory), not in this skill's directory. For the commands below, use:

```bash
BROWSER=~/.pi/agent/skills/browser-tools
```

(See the browser-tools SKILL.md for full documentation.)

**CDP health check:** every `browser-*` call connects and disconnects. If a call fails with `ECONNREFUSED :9222`, Chrome was killed between calls (common under aggressive memory limits) — re-run `node $BROWSER/browser-start.ts` (add `--headed` if you need headed) and continue.

### Research & Investigation

- **Preferred: Google Search with AI Overview** — Navigate to `https://www.google.com/search?q=<query>` with a **question-style query** (complete sentence ending in "?"). Google renders an AI Overview at the top of results. To trigger it, phrase queries as questions, not keyword searches (e.g. "What's the latest version of TanStack Start?" not "latest tanstack start").
- **Extracting AI Overview content** — Use DOM inspection to extract the AI Overview text from the `#m-x-content` element.

### Basic search with AI Overview extraction

```bash
# Start Chrome headless (with Default — cookies, logins preserved).
# Check if already running first: ps aux | grep Chrome | grep 9222
# If already running, skip this step entirely.
node $BROWSER/browser-start.ts

# Navigate to Google search with a question-style query
node $BROWSER/browser-nav.ts "https://www.google.com/search?q=what+is+the+latest+version+of+tanstack+start%3F"

# Extract AI Overview content from the DOM.
# NOTE: browser-eval already wraps code in an async IIFE — use top-level
# statements and `return`; do NOT wrap in another IIFE (it yields undefined).
node $BROWSER/browser-eval.ts '
const mXContent = document.getElementById("m-x-content");
if (!mXContent) return { error: "No AI Overview found" };

// Try class selector first (most precise), fall back to text pattern
let blocks;
const zElements = mXContent.querySelectorAll(".Z1qcYe");
if (zElements.length > 0) {
  blocks = Array.from(zElements)
    .map((el) => (el.innerText || "").trim())
    .filter((t) => t.length > 20);
} else {
  // Fallback: "Topic: Description" pattern on <ul><li> elements
  blocks = [];
  for (const ul of mXContent.querySelectorAll("ul")) {
    for (const li of ul.querySelectorAll("li")) {
      const text = (li.innerText || "").trim();
      if (!/^[A-Za-z][\s\S]{2,40}?:\s/.test(text)) continue;
      if (text.length < 80 || text.length > 500) continue;
      if (/^(Thank|Share|Click|Report|Close)/i.test(text)) continue;
      if (text.includes("Your feedback helps Google")) continue;
      blocks.push(text);
    }
  }
}

// Dedup: remove blocks that are substrings of longer ones
blocks.sort((a, b) => b.length - a.length);
const result = [];
for (const block of blocks) {
  if (result.some((r) => r.includes(block))) continue;
  result.push(block);
}

return result.join("\n\n").slice(0, 4000);
'

# Stop Chrome when done (mandatory — don't skip this)
node $BROWSER/browser-stop.ts
```

### Using Google AI Mode

**AI Mode requires `--headed` Chrome.** In headless mode Google shows "AI Mode is not currently available on your device or account". The steps below are validated end-to-end:

```bash
# 1. Start headed Chrome (skip if already running on :9222)
node $BROWSER/browser-start.ts --headed

# 2. Navigate — Google redirects to /search?udm=50 with the AI Mode composer
node $BROWSER/browser-nav.ts "https://www.google.com/aimode"

# 3. Probe availability + composer in ONE eval (top-level return)
node $BROWSER/browser-eval.ts '
await new Promise((r) => setTimeout(r, 3000));
return {
  url: location.href,
  unavailable: document.body.innerText.includes("AI Mode is not currently available"),
  composer: Array.from(document.querySelectorAll("textarea")).some((t) => t.offsetParent !== null),
};
'
# If "unavailable: true", fall back to regular search (AI Overview) or report it.

# 4. Compose and submit the question (validated pattern):
#    - the composer is the visible <textarea> (obfuscated class — select generically)
#    - fill via the native value setter + input event
#    - submit with the Enter key sequence
node $BROWSER/browser-eval.ts '
const q = `Your question here. Phrase it as a decision question with options (A/B/C) when you want a recommendation.`;
const ta = Array.from(document.querySelectorAll("textarea")).find((t) => t.offsetParent !== null);
if (!ta) return { error: "no composer textarea" };
ta.focus();
const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
setter.call(ta, q);
ta.dispatchEvent(new Event("input", { bubbles: true }));
await new Promise((r) => setTimeout(r, 800));
for (const type of ["keydown", "keypress", "keyup"]) {
  ta.dispatchEvent(new KeyboardEvent(type, { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
}
await new Promise((r) => setTimeout(r, 1000));
return { submitted: true, url: location.href };
'
# Success: URL changes to ?udm=50&q=... and the question echoes in the page.

# 5. Wait, then extract. The answer appears after the question echo; the
#    page ends with an "AI Mode response is ready" marker. Poll if needed.
sleep 30
node $BROWSER/browser-eval.ts 'return document.body.innerText.slice(-8000);'

# Follow-up questions: reuse the same fill+Enter recipe in the same session.

# 6. Stop Chrome when all browser work is done (mandatory)
node $BROWSER/browser-stop.ts
```

**Caveats:**

- **AI Mode sessions do not survive a Chrome restart** — after any restart, `/aimode` opens a fresh composer; re-submit the question.
- **Keep the flow tight under memory pressure** — if Chrome may be killed between calls, run start + nav + submit + poll in a single bash command with a sleep/eval loop, so the whole exchange happens inside one window.
- When Google is down or the answer is thin, fall back to regular search AI Overviews (section above) and follow up with a more specific question-style query.
