/**
 * Footage framing probe. Answers one question before you record anything:
 * does the thing you want to show fit in the frame without scrolling?
 *
 *   node scripts/frameprobe.ts --url http://localhost:3000 --clip 1680x1000 \
 *       --zoom 1,1.15,1.45 [--ready 'CSS'] [--wait 1500] [--out build/probe]
 *
 * Pass --ready when the interesting state needs loading. A loading skeleton is
 * short, so it "fits" at any zoom: without the marker the verdict describes
 * whatever happens to be on screen, and this script exits non-zero rather than
 * reporting a comfortable answer.
 *
 * The bug this exists for: a capture window zoomed to make text bigger makes the
 * page taller than the window, so the recorder captures a scrolling window onto
 * it. Every mid-action frame is then blank gutter with one stray field in it.
 * Bigger type is not worth that; shrink the source instead of zooming it.
 *
 * Requires playwright (npm install playwright, or reuse ~/.pi/agent/skills/browser-tools).
 */
/** With a fallback the result is always a string, so callers do not need guards. */
function arg(name: string): string | undefined;
function arg(name: string, fallback: string): string;
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
}

const url = arg("url", "http://localhost:3000");
const [cw, ch] = (arg("clip", "1680x1000") as string).split("x").map(Number);
const zooms = (arg("zoom", "1,1.2,1.45") as string).split(",").map(Number);
const wait = Number(arg("wait", "1500"));
const out = arg("out", "build/probe");
const ready = arg("ready"); // CSS selector that means "the app is interactive"
const scale = Number(arg("scale", "1.14"));

let chromium: typeof import("playwright").chromium | undefined;
const candidates = [
  "playwright",
  "playwright-core",
  // browser-tools already ships playwright — reuse it instead of asking for a second copy
  `${process.env.HOME}/.pi/agent/skills/browser-tools/node_modules/playwright/index.mjs`,
  `${process.env.HOME}/.pi/agent/skills/browser-tools/node_modules/playwright-core/index.mjs`,
];
for (const spec of candidates) {
  try {
    const mod = (await import(spec)) as typeof import("playwright");
    if (mod.chromium) {
      chromium = mod.chromium;
      break;
    }
  } catch {
    /* try the next place */
  }
}
if (!chromium) {
  console.error(
    "no playwright found. Either `cd ~/.pi/agent/skills/explainer-video && npm install`, " +
      "or install the browser-tools skill, which already ships it.",
  );
  process.exit(2);
}

const { mkdirSync, existsSync } = await import("node:fs");
mkdirSync(out, { recursive: true });

const exe =
  process.env.EXE ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;

const browser = await chromium.launch({
  executablePath: existsSync(exe) ? exe : undefined,
});

const rows: string[] = [];
let unverified = false; // the ready marker never appeared, so nothing here is trustworthy
for (const [i, zoom] of zooms.entries()) {
  const ctx = await browser.newContext({
    viewport: { width: cw, height: ch },
    deviceScaleFactor: scale,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load" });
  if (ready) {
    try {
      // attached, not visible: a data-* marker may exist while styled invisible,
      // and "visible" then times out on a page that is actually ready
      await page.waitForSelector(ready, { timeout: 20_000, state: "attached" });
    } catch {
      unverified = true;
    }
  }
  if (zoom !== 1) {
    await page.addStyleTag({ content: `main{zoom:${zoom}} ::-webkit-scrollbar{display:none}` });
  }
  await page.waitForTimeout(wait);
  const m = await page.evaluate(() => ({
    page: document.documentElement.scrollHeight,
    view: innerHeight,
    main: Math.round(document.querySelector("main")?.getBoundingClientRect().height ?? 0),
  }));
  const fits = m.page <= m.view + 2;
  const file = `${out}/probe-${i}-zoom${zoom}.png`;
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: cw, height: ch } });
  rows.push(
    `${fits ? "FITS  " : "SCROLL"}  zoom ${String(zoom).padEnd(5)} ${cw}x${ch}  page ${m.page}px in ${m.view}px  → ${file}`,
  );
  if (fits) {
    rows.push(`        ^ start here: nothing scrolls, so nothing renders as blank gutter`);
    break;
  }
  rows.push(`        scrolls by ${m.page - m.view}px — this framing will lose content mid-action`);
  await ctx.close();
}

await browser.close();

if (unverified) {
  console.log(rows.join("\n"));
  console.error(
    `\n⚠ "${ready}" never appeared at ${url}, so these numbers describe a loading skeleton, ` +
      "not the app — a skeleton always fits.\n  Fix the state first (session, seed data, a real route) or pass a " +
      "selector that only exists once\n  the page is interactive, then re-run. Frames are in " +
      `${out} — look at one before believing any of this.`,
  );
  process.exit(1);
}

console.log(rows.join("\n"));
