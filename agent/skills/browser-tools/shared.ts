/**
 * Shared plumbing for the browser-* scripts: connect (with auto-recovery),
 * pick the right tab, wait for a page to settle, and flag pages whose content
 * is a bot wall or a logged-out shell rather than real data.
 */
import fs from "node:fs";
import type { Browser, Page } from "playwright";
import {
  CACHE_DIR,
  CDP_PORT,
  connectChrome,
  isPortOpen,
  killOurChrome,
  launchChrome,
  readMode,
} from "./chrome.ts";

/** Standard viewport (CSS pixels) for every page we touch. */
export const VIEWPORT = { width: 1512, height: 827 };

const ACTIVE_TAB_FILE = `${CACHE_DIR}/active-tab.json`;

export type RunOptions = {
  /** `1`-based tab index, or a substring matched against tab URL/title. */
  tab?: string;
  /** Open a new tab instead of using the current one. */
  newTab?: boolean;
};

/** Settle time after a navigation, in ms. Override with --settle. */
export const DEFAULT_SETTLE = Number(process.env.BROWSER_TOOLS_SETTLE ?? 800);

const autoStartEnabled = process.env.BROWSER_TOOLS_NO_AUTOSTART !== "1";

/* ------------------------------------------------------- serialization lock */

const LOCK_FILE = `${CACHE_DIR}/lock`;
const LOCK_WAIT_MS = Number(process.env.BROWSER_TOOLS_LOCK_WAIT ?? 120_000);
const HELD_TOO_LONG_MS = 5 * 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type LockInfo = { pid?: number; at?: number };

function readLock(): LockInfo | undefined {
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, "utf-8")) as LockInfo;
  } catch {
    return undefined;
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function canTakeLock(info: LockInfo | undefined): boolean {
  if (info === undefined) return true; // unreadable / half-written
  if (typeof info.pid !== "number" || info.pid === process.pid) return true;
  if (!pidAlive(info.pid)) return true; // crashed mid-command
  const age = typeof info.at === "number" ? Date.now() - info.at : Number.POSITIVE_INFINITY;
  return age > HELD_TOO_LONG_MS;
}

/**
 * One Chrome means one shared tab, so two browser commands issued in parallel used to
 * navigate over each other and report the *other* page's content back — a wrong answer
 * that looked right. Commands now queue on a lockfile instead of racing. Override with
 * BROWSER_TOOLS_NO_LOCK=1 when you really do want concurrency (at your own risk).
 */
async function withLock<T>(action: () => Promise<T>): Promise<T> {
  if (process.env.BROWSER_TOOLS_NO_LOCK === "1") return action();

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const deadline = Date.now() + LOCK_WAIT_MS;
  let announced = false;

  for (;;) {
    try {
      const handle = fs.openSync(LOCK_FILE, "wx"); // atomic: EEXIST when held
      fs.writeSync(handle, JSON.stringify({ pid: process.pid, at: Date.now() }));
      fs.closeSync(handle);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (Date.now() > deadline) {
        const holder = readLock()?.pid;
        throw new Error(
          `another browser command has the lock${holder ? ` (pid ${holder})` : ""} after ${
            LOCK_WAIT_MS / 1000
          }s — delete ${LOCK_FILE} if that process is gone`,
        );
      }
      if (canTakeLock(readLock())) {
        fs.rmSync(LOCK_FILE, { force: true });
        continue;
      }
      if (!announced) {
        console.error("⏳ another browser command is running — queuing behind it…");
        announced = true;
      }
      await sleep(150);
    }
  }

  try {
    return await action();
  } finally {
    if (readLock()?.pid === process.pid) fs.rmSync(LOCK_FILE, { force: true });
  }
}

/* ------------------------------------------------------------------ connect */

async function connectOnce(timeoutMs = 10_000): Promise<Browser> {
  return connectChrome(timeoutMs);
}

/**
 * Connect to Chrome. If the debug port is dead, restart Chrome in the mode it was last
 * started in and retry once — so `ECONNREFUSED` stops being a dead end (memory guards
 * and idle timeouts kill Chrome between commands all the time).
 */
export async function connect(): Promise<Browser> {
  if (!(await isPortOpen())) {
    if (!autoStartEnabled) throw new Error(`nothing on :${CDP_PORT} (auto-start disabled)`);
    console.error("↻ Chrome not running on :9222 — starting it (one moment)…");
    await launchChrome(readMode());
    return connectOnce();
  }
  try {
    return await connectOnce();
  } catch (error) {
    if (!autoStartEnabled) throw error;
    console.error("↻ Chrome is on :9222 but not answering — restarting it…");
    killOurChrome();
    await sleep(400);
    await launchChrome(readMode());
    return connectOnce();
  }
}

async function runExclusive<T>(action: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await connect();
  try {
    return await action(browser);
  } finally {
    // Disconnects the CDP client; the Chrome process itself keeps running.
    await browser.close().catch(() => {});
  }
}

/** Serialized + guaranteed-disconnect command wrapper, with readable failures. */
export async function runBrowserCommand<T>(action: (browser: Browser) => Promise<T>): Promise<T> {
  try {
    return await withLock(() => runExclusive(action));
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    console.error("✗ Command failed:", message.split("\n").slice(0, 4).join("\n"));
    if (/ECONNREFUSED|timed out|lock|not answering|would not start/i.test(message)) {
      console.error(
        `  Fix: node browser-start.ts   (or check: curl -s 127.0.0.1:${CDP_PORT}/json/version)`,
      );
    }
    process.exit(1);
  }
}

/* -------------------------------------------------------------------- tabs */

/**
 * For "what is open?" commands: if nothing is listening on :9222 it reports that
 * instead of launching a browser just to say so. Queues on the same lock.
 */
export async function runIfRunning<T>(
  action: (browser: Browser) => Promise<T>,
  onNoChrome: () => void,
): Promise<void> {
  if (!(await isPortOpen())) {
    onNoChrome();
    return;
  }
  await runBrowserCommand(action);
}

/** The tab the previous command used, if we recorded one. */
export function lastUsedUrl(): string | null {
  try {
    const raw = JSON.parse(fs.readFileSync(ACTIVE_TAB_FILE, "utf-8")) as { url?: string };
    return typeof raw.url === "string" ? raw.url : null;
  } catch {
    return null;
  }
}

/** Remember which tab this command used, so the next one lands on the same tab. */
export function rememberTab(page: Page): void {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(ACTIVE_TAB_FILE, JSON.stringify({ url: page.url(), at: Date.now() }));
  } catch {
    // Bookkeeping only — never fail a command over it.
  }
}

