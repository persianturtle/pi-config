/**
 * Evaluate JavaScript in a tab.
 *
 * Usage:
 *   node browser-eval.ts 'return document.title'
 *   node browser-eval.ts 'document.title'                  # bare expression is auto-returned
 *   node browser-eval.ts ./scripts/probe.js                # a file works too
 *   echo 'return document.title' | node browser-eval.ts -  # or pipe it in (no quoting pain)
 *
 * Flags: --tab <n|substr>  which tab;  --wait <ms>  pause before running;  --quiet  hide tab header
 *
 * Code runs inside an async function: top-level `await` and `return` work, no IIFE needed.
 * Strings print as-is; anything else is pretty-printed as JSON.
 */
import fs from "node:fs";
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
const input = args.rest[0];

if (!input) {
  console.log(
    "Usage: node browser-eval.ts '<javascript>' | <file.js> | - [--tab <n|substr>] [--wait <ms>]",
  );
  console.log(
    "\nRemember `return` — a bare expression is auto-returned, but multi-statement code is not.",
  );
  process.exit(1);
}

function readCode(source: string): string {
  if (source === "-") {
    if (process.stdin.isTTY) {
      console.error("✗ '-' means read code from stdin, but nothing was piped in.");
      process.exit(1);
    }
    const piped = fs.readFileSync(0, "utf-8").trim();
    if (!piped) {
      console.error("✗ stdin was empty.");
      process.exit(1);
    }
    return piped;
  }
  if (fs.existsSync(source)) return fs.readFileSync(source, "utf-8");
  return source;
}

const code = readCode(input);

/**
 * `document.title` → `return document.title`. Only for short single expressions:
 * anything with a `;`, a declaration keyword, or an existing `return` is left alone.
 */
function toSource(script: string): string {
  const trimmed = script.trim();
  const looksLikeExpression =
    !/\breturn\b/.test(trimmed) &&
    !trimmed.includes(";") &&
    !/^(const|let|var|if|for|while|function|class|try|throw|import)\b/.test(trimmed);
  const body = looksLikeExpression ? `return ${trimmed};` : script;
  return `(async () => {\n${body}\n})();`;
}

await runBrowserCommand(async (browser) => {
  const page = await pickPage(browser, { tab: flagValue(args, "tab") });
  const wait = numFlag(args, "wait", 0);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));

  const result = await page.evaluate(toSource(code));

  if (!hasFlag(args, "quiet")) noteTab(page);
  if (typeof result === "string") {
    console.log(result);
  } else if (result === undefined) {
    console.log("undefined");
    console.error(
      "↪ undefined: add `return`, or wrap multiple statements so the last one returns.",
    );
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
});
