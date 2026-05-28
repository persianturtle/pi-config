/**
 * Start Chrome with remote debugging enabled on port 9222.
 *
 * Usage:
 *   node browser-start.ts                    # Default (default), headless
 *   node browser-start.ts --fresh            # Fresh profile, headless (no cookies, logins)
 *   node browser-start.ts --headed           # Default (default), headed (visible window)
 *   node browser-start.ts --fresh --headed   # Fresh profile, headed (visible window)
 *
 * If Chrome is already running on :9222, this script detects it and exits immediately.
 */
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import { chromium } from "playwright";

const profileDirectory = `${process.env.HOME}/.cache/browser-tools/profile`;
const chromePidFile = `${process.env.HOME}/.cache/browser-tools/chrome.pid`;
const args = process.argv.slice(2);
const useFreshProfile = args.includes("--fresh");
const headed = args.includes("--headed");
const profileName = "Default";

// Validate arguments — reject unknown flags
const knownFlags = new Set(["--fresh", "--headed"]);
const knownValues = new Set(["--fresh", "--headed"]);
if (
  args.some(
    (a: string) =>
      a.startsWith("--") && !knownFlags.has(a) && !knownValues.has(a),
  )
) {
  console.log("Usage: node browser-start.ts [--fresh] [--headed]");
  console.log("\nOptions:");
  console.log(
    "  --fresh            Use a fresh profile (no cookies, logins, extensions)",
  );
  console.log(
    "  --headed           Run Chrome in headed (visible) mode (default: headless)",
  );
  process.exit(1);
}

/** Check if the main Google Chrome application is running. */
function isMainChromeRunning(): boolean {
  try {
    execSync(
      'pgrep -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome$"',
      {
        stdio: "ignore",
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** Check if a TCP port is open on localhost. */
function isPortOpen(port: number, timeoutMs = 200): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "localhost");
  });
}

/** Connect to Chrome via CDP, with a timeout to prevent hanging. */
async function tryConnectCDP(timeoutMs = 2000): Promise<void> {
  const connectPromise = chromium.connectOverCDP("http://localhost:9222");
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("CDP connection timed out")), timeoutMs);
  });
  const browser = await Promise.race([connectPromise, timeoutPromise]);
  await browser.close();
}

// Check if Chrome is already running on :9222
const isRunning = await isPortOpen(9222, 1000);

if (isRunning) {
  try {
    await tryConnectCDP();
    console.log("✓ Chrome already running on :9222");
    process.exit(0);
  } catch {
    console.log("⚠ Chrome is starting on :9222 but not yet ready — waiting...");
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 300));
      await tryConnectCDP().catch(() =>
        console.log(`  ⏳ Not yet ready... (${i + 1})`),
      );
      console.log("✓ Chrome is now running on :9222");
      process.exit(0);
    }
    console.log("✓ Port 9222 confirmed open — Chrome should be usable.");
    process.exit(0);
  }
}

if (!useFreshProfile && isMainChromeRunning()) {
  console.log(
    "⚠ Main Chrome is running — skipping profile copy, using cached profile instead.",
  );
}

