/**
 * Capture a screenshot of the current viewport.
 *
 * Usage: node browser-screenshot.ts [output.png]
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { getActivePage, runBrowserCommand } from "./shared.ts";

const outputPath = process.argv[2] ?? path.join("/tmp", `screenshot-${randomUUID()}.png`);

await runBrowserCommand(async (browser) => {
  const page = await getActivePage(browser);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(path.resolve(outputPath));
});
