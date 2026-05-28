---
name: research
description: Use this skill for two primary purposes. 1) Researching topics and debugging errors via Google search. When researching topics, trigger Google's AI Overview by asking full questions (e.g., "What's the latest version of TanStack Start" vs "latest tanstack start"). 2) When encountering errors, use this skill to search the error message and leverage the AI Overview's recommendations.
---

### Research & Investigation

- **Performing a Google search** — Use **browser-tools** when you need to find official docs, API references, or guides for a library, framework, or technology. Navigate to `https://www.google.com/search?q=<query>` and extract results using the DOM or `browser-content.ts` (after first starting the browser with **browser-tools**). Prefer extractig results from the AI Overview, if provided. To trigger an AI Overview, ask questions using complete sentences.
- **Asking follow up questions in the AI Overview** — Use when you need clarification on the intial results provided by the AI Overview. Click on the "Show more" button in the AI Overview, and then ask follow up questions in the textarea that pops up with the "Ask anything" placeholder.

## Research & Investigation Examples

### Searching for library documentation

```bash
# Start Chrome headless (with Default — cookies, logins preserved).
# Check if already running first: ps aux | grep Chrome | grep 9222
# If already running, skip this step entirely.
node {baseDir}/browser-start.ts

# Navigate to Google search
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=what+is+the+latest+version+of+tanstack+start%3F"

# Extract readable content from results
node {baseDir}/browser-content.ts --current

# Stop Chrome when done (mandatory — don't skip this)
node {baseDir}/browser-stop.ts
```

### Asking follow up questions in the AI Overview

```bash
# Start Chrome headless (if not already running)
node {baseDir}/browser-start.ts

# Navigate to a Google search with a question-style query (triggers AI Overview)
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=what+are+the+best+practices+for+react+state+management+in+2026%3F"

# Step 1: Extract the AI Overview content from the search results page
node {baseDir}/browser-eval.ts '
(async () => {
  const mXContent = document.getElementById("m-x-content");
  if (!mXContent) return { error: "No AI Overview" };

  const elements = Array.from(mXContent.querySelectorAll("div, p, li, span"));
  const texts = elements
    .map(el => el.textContent?.trim())
    .filter(Boolean)
    .filter(text =>
      text.length > 100 && text.length < 5000 &&
      !text.includes("An AI Overview is not available") &&
      !text.includes("Try again later")
    );
  const uniqueTexts = [...new Set(texts)];
  return uniqueTexts.join("\n\n").substring(0, 3000);
})()'

# Step 2: Expand the AI Overview and type a follow-up question
node {baseDir}/browser-eval.ts '
(async () => {
  // Click "Show more" to expand AI Overview
  document.querySelector("[aria-label=\"Show more AI Overview\"]").click();
  await new Promise(r => setTimeout(r, 2000));

  // Type a follow-up question in the textarea
  const textarea = document.querySelector("textarea.ITIRGe");
  textarea.value = "Which approach is best for a large e-commerce application?";
  textarea.dispatchEvent(new Event("input", { bubbles: true }));

  // Submit — clicking the Send button navigates to a Chrome AI page
  const sendBtn = Array.from(document.querySelectorAll("button, [role=button]"))
    .find(b => b.getAttribute("aria-label") === "Send");
  sendBtn.click();
})()'

# Step 3: Extract the final response from the Chrome AI page
node {baseDir}/browser-eval.ts '
(async () => {
  await new Promise(r => setTimeout(r, 4000));

  const root = document.getElementById("root") || document.body;
  const elements = Array.from(root.querySelectorAll("div, p, li, span, h1, h2, h3"));
  const texts = elements
    .map(el => el.innerText)
    .filter(Boolean)
  );
  return texts.join("\n\n")
})()'

# Stop Chrome when done (mandatory — don't skip this)
node {baseDir}/browser-stop.ts
```
