/**
 * Evaluate JavaScript in the active tab.
 *
 * Usage:
 *   node browser-eval.ts '<javascript code>'
 *   node browser-eval.ts <file_path>
 *
 * Code runs in the page context, wrapped in an async function, so you can
 * use `await` and `return` at the top level:
 *   node browser-eval.ts 'await new Promise(r => setTimeout(r, 500)); return document.title'
 *
 * Tip: Use `return` to send data back (a bare expression without `return`
 *      yields undefined). Strings are printed as-is; other values are
 *      pretty-printed with JSON.stringify.
 */

import fs from "node:fs";
import { getActivePage, runBrowserCommand } from "./shared.ts";

const input = process.argv[2];

if (!input) {
  console.log("Usage: node browser-eval.ts '<javascript code>'");
  console.log("       node browser-eval.ts <file_path>");
  console.log("\nCode runs in the page context, wrapped in an async function:");
  console.log("  - Use `await` at the top level (no IIFE needed)");
  console.log("  - Use `return` to send a value back (bare expressions yield undefined)");
  console.log("  - Strings print as-is; objects are pretty-printed as JSON");
  process.exit(1);
}

const code = fs.existsSync(input) ? fs.readFileSync(input, "utf-8") : input;

await runBrowserCommand(async (browser) => {
  const page = await getActivePage(browser);
  // Wrap in an async IIFE so `await` and `return` work at the top level.
  const source = `(async () => {\n${code}\n})();`;
  const result = await page.evaluate(source);
  if (typeof result === "string") {
    console.log(result);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
});
