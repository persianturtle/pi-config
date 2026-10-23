/**
 * Chrome launch + connect helpers shared by every `browser-*` script.
 *
 * Three facts this file exists to handle:
 *
 * 1. Chrome binds the debug port to **IPv4 only**, and `localhost` can resolve to
 *    `::1` first — which shows up as `connect ECONNREFUSED ::1:9222`. Always use
 *    the `127.0.0.1` literal (CDP_URL below).
 * 2. Chrome 136+ ignores `--remote-debugging-port` on a *default* profile dir
 *    ("DevTools remote debugging requires a non-default data directory"), so we can
 *    never attach to your everyday Chrome. We launch our own instance instead.
 * 3. To still get your logins, we snapshot your real profile's `Cookies` DB into
 *    that private dir (verified working: a copied GitHub session reads private repos).
 *    Reading `~/Library/Application Support/Google/Chrome` is macOS-protected and
 *    works *sometimes* — so it is probed at runtime and always reported, never
 *    assumed either way.
 */
import { execSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import { type Browser, chromium } from "playwright";

export const CDP_PORT = 9222;
export const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;

export const CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const CACHE_DIR = `${process.env.HOME ?? ""}/.cache/browser-tools`;
export const PROFILE_DIR = `${CACHE_DIR}/profile`;
const STATE_FILE = `${CACHE_DIR}/state.json`;
const CHROME_ROOT = `${process.env.HOME ?? ""}/Library/Application Support/Google/Chrome`;

/** The one file that carries session logins. Passwords (`Login Data`) are left alone. */
const COOKIES_FILE = "Cookies";

export type Mode = { headed: boolean; profile: string };

export type LaunchOptions = Partial<Mode> & {
  /** Wipe the automation profile and start anonymous (skips the cookie snapshot). */
  fresh?: boolean;
  /** Keep whatever session state the automation profile already has. */
  noCopy?: boolean;
};

export function readMode(): Mode {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as Partial<Mode>;
    return { headed: raw.headed ?? true, profile: raw.profile ?? "Default" };
  } catch {
    return { headed: true, profile: "Default" };
  }
}

function writeMode(mode: Mode): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...mode, at: new Date().toISOString() }));
}

/** Is anything listening on the debug port? */
export function isPortOpen(timeoutMs = 300): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    const done = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    socket.on("timeout", () => done(false));
    socket.connect(CDP_PORT, "127.0.0.1");
  });
}