if (!useFreshProfile) {
  console.log(`Copying Chrome profile "${profileName}"...`);
  execSync(`rm -rf "${profileDirectory}" && mkdir -p "${profileDirectory}"`, {
    stdio: "ignore",
  });

  // Copy the specified Chrome profile data to "Default" directory
  const srcProfile = `${process.env.HOME}/Library/Application Support/Google/Chrome/${profileName}`;
  const dstProfile = `${profileDirectory}/Default`;
  try {
    execSync(
      `[ -d "${srcProfile}" ] && mkdir -p "${dstProfile}" && (cp -R "${srcProfile}/." "${dstProfile}/" 2>/dev/null || true)`,
      { stdio: "pipe" },
    );
  } catch {
    console.log(`Warning: Could not copy Chrome profile "${profileName}" data`);
  }

  // Copy Preferences file (login state, bookmarks, etc.)
  const prefSrc = `${process.env.HOME}/Library/Application Support/Google/Chrome/Preferences`;
  const prefDst = `${profileDirectory}/Preferences`;
  try {
    execSync(
      `[ -f "${prefSrc}" ] && cp -f "${prefSrc}" "${prefDst}" 2>/dev/null || true`,
      {
        stdio: "pipe",
      },
    );
  } catch {
    console.log("Warning: Could not copy Preferences file");
  }

  // Create a minimal Local State that only references a single default profile
  const lsSrc = `${process.env.HOME}/Library/Application Support/Google/Chrome/Local State`;
  const lsDst = `${profileDirectory}/Local State`;
  try {
    if (fs.existsSync(lsSrc)) {
      const lsData = JSON.parse(fs.readFileSync(lsSrc, "utf-8"));
      const guestProfile = lsData.profile?.info_cache?.["Guest Profile"];
      lsData.profile = {
        info_cache: guestProfile ? { "Guest Profile": guestProfile } : {},
        profiles_order: [],
        last_used: "",
        last_active_profiles: [],
        picker_shown: false,
      };
      fs.writeFileSync(lsDst, JSON.stringify(lsData, null, 2));
      console.log("✓ Created minimal Local State (no profile picker)");
    }
  } catch (e) {
    console.log(
      "Warning: Could not create Local State:",
      e instanceof Error ? e.message : String(e),
    );
  }
} else {
  console.log("Starting with fresh profile...");
  execSync(`rm -rf "${profileDirectory}" && mkdir -p "${profileDirectory}"`, {
    stdio: "ignore",
  });
}

// Start Chrome with remote debugging
const chromeArgs: string[] = [
  "--remote-debugging-port=9222",
  `--user-data-dir=${profileDirectory}`,
  "--no-first-run",
  "--no-default-browser-check",
];
if (!headed) {
  chromeArgs.push("--headless=new");
  console.log("Running in headless mode (add --headed to override)");
}

console.log("Starting Chrome...");
const chromeProcess = spawn(
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  chromeArgs,
  {
    detached: true,
    stdio: "ignore",
  },
);

// Save PID for cleanup on signal
fs.writeFileSync(chromePidFile, String(chromeProcess.pid), "utf-8");

// Unref so the child process doesn't keep the parent event loop alive
// (Chrome keeps running independently after the script exits)
chromeProcess.unref();

// Handle signals: kill orphaned Chrome on script exit
function cleanup() {
  chromeProcess.kill("SIGTERM");
  fs.rmSync(chromePidFile, { force: true });
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// Wait for Chrome to be ready using TCP check (fast) then CDP (reliable)
const connected = await (async () => {
  // Phase 1: TCP poll (50ms intervals) — catches Chrome the moment it binds the port
  for (let i = 0; i < 120; i++) {
    const result = await isPortOpen(9222, 200);
    if (result) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  // Phase 2: Quick CDP connection (up to 1.6 seconds)
  for (let i = 0; i < 4; i++) {
    await new Promise((r) => setTimeout(r, 300));
    try {
      await tryConnectCDP();
      return true;
    } catch {
      // Keep trying
    }
  }

  // Phase 3: If TCP is open but CDP failed, Chrome is ready enough
  const tcpResult = await isPortOpen(9222, 500);

  if (tcpResult) {
    console.log(
      "⚠ CDP connection timed out but port 9222 is open — Chrome should be usable.",
    );
    return true;
  }
  return false;
})();

if (!connected) {
  console.error("✗ Failed to connect to Chrome");
  cleanup();
  process.exit(1);
}

console.log(
  `✓ Chrome started on :9222${useFreshProfile ? "with a fresh profile" : ` with profile "${profileName}"`}`,
);

// Explicit exit — unref() above ensures this won't leave Chrome hanging.
// If the user interrupts (Ctrl+C), the SIGINT handler will clean up.
process.exit(0);
