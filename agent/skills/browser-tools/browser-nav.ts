/**
 * Navigate to a URL and report what actually rendered.
 *
 * Usage:
 *   node browser-nav.ts <url>
 *   node browser-nav.ts <url> --new                    # open a new tab
 *   node browser-nav.ts <url> --tab 2                  # drive tab 2 (see browser-tabs.ts)
 *   node browser-nav.ts <url> --wait-for "#results"    # wait for a selector (up to --timeout)
 *   node browser-nav.ts <url> --settle 3000            # extra settle time (default 800ms)
 *   node browser-nav.ts <url> --text 1500              # also print page text
 *
 * Chrome is started automatically if it is not already running.
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
const url = args.rest[0];

if (!url) {
  console.log(
    "Usage: node browser-nav.ts <url> [--new] [--tab <n|substr>] [--wait-for <css>] " +
      "[--settle <ms>] [--timeout <ms>] [--text <chars>]",
  );
  process.exit(1);
}

const textChars = hasFlag(args, "text") ? Number(flagValue(args, "text") ?? 1200) : 0;

await runBrowserCommand(async (browser) => {
  const page = await pickOrOpenPage(browser, {
    newTab: hasFlag(args, "new"),
    tab: flagValue(args, "tab"),
  });
  const timeout = numFlag(args, "timeout", 30_000);

  await gotoSettled(page, url, { timeoutMs: timeout });
  const notes = await settlePage(page, {
    waitFor: flagValue(args, "wait-for"),
    settleMs: numFlag(args, "settle", 800),
    timeoutMs: timeout,
  });

  const title = await page.title().catch(() => "");
  console.log(`✓ ${page.url()}`);
  if (title) console.log(`  title: ${title}`);
  for (const note of notes) console.error(`⚠ ${note}`);
  await warnIssues(page);

  if (textChars > 0) {
    const text = await page.evaluate(() => document.body?.innerText ?? "");
    console.log(
      text
        .trim()
        .replace(/\n{3,}/g, "\n\n")
        .slice(0, textChars),
    );
  }

  rememberTab(page);
  noteTab(page);
});