function describeTabs(pages: Page[]): string {
  return pages.map((page, index) => `${index + 1}: ${page.url().slice(0, 90)}`).join("\n     ");
}

/**
 * Resolve the tab to work on:
 *   --tab 2        → tab number (as listed by browser-tabs.ts)
 *   --tab github   → first tab whose URL or title contains the string
 *   otherwise      → the tab the previous command used, else the last-opened tab
 */
export async function pickPage(browser: Browser, options: RunOptions = {}): Promise<Page> {
  const contexts = browser.contexts();
  const context = contexts[0];
  if (!context) throw new Error("No browser contexts open — run browser-start.ts first.");
  const pages = context.pages().filter((page) => !page.url().startsWith("devtools://"));
  if (pages.length === 0) {
    throw new Error("No tabs open — run browser-nav.ts <url> first.");
  }

  let page: Page | undefined;
  const selector = options.tab;
  if (selector !== undefined) {
    if (/^\d+$/.test(selector)) {
      const index = Number(selector) - 1;
      page = pages[index];
      if (!page) {
        throw new Error(
          `--tab ${selector}: there are only ${pages.length} tabs.\n     ${describeTabs(pages)}`,
        );
      }
    } else {
      page = pages.find((candidate) => candidate.url().includes(selector));
      if (!page) {
        const titles = await Promise.all(pages.map((candidate) => candidate.title()));
        page = pages.find((_, index) => titles[index]?.includes(selector));
      }
      if (!page) {
        throw new Error(`--tab ${selector}: no match.\n     ${describeTabs(pages)}`);
      }
    }
  } else if (options.newTab) {
    page = await context.newPage();
  } else {
    const previous = lastUsedUrl();
    page = pages.find((candidate) => candidate.url() === previous) ?? pages[pages.length - 1];
    if (!page) throw new Error("Could not resolve an active tab.");
  }

  await page.setViewportSize(VIEWPORT).catch(() => {});
  return page;
}

/** Header line telling you which tab a command ran against (stderr, so `| head` stays clean). */
export function noteTab(page: Page): void {
  const pages = page
    .context()
    .pages()
    .filter((candidate) => !candidate.url().startsWith("devtools://"));
  const index = pages.indexOf(page) + 1;
  console.error(`↪ tab ${index > 0 ? index : "?"}: ${page.url().slice(0, 100)}`);
}

/* ------------------------------------------------------------------- args */

export type Args = { rest: string[]; flags: Map<string, string | true> };

/** Parse `--name value`, `--name=value`, and bare flags; everything else is positional. */
export function parseArgs(argv: string[]): Args {
  const rest: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("--")) {
      rest.push(arg);
      continue;
    }
    const equals = arg.indexOf("=");
    if (equals > 0) {
      flags.set(arg.slice(2, equals), arg.slice(equals + 1));
      continue;
    }
    const name = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      flags.set(name, next);
      i += 1;
    } else {
      flags.set(name, true);
    }
  }
  return { rest, flags };
}

export function hasFlag(args: Args, name: string): boolean {
  return args.flags.has(name);
}

