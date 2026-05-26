/**
 * Navigate to a URL and extract readable content as markdown.
 * Uses browser DOM traversal to convert HTML to markdown.
 *
 * Usage: node browser-content.ts <url>
 *
 * For pages currently loaded in the browser (no URL argument needed):
 *   node browser-content.ts --current
 */
import type { Page } from "playwright";
import { createPage, getActivePage, runBrowserCommand } from "./shared.ts";

const urlOrFlag = process.argv[2];

if (!urlOrFlag) {
  console.log("Usage: node browser-content.ts <url>");
  console.log("\nExtracts readable content from a URL as markdown.");
  console.log("\nExamples:");
  console.log("  node browser-content.ts https://example.com");
  console.log("  https://en.wikipedia.org/wiki/OCaml");
  process.exit(1);
}

await runBrowserCommand(async (browser) => {
  let page: Page;

  if (urlOrFlag === "--current") {
    page = await getActivePage(browser);
  } else {
    page = await createPage(browser);

    await page.goto(urlOrFlag);
  }

  const title = await page.title();
  const content = await page.evaluate(() =>
    document.body.innerText.trim().replace(/\n{3,}/g, "\n\n"),
  );

  console.log(`URL: ${page.url()}`);
  if (title) console.log(`Title: ${title}`);
  console.log("Content:");
  console.log(content);
});
