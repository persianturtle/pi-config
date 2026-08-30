/**
 * Navigate to a URL and extract the page's readable text content.
 * Uses the rendered DOM (document.body.innerText) — works on JS-heavy pages.
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
  console.log("Usage: node browser-content.ts <url> | --current");
  console.log("\nExtracts readable text content (innerText) from a page.");
  console.log("\nExamples:");
  console.log("  node browser-content.ts https://en.wikipedia.org/wiki/OCaml");
  console.log("  node browser-content.ts --current");
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