export function flagValue(args: Args, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Numeric flag with a default (also accepts `--name=123`). */
export function numFlag(args: Args, name: string, fallback: number): number {
  const raw = flagValue(args, name);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/* ------------------------------------------------- page health / readings */

/**
 * Wait for a page to stop churning before it gets read: optional selector,
 * then a capped network-idle wait, then a fixed settle. This replaces the
 * hand-written `sleep 4` that used to sit between every nav and eval call.
 */
export async function settlePage(
  page: Page,
  options: { waitFor?: string; settleMs?: number; timeoutMs?: number } = {},
): Promise<string[]> {
  const notes: string[] = [];
  const timeoutMs = options.timeoutMs ?? 30_000;
  if (options.waitFor !== undefined) {
    try {
      await page.waitForSelector(options.waitFor, { timeout: timeoutMs, state: "visible" });
    } catch {
      notes.push(`--wait-for "${options.waitFor}" never appeared (waited ${timeoutMs}ms)`);
    }
  }
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  const settle = options.settleMs ?? DEFAULT_SETTLE;
  if (settle > 0) await new Promise((resolve) => setTimeout(resolve, settle));
  return notes;
}

/**
 * Navigate, retrying when Chrome aborts the navigation. An abort usually means the
 * tab still had a previous navigation in flight (back-to-back commands, or the site
 * self-redirecting) — transient, not a dead site. Without a retry it surfaces as a
 * hard error and the caller ends up reading the *previous* page.
 */
export async function gotoSettled(
  page: Page,
  url: string,
  options: { timeoutMs?: number; retries?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const retries = options.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      return;
    } catch (error) {
      lastError = error;
      const aborted = /ERR_ABORTED|navigation (was )?(cancelled|aborted)/i.test(String(error));
      if (!aborted || attempt === retries) break;
      console.error(`↻ navigation aborted (tab still busy) — retry ${attempt + 1}/${retries}`);
      await sleep(600);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Like pickPage, but opens a tab if Chrome has none (after a restart, say). */
export async function pickOrOpenPage(browser: Browser, options: RunOptions = {}): Promise<Page> {
  try {
    return await pickPage(browser, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("No tabs open")) throw error;
    const context = browser.contexts()[0];
    if (!context) throw error;
    console.error("↻ no tabs open — opening one");
    const page = await context.newPage();
    await page.setViewportSize(VIEWPORT).catch(() => {});
    return page;
  }
}

export type Issue = { kind: "bot-wall" | "auth" | "empty"; message: string };

/**
 * Detect pages whose text is NOT the data you asked for: bot checks, cookie
 * walls, and logged-out shells. Without this, a CAPTCHA or a 404-while-logged-out
 * gets read as if it were the answer.
 */
export async function detectIssues(page: Page): Promise<Issue[]> {
  const issues: Issue[] = [];
  const url = page.url();
  const snapshot = await page
    .evaluate(() => ({
      text: document.body?.innerText ?? "",
      title: document.title,
      hasPassword: Boolean(document.querySelector('input[type="password"]')),
    }))
    .catch(() => ({ text: "", title: "", hasPassword: false }));
  const head = `${snapshot.title}\n${snapshot.text.slice(0, 1200)}`;

  if (url.includes("/sorry/")) {
    issues.push({
      kind: "bot-wall",
      message:
        "Google redirected to /sorry — that is a bot check, not a dead network. " +
        "Retry headed (`node browser-start.ts --restart`) and go slower; if it repeats, the IP is flagged.",
    });
    return issues;
  }
  if (
    /just a moment|verify you are human|challenges?\.cloudflare|cf-browser-verification|unusual traffic|not a robot/i.test(
      head,
    )
  ) {
    issues.push({
      kind: "bot-wall",
      message:
        "Anti-bot interstitial (Cloudflare-style) — this text is NOT page content. " +
        "Headed Chrome usually clears it; a headless run will not.",
    });
    return issues;
  }
  if (/access denied|request blocked|incident id|pardon our interruption/i.test(head)) {
    issues.push({
      kind: "bot-wall",
      message: "Edge/WAF block page — treat this text as a block, not content.",
    });
  }

  // Logged-out detection where we can prove it, then a conservative heuristic.
  const cookies = await page
    .context()
    .cookies(url)
    .catch(() => []);
  const ghLogin = cookies.find((cookie) => cookie.name === "logged_in");
  if (ghLogin !== undefined && /^(no|false|0)$/i.test(ghLogin.value)) {
    issues.push({
      kind: "auth",
      message:
        'GitHub says NOT logged in (cookie logged_in=no). Private repos render as "Page not found" ' +
        "when logged out, so a 404 here proves nothing. Log in once in the Chrome window, or use git/gh.",
    });
  }
  if (ghLogin !== undefined && /^(yes|true|1)$/i.test(ghLogin.value)) {
    return issues;
  }
  if (snapshot.hasPassword && /(sign in|log in|log in to continue)/i.test(head)) {
    issues.push({
      kind: "auth",
      message:
        "Page looks like a sign-in wall (password field present) — content may be missing, not absent.",
    });
  }
  return issues;
}

/** Print detections as `⚠` lines (stderr) so they survive `| head` pipelines. */
export async function warnIssues(page: Page): Promise<void> {
  for (const issue of await detectIssues(page)) {
    console.error(`⚠ [${issue.kind}] ${issue.message}`);
  }
}

export { CDP_PORT };
