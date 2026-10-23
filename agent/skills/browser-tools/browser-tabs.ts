/**
 * List the tabs in the automation Chrome (and which one other commands will hit).
 *
 * Usage:
 *   node browser-tabs.ts
 *   node browser-tabs.ts --close 2        # close tab 2
 *   node browser-tabs.ts --close all      # close every tab (Chrome stays up)
 */
import type { Page } from "playwright";
import { flagValue, hasFlag, lastUsedUrl, parseArgs, runIfRunning, VIEWPORT } from "./shared.ts";

const args = parseArgs(process.argv.slice(2));
const closeArg = flagValue(args, "close");

await runIfRunning(
  async (browser) => {
    const context = browser.contexts()[0];
    const pages = (context?.pages() ?? []).filter((page) => !page.url().startsWith("devtools://"));
    const previous = lastUsedUrl();

    if (closeArg !== undefined) {
      const wanted = closeArg === "all" ? pages : [pages[Number(closeArg) - 1]];
      const targets = wanted.filter((page): page is Page => page !== undefined && !page.isClosed());
      for (const page of targets) await page.close().catch(() => {});
      console.log(`✓ Closed ${targets.length} tab(s); ${pages.length - targets.length} left.`);
      return;
    }

    if (pages.length === 0) {
      console.log("Chrome is up but has no tabs. Next: node browser-nav.ts <url>");
      return;
    }

    console.log(`Chrome: ${pages.length} tab(s), viewport ${VIEWPORT.width}x${VIEWPORT.height}`);
    for (const [index, page] of pages.entries()) {
      const title = (await page.title().catch(() => "")).slice(0, 40);
      const mark = page.url() === previous ? "  ← commands hit this tab" : "";
      console.log(`  ${index + 1}. ${title || "(no title)"}  ${page.url()}${mark}`);
    }
    if (!hasFlag(args, "quiet")) {
      console.log("Aim another command at a tab with --tab <number> or --tab <url-substring>.");
    }
  },
  () => {
    console.log("Chrome is not running on :9222. Start it with: node browser-start.ts");
  },
);
