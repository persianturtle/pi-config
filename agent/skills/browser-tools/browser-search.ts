/**
 * One-shot Google search: navigate, wait for the AI Overview, print it.
 *
 * Usage:
 *   node browser-search.ts "What is the latest version of TanStack Start?"
 *   node browser-search.ts "<query>" --limit 6000     # more text (default 4000 chars)
 *   node browser-search.ts "<query>" --timeout 30     # slower connection
 *   node browser-search.ts "<query>" --new            # in a new tab
 *   node browser-search.ts "<query>" --links          # also list external link hrefs
 *
 * Phrase it as a real question: keyword-style queries often skip the AI Overview,
 * and this script then says "no AI Overview" instead of printing half a page.
 *
 * Requires headed Chrome (the default). If Google answers with the "unusual
 * traffic" check, this exits 2 and says so — it will never print a CAPTCHA as an answer.
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
const query = args.rest[0];

if (!query) {
  console.log(
    'Usage: node browser-search.ts "<question-style query>" [--limit <chars>] [--timeout <s>] [--new] [--tab <n>] [--links]',
  );
  process.exit(1);
}

const limit = numFlag(args, "limit", 4000);
const wantLinks = hasFlag(args, "links");
const timeoutSeconds = numFlag(args, "timeout", 15);
const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

await runBrowserCommand(async (browser) => {
  const page = await pickOrOpenPage(browser, {
    newTab: hasFlag(args, "new"),
    tab: flagValue(args, "tab"),
  });

  await gotoSettled(page, searchUrl, { timeoutMs: 30_000 });
  // The overview renders after the page shell; wait before declaring it absent.
  await page
    .waitForSelector("#m-x-content", { timeout: timeoutSeconds * 1000, state: "visible" })
    .catch(() => {});
  await settlePage(page, { settleMs: 1500 });

  rememberTab(page);
  noteTab(page);

  if (page.url().includes("/sorry/")) {
    console.error(
      "✗ Google answered with the bot check (/sorry). That is bot detection, not a dead network.",
    );
    console.error(
      "  Fix: node browser-start.ts --restart   (keep it headed) — then retry once, slower.",
    );
    console.error(
      "  Still blocked? The IP is flagged: use primary sources (browser-content.ts on the docs/repo).",
    );
    process.exit(2);
  }

  const extracted = await page.evaluate((charLimit: number) => {
    // Take the whole container in DOM order. Selecting "answer blocks" by class
    // reorders paragraphs and drops the opening lines — worse than printing raw.
    const container = document.getElementById("m-x-content");
    const raw = container ? (container as HTMLElement).innerText.trim() : "";
    const labelled = /^AI (Overview|Mode|answer|response)/i.test(raw);

    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
      .map((anchor) => ({
        title: (anchor.innerText || "").trim().replace(/\s+/g, " ").slice(0, 100),
        url: anchor.href,
      }))
      .filter((link) => /^https?:/.test(link.url) && !link.url.includes("google.com"))
      .filter((link) => link.title.length > 6)
      .slice(0, 10);

    return {
      overview: raw.slice(0, charLimit),
      hasOverview: labelled && raw.length > 120,
      links,
      body: (document.body?.innerText ?? "").trim().slice(0, 1200),
    };
  }, limit);

  console.log(`Q: ${query}`);
  console.log(`URL: ${page.url()}`);
  await warnIssues(page);

  console.log("\n--- AI OVERVIEW ---");
  if (extracted.hasOverview) {
    console.log(extracted.overview.replace(/^AI (Overview|Mode|answer|response)[:\s]*/i, ""));
  } else {
    console.log(
      "(No AI Overview on this page. Printing page text — verify it is not a consent/bot wall, " +
        "then re-ask as a question or use browser-ask.ts.)",
    );
    console.log(extracted.body);
  }

  if (wantLinks) {
    console.log("\n--- LINKS ---");
    if (extracted.links.length === 0) {
      console.log(
        "(No external hrefs in this DOM — Google renders results without them here. " +
          "Open cited pages directly: node browser-content.ts <url>)",
      );
    }
    for (const link of extracted.links) console.log(`• ${link.title}\n  ${link.url}`);
  }
});