/** Connect over CDP with a hard timeout so a half-dead Chrome can never hang us. */
export async function connectChrome(timeoutMs = 10_000): Promise<Browser> {
  let timer: NodeJS.Timeout | undefined;
  try {
    const connecting = chromium.connectOverCDP(CDP_URL);
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`CDP connect timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );
    });
    return await Promise.race([connecting, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Probe for a live CDP endpoint. Throws nothing: "no Chrome" is a normal answer. */
export async function tryConnectChrome(timeoutMs = 3000): Promise<Browser | undefined> {
  try {
    return await connectChrome(timeoutMs);
  } catch {
    return undefined;
  }
}

/** PIDs of Chrome processes launched with our private profile dir (never your own Chrome). */
export function ourChromePids(): string[] {
  try {
    const out = execSync(`pgrep -f "user-data-dir=${PROFILE_DIR}"`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out ? out.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** Kill only Chrome instances we started ourselves. Returns the PIDs it targeted. */
export function killOurChrome(waitMs = 4000): string[] {
  const pids = ourChromePids();
  if (pids.length === 0) return pids;
  for (const pid of pids) execSync(`kill ${pid} 2>/dev/null || true`, { stdio: "ignore" });
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline && ourChromePids().length > 0) {
    execSync("sleep 0.2");
  }
  for (const pid of ourChromePids())
    execSync(`kill -9 ${pid} 2>/dev/null || true`, { stdio: "ignore" });
  return pids;
}

/**
 * Can we read the real Chrome profile? On macOS this needs Full Disk Access for
 * the terminal; without it, "copy my profile" silently copies nothing.
 */
export function chromeProfileReadable(): boolean {
  try {
    fs.readdirSync(CHROME_ROOT);
    return true;
  } catch {
    return false;
  }
}

function sqlite(args: Array<string>): string | undefined {
  const result = spawnSync("sqlite3", args, { encoding: "utf-8" });
  if (result.status !== 0) return undefined;
  return (result.stdout ?? "").trim();
}

function cookieCount(db: string): number | null {
  const out = sqlite([`file:${db}?mode=ro`, "select count(*) from cookies;"]);
  if (out === undefined) return null;
  const count = Number(out);
  return Number.isFinite(count) ? count : null;
}

export type Snapshot = { ok: boolean; count: number; method: string; note?: string };

/**
 * Snapshot your real profile's session cookies into the private automation profile so
 * the automation browser reads as *you* (verified: a copied GitHub session can open
 * private repos that render as 404 when logged out).
 *
 * `sqlite3 .backup` is preferred over `cp` because your own Chrome may be writing the
 * DB at this moment, and a torn copy authenticates as nobody. The result is always
 * integrity-checked and counted — a copy that cannot be verified is discarded.
 */
function snapshotCookies(profileName: string): Snapshot {
  const src = `${CHROME_ROOT}/${profileName}/${COOKIES_FILE}`;
  const dst = `${PROFILE_DIR}/Default/${COOKIES_FILE}`;

  if (!chromeProfileReadable()) {
    return {
      ok: false,
      count: 0,
      method: "none",
      note: `macOS blocked reading "${CHROME_ROOT}" (Full Disk Access would allow it)`,
    };
  }
  if (!fs.existsSync(src)) {
    return {
      ok: false,
      count: 0,
      method: "none",
      note: `no Cookies file in Chrome "${profileName}" — nothing to copy`,
    };
  }

  try {
    fs.mkdirSync(`${PROFILE_DIR}/Default`, { recursive: true });
    let method = "cp";
    const backup = sqlite([`file:${src}?mode=ro`, `.backup ${dst}`]);
    if (backup === undefined) {
      fs.copyFileSync(src, dst);
    } else {
      method = "sqlite .backup";
    }
    fs.chmodSync(dst, 0o600);

    const healthy = sqlite([`file:${dst}?mode=ro`, "pragma integrity_check;"]) === "ok";
    const count = healthy ? cookieCount(dst) : null;
    if (count === null) {
      fs.rmSync(dst, { force: true });
      return {
        ok: false,
        count: 0,
        method,
        note: "snapshot failed the integrity check — kept the profile's previous session instead",
      };
    }
    return { ok: true, count, method };
  } catch (error) {
    return {
      ok: false,
      count: 0,
      method: "cp",
      note: `copy failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Minimal Local State so Chrome never shows the profile picker. */
function writeLocalState(): void {
  const localState = {
    profile: {
      info_cache: {},
      profiles_order: [],
      last_used: "",
      last_active_profiles: [],
      picker_shown: false,
    },
  };
  try {
    fs.writeFileSync(`${PROFILE_DIR}/Local State`, JSON.stringify(localState, null, 2));
  } catch {
    // Non-fatal: worst case a picker window appears.
  }
}

export type LaunchResult = Mode & { notes: string[] };

/** Start Chrome (detached) and wait until CDP answers. Does NOT touch any existing Chrome. */
export async function launchChrome(options: LaunchOptions = {}): Promise<LaunchResult> {
  const notes: string[] = [];
  const mode: Mode = {
    headed: options.headed ?? readMode().headed,
    profile: options.profile ?? readMode().profile,
  };
  if (options.fresh) {
    execSync(`rm -rf "${PROFILE_DIR}"`, { stdio: "ignore" });
    fs.mkdirSync(`${PROFILE_DIR}/Default`, { recursive: true });
    notes.push("session: --fresh — profile wiped and anonymous, nothing copied");
  } else {
    fs.mkdirSync(`${PROFILE_DIR}/Default`, { recursive: true });
    if (options.noCopy) {
      notes.push(`session: --no-copy — reusing the automation profile as it is`);
    } else {
      const snapshot = snapshotCookies(mode.profile);
      if (snapshot.ok && snapshot.count > 0) {
        notes.push(
          `session: ${snapshot.count} cookies copied from Chrome "${mode.profile}" (${snapshot.method}) — you should read as logged in`,
        );
        notes.push("  confirm with: node browser-whoami.ts");
      } else if (snapshot.ok) {
        notes.push(
          `session: Chrome "${mode.profile}" has no cookies — you will read as logged out`,
        );
      } else {
        notes.push(`session: NOT copied — ${snapshot.note}`);
        notes.push(
          "  you will read as logged out (private repos look like 404). Log in once in the window, or fix the reason above.",
        );
      }
    }
  }
  writeLocalState();

  const chromeArgs = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
    "--window-size=1512,870",
  ];
  if (!mode.headed) {
    chromeArgs.push("--headless=new");
    notes.push("mode: headless (bot walls and Google AI Mode usually refuse headless)");
  } else {
    notes.push("mode: headed (visible window) — pass --headless to opt out");
  }

  const child = spawn(CHROME_BIN, chromeArgs, { detached: true, stdio: "ignore" });
  child.unref();
  writeMode(mode);

  // Ready = CDP answers. Fall back to "port is open" so a slow start is a warning, not a dead end.
  for (let i = 0; i < 40; i++) {
    try {
      const browser = await connectChrome(2000);
      await browser.close();
      return { ...mode, notes };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  if (await isPortOpen(500)) {
    notes.push("⚠ port 9222 is open but CDP did not answer yet — retry the command in a second");
    return { ...mode, notes };
  }
  killOurChrome();
  throw new Error("Chrome would not start (no CDP answer on 127.0.0.1:9222)");
}
