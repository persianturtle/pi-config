/**
 * Evaluate JavaScript in the active tab.
 *
 * Usage:
 *   node browser-eval.ts '<javascript code>'
 *   node browser-eval.ts <file_path>
 *
 * Code is executed in the page context and the last expression value is returned.
 * For multi-statement code with `await`, wrap in an async IIFE:
 *   (async () => { await someOp(); return result; })()
 *
 * You can also pass a path to a .js file: npx tsx browser-eval.ts ./scripts/my-script.js
 *
 * Tip: Use `return` (not console.log) to send data back to the terminal.
 *      Use JSON.stringify() for complex objects.
 */

import fs from "node:fs";
import { getActivePage, runBrowserCommand } from "./shared.ts";

const input = process.argv[2];

if (!input) {
  console.log("Usage: node  browser-eval.ts '<javascript code>'");
  console.log("       node  browser-eval.ts <file_path>");
  console.log("\nCode runs in the page context — last expression is returned.");
  console.log(
    "For multi-statement code with `await`, wrap in an async IIFE: (async () => { ... })()",
  );
  console.log("Return values via `return` and wrap complex results in JSON.stringify().");
  process.exit(1);
}

const code = fs.existsSync(input) ? fs.readFileSync(input, "utf-8") : input;

await runBrowserCommand(async (browser) => {
  const page = await getActivePage(browser);
  const result = await page.evaluate(code);
  console.log(JSON.stringify(result, null, 2));
});
