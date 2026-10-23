/**
 * One-shot Google AI Mode question: open AI Mode, submit the question with real
 * keyboard input, wait for the answer, print it.
 *
 * Usage:
 *   node browser-ask.ts "Why do Playwright waitForFunction timeouts happen on rendered pages?"
 *   node browser-ask.ts "<follow-up question>"        # continues the thread in the same tab
 *   node browser-ask.ts "<question>" --new-thread     # force a fresh AI Mode thread
 *   node browser-ask.ts "<question>" --timeout 180 --limit 12000
 *
 * Requires headed Chrome (it is the default). AI Mode refuses headless Chrome with
 * "AI Mode is not currently available on your device or account" — that is expected,
 * not a bug: re-run `node browser-start.ts --restart` and try again.
 *
 * A Chrome restart wipes the AI Mode thread, so keep a multi-turn exchange inside
 * one window where Chrome stays up.
 */
import type { Locator } from "playwright";
import {
  flagValue,
  gotoSettled,
  hasFlag,
  noteTab,
  numFlag,
  parseArgs,
  pickOrOpenPage,
  rememberTab,
  runBrowserCommand,
  settlePage,
} from "./shared.ts";

const args = parseArgs(process.argv.slice(2));
const question = args.rest[0];

if (!question) {
  console.log(
    'Usage: node browser-ask.ts "<question>" [--timeout <s>] [--limit <chars>] [--new-thread] [--new] [--tab <n>]',
  );
  process.exit(1);
}

const timeoutSeconds = numFlag(args, "timeout", 120);
const limit = numFlag(args, "limit", 8000);

const COMPOSERS = [
  "textarea:visible",
  '[contenteditable="true"]:visible',
  '[role="textbox"]:visible',
];

await runBrowserCommand(async (browser) => {
  const page = await pickOrOpenPage(browser, {
    newTab: hasFlag(args, "new"),
    tab: flagValue(args, "tab"),
  });

  // Reuse an in-progress AI Mode thread; otherwise start one.
  if (hasFlag(args, "new-thread") || !page.url().includes("udm=50")) {
    await gotoSettled(page, "https://www.google.com/aimode", { timeoutMs: 30_000 });
    await settlePage(page, { settleMs: 2500 });
  }

  const shell = await page.evaluate(() => document.body.innerText.slice(0, 600));
  if (/not currently available/i.test(shell)) {
    console.error("✗ Google AI Mode is unavailable for this window/account.");
    console.error(`  page: ${page.url()}`);
    console.error(
      "  If Chrome is headless: node browser-start.ts --restart   (headed is the default)",
    );
    console.error('  Otherwise fall back to: node browser-search.ts "<question>"');
    process.exit(2);
  }

  let composer: Locator | undefined;
  for (const selector of COMPOSERS) {
    const candidate = page.locator(selector).first();
    if (await candidate.isVisible().catch(() => false)) {
      composer = candidate;
      break;
    }
  }
  if (!composer) {
    console.error("✗ No AI Mode composer found.");
    console.error(`  page: ${page.url()}`);
    console.error(`  text: ${shell.replace(/\s+/g, " ").slice(0, 240)}`);
    console.error(
      "  Try: node browser-nav.ts https://www.google.com/aimode --wait 5000, or check you are not on a /sorry bot page.",
    );
    process.exit(2);
  }

  rememberTab(page);
  noteTab(page);
  const before = await page.evaluate(() => document.body.innerText.length);

  // Real input events, not synthetic dispatchEvent — this is what makes it behave.
  await composer.click();
  await composer.fill(question);
  await new Promise((resolve) => setTimeout(resolve, 400));
  await composer.press("Enter");
  console.error(`↪ submitted at ${new Date().toISOString()}`);

  const deadline = Date.now() + timeoutSeconds * 1000;
  await new Promise((resolve) => setTimeout(resolve, 3000));

  let lastLength = -1;
  let stable = 0;
  let state = { ready: false, generating: true, length: 0 };
  const polls = Math.max(1, Math.floor((timeoutSeconds * 1000) / 3000));

  for (let i = 0; i < polls; i++) {
    state = await page.evaluate(() => {
      const text = document.body.innerText;
      const generating = Array.from(document.querySelectorAll("button")).some(
        (button) =>
          /^(stop|stop generating)$/i.test((button.getAttribute("aria-label") ?? "").trim()) &&
          (button as HTMLElement).offsetParent !== null,
      );
      return { ready: text.includes("AI Mode response is ready"), generating, length: text.length };
    });

    stable = state.length === lastLength ? stable + 1 : 0;
    lastLength = state.length;
    console.error(
      `↪ poll ${i + 1}: ${state.length} chars, generating=${state.generating}, ready=${state.ready}`,
    );

    if (state.ready) break;
    if (!state.generating && stable >= 2 && state.length > before + 300) break;
    if (Date.now() > deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const answer = await page.evaluate((text: string) => {
    const body = document.body.innerText;
    const askedAt = body.lastIndexOf(text);
    const start = askedAt >= 0 ? askedAt + text.length : 0;
    let end = body.indexOf("Skip to previous prompt", start);
    if (end < 0) end = body.indexOf("AI Mode response is ready", start);
    if (end < 0) end = body.length;
    return body.slice(start, end).trim();
  }, question);

  if (!state.ready && state.length <= before + 300) {
    console.error(
      `⚗ No answer appeared within ${timeoutSeconds}s — the question may not have submitted. Re-run with --new-thread.`,
    );
  }
  console.log(answer.slice(0, limit) || "(empty answer — see the page dump above)");
});
