---
name: research
description: Use this skill for researching topics, debugging errors, and gathering technical information via Google search. Leverages Google's AI Overview for rich, synthesized answers. Use proactively for any technical question — library versions, architecture decisions, API references, best practices, error debugging, performance comparisons, and tool evaluation.
---

### Research & Investigation

- **Preferred: Google Search with AI Overview** — Navigate to `https://www.google.com/search?q=<query>` with a **question-style query** (complete sentence ending with "?"). Google will render an AI Overview at the top of results. To trigger it, phrase queries as questions, not keyword searches (e.g., "What's the latest version of TanStack Start?" not "latest tanstack start").
- **Extracting AI Overview content** — Use DOM inspection to extract the AI Overview text from the `#m-x-content` element. AI Overview content blocks use a "Topic: Description" pattern, which naturally filters out source links and noise. For expanded content, click the "Show more AI Overview" button.
- **Follow-up questions** — When `google.com/aimode` is available, ask follow-ups directly in the chat. When using regular search, perform a new search with a more specific follow-up query.

## Research & Investigation Examples

### Basic search with AI Overview extraction

```bash
# Start Chrome headless (with Default — cookies, logins preserved).
# Check if already running first: ps aux | grep Chrome | grep 9222
# If already running, skip this step entirely.
node {baseDir}/browser-start.ts

# Navigate to Google search with a question-style query
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=what+is+the+latest+version+of+tanstack+start%3F"

# Extract AI Overview content from the DOM
node {baseDir}/browser-eval.ts '
(async () => {
  const mXContent = document.getElementById("m-x-content");
  if (!mXContent) return { error: "No AI Overview found" };

  // Try class selector first (most precise), fall back to text pattern
  let blocks;
  const zElements = mXContent.querySelectorAll(".Z1qcYe");
  if (zElements.length > 0) {
    blocks = Array.from(zElements)
      .map(el => (el.innerText || "").trim())
      .filter(t => t.length > 20);
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
        if (/ - (DEV|Reddit|GeeksforGeeks|Medium|Hacker\s+News|NPM|YouTube|Microsoft\s+Developer|Convex|Wishtree|Utopycode)/i.test(text)) continue;
        if (/\| by /i.test(text)) continue;
        blocks.push(text);
      }
    }
  }

  // Dedup: remove blocks that are substrings of longer ones
  blocks.sort((a, b) => b.length - a.length);
  const result = [];
  for (const block of blocks) {
    if (result.some(r => r.includes(block))) continue;
    result.push(block);
  }

  return result.join("\n\n").slice(0, 4000);
})()'

# Stop Chrome when done (mandatory — don't skip this)
node {baseDir}/browser-stop.ts
```

### Using Google AI Mode (when available)

```bash
# Start Chrome headless
node {baseDir}/browser-start.ts

# Navigate to AI Mode directly
node {baseDir}/browser-nav.ts "https://www.google.com/aimode"

# Take a screenshot to verify the page loaded
node {baseDir}/browser-screenshot.ts

# If AI Mode is not available, fall back to regular search
node {baseDir}/browser-eval.ts 'document.body.innerText.includes("AI Mode is not currently available")'

# If fallback needed, do a new search with question-style query
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=how+does+cloudflare+workers+compare+to+aws+lambda%3F"

# Extract AI Overview content (same logic as above)
# Stop Chrome when done
node {baseDir}/browser-stop.ts
```

### Researching error messages

```bash
# Start Chrome headless
node {baseDir}/browser-start.ts

# Search the exact error message as a question
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=TypeError+Cannot+read+properties+of+undefined+reading+map+in+React+hooks"

# Extract AI Overview for context (use the same extraction script from the
# "Basic search" example above)
node {baseDir}/browser-eval.ts '<same AI Overview extraction script as above>'

# Stop Chrome when done
node {baseDir}/browser-stop.ts
```
