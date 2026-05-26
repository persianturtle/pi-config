/**
 * Navigate to a URL in the active tab, or open it in a new tab.
 *
 * Usage: node browser-nav.ts <url> [--new]
 *
 */
import { createPage, getActivePage, runBrowserCommand } from "./shared.ts";

const url = process.argv[2];
const newTab = process.argv.includes("--new");

if (!url) {
  console.log("Usage: node  browser-nav.ts <url> [--new]");
  console.log("\nOptions:");
  console.log("  --new       Open in a new tab instead of current tab");
  console.log("\nExamples:");
  console.log("  browser-nav.ts https://example.com");
  process.exit(1);
}

await runBrowserCommand(async (browser) => {
  const page = newTab ? await createPage(browser) : await getActivePage(browser);
  await page.goto(url);
  console.log(`✓ Navigated to ${url}${newTab ? " (new tab)" : ""}}`);
});
