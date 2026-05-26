/**
 * Stop the browser-tools Chrome instance running on port 9222.
 *
 * Usage: node browser-stop.ts
 *
 * This safely terminates the Chrome process started by browser-start.ts
 * (both fresh and profile modes). It kills the process group to ensure
 * all Chrome helper/renderer processes are cleaned up.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const CHROME_PID_FILE = `${process.env.HOME}/.cache/browser-tools/chrome.pid`;

// Check if Chrome is running on 9222
let chromePid: string | null = null;
try {
  chromePid = fs.readFileSync(CHROME_PID_FILE, "utf-8").trim();
} catch {
  console.error("No PID file, try to find Chrome process by port");
}

if (!chromePid) {
  // Find the Chrome process using port 9222
  try {
    const output = execSync("lsof -ti :9222 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
    if (output) {
      chromePid = output.split("\n")[0] ?? null;
    }
  } catch {
    console.log("No Chrome instance found running on port 9222.");
    process.exit(0);
  }
}

if (!chromePid) {
  console.log("No Chrome instance found.");
  process.exit(0);
}

console.log(`Stopping Chrome (PID: ${chromePid})...`);

try {
  // Kill the entire process group for a clean shutdown
  execSync(`kill ${chromePid} 2>/dev/null || true`, { stdio: "ignore" });

  // Also kill any related Chrome processes we started (same user-data-dir)
  execSync(
    `pkill -f "user-data-dir=${process.env.HOME}/.cache/browser-tools" 2>/dev/null || true`,
    { stdio: "ignore" },
  );

  // Wait briefly for processes to terminate
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    try {
      const running = execSync(`kill -0 ${chromePid} 2>/dev/null && echo yes || echo no`, {
        encoding: "utf-8",
      }).trim();
      if (running === "no") break;
    } catch {
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // Force kill if still running
  try {
    execSync(`kill -9 ${chromePid} 2>/dev/null || true`, { stdio: "ignore" });
  } catch {
    // Already dead
  }

  // Clean up PID file
  fs.rmSync(CHROME_PID_FILE, { force: true });

  console.log("✓ Chrome stopped cleanly.");
} catch (e) {
  console.error("⚠ Error stopping Chrome:", e instanceof Error ? e.message : String(e));
  process.exit(1);
}
