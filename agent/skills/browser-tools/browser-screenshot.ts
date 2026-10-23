/**
 * Screenshot the current viewport.
 *
 * Usage:
 *   node browser-screenshot.ts                       # → /tmp/screenshot-<uuid>.png
 *   node browser-screenshot.ts /tmp/state.png
 *   node browser-screenshot.ts --full                 # whole scrollable page
 *   node browser-screenshot.ts --tab 2 --wait 2000    # which tab, and settle time first
 *
 * Prefer DOM inspection (browser-eval.ts) over screenshots for "what's on the page".
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  flagValue,
  hasFlag,
  noteTab,
  numFlag,
  parseArgs,
  pickPage,
  runBrowserCommand,
} from "./shared.ts";

const args = parseArgs(process.argv.slice(2));
const outputPath = args.rest[0] ?? path.join("/tmp", `screenshot-${randomUUID()}.png`);

await runBrowserCommand(async (browser) => {
  const page = await pickPage(browser, { tab: flagValue(args, "tab") });
  const wait = numFlag(args, "wait", 1000);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  // Make sure we capture a freshly painted frame, not a stale background-tab surface.
  await page.bringToFront().catch(() => {});

  await page.screenshot({ path: outputPath, fullPage: hasFlag(args, "full") });
  noteTab(page);
  console.log(path.resolve(outputPath));
});
