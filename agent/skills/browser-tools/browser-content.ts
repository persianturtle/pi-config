/**
 * Dump the readable text of a page (rendered DOM, so JS-driven pages work).
 *
 * Usage:
 *   node browser-content.ts https://example.com
 *   node browser-content.ts --current                 # whatever is open right now
 *   node browser-content.ts <url> --new               # don't touch the current tab
 *   node browser-content.ts <url> --limit 4000        # default 20000 chars
 *   node browser-content.ts <url> --html              # raw HTML instead of innerText
 *
 * Prints a `⚠` line when the page is a bot check or a logged-out shell, so a
 * CAPTCHA or a "404 because you are not signed in" never reads like real content.
 */
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
  warnIssues,
} from "./shared.ts";

const args = parseArgs(process.argv.slice(2));
const target = args.rest[0];
const currentOnly = hasFlag(args, "current");

if (!target && !currentOnly) {
  console.log(
    "Usage: node browser-content.ts <url> | --current [--new] [--tab <n>] [--limit <chars>] [--html]",
  );
  process.exit(1);
}

const limit = numFlag(args, "limit", 20_000);
const wantHtml = hasFlag(args, "html");

await runBrowserCommand(async (browser) => {
  const page = await pickOrOpenPage(browser, {
    newTab: hasFlag(args, "new"),
    tab: flagValue(args, "tab"),
  });

  if (target && !currentOnly) {
    await gotoSettled(page, target, { timeoutMs: 30_000 });
  }

  const notes = await settlePage(page, {
    waitFor: flagValue(args, "wait-for"),
    settleMs: numFlag(args, "settle", 800),
  });

  const title = await page.title().catch(() => "");
  const body = await page.evaluate(
    wantHtml
      ? () => {
          const clone = document.documentElement.cloneNode(true) as HTMLElement;
          clone.querySelectorAll("script,style,noscript,svg").forEach((node) => {
            node.remove();
          });
          return clone.innerHTML;
        }
      : () => document.body?.innerText.replace(/\n{3,}/g, "\n\n") ?? "",
  );

  console.log(`URL: ${page.url()}`);
  if (title) console.log(`Title: ${title}`);
  for (const note of notes) console.error(`⚠ ${note}`);
  await warnIssues(page);
  noteTab(page);

  const text = body.trim();
  console.log(text.slice(0, limit));
  if (text.length > limit) {
    console.error(`↪ truncated: ${text.length} chars total, showing first ${limit} (use --limit)`);
  }
  rememberTab(page);
});
