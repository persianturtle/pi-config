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
 * Uses the browser-tools skill's playwright and the installed Google Chrome, so
 * it needs `npm install` to have been run in ~/.pi/agent/skills/browser-tools.
 */
import { mkdirSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    clip: { type: "string", default: "1680x1000" },
    zoom: { type: "string", default: "1,1.2,1.45" },
    wait: { type: "string", default: "1500" },
    out: { type: "string", default: "build/probe" },
    ready: { type: "string" }, // CSS selector that means "the app is interactive"
    scale: { type: "string", default: "1.14" },
  },
});

const { url, out, ready } = args;
const [cw, ch] = args.clip.split("x").map(Number);
const zooms = args.zoom.split(",").map(Number);
const wait = Number(args.wait);
const scale = Number(args.scale);

const PLAYWRIGHT = `${process.env.HOME}/.pi/agent/skills/browser-tools/node_modules/playwright/index.mjs`;
const { chromium } = await (import(PLAYWRIGHT) as Promise<typeof import("playwright")>).catch(
  () => {
    console.error(
      "playwright not found — run `npm install` in ~/.pi/agent/skills/browser-tools first.",
    );
    process.exit(2);
  },
);

mkdirSync(out, { recursive: true });

// The installed Chrome, not playwright's own download: nothing extra to install.
const browser = await chromium.launch({ channel: "chrome" });

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
