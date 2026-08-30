/**
 * Stop the browser-tools Chrome instance running on port 9222.
 *
 * Usage: node browser-stop.ts
 *
 * Safely terminates the Chrome process started by browser-start.ts. It only
 * kills processes that were launched with our user-data-dir, so unrelated
 * processes (including the user's main Chrome) are never touched.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const CHROME_PID_FILE = `${process.env.HOME}/.cache/browser-tools/chrome.pid`;
const USER_DATA_DIR = `${process.env.HOME}/.cache/browser-tools`;

/** True if the given PID's command line was launched with our user-data-dir. */
function isOurChrome(pid: string): boolean {
  if (!/^\d+$/.test(pid)) return false;
  try {
    const command = execSync(`ps -p ${pid} -o command=`, { encoding: "utf-8" }).trim();
    return command.includes(`${USER_DATA_DIR}/profile`);
  } catch {
    return false;
  }
}

/** Find PIDs of processes launched with our user-data-dir. */
function findOurChromePids(): string[] {
  try {
    const output = execSync(`pgrep -f "user-data-dir=${USER_DATA_DIR}"`, {
      encoding: "utf-8",
    }).trim();
    return output ? output.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

// Candidate PID: prefer the pid file, fall back to whatever holds port 9222.
let candidatePid: string | null = null;
try {
  candidatePid = fs.readFileSync(CHROME_PID_FILE, "utf-8").trim() || null;
} catch {
  candidatePid = null;
}
if (candidatePid && !isOurChrome(candidatePid)) {
  console.log("PID file is stale (process is not a browser-tools Chrome) — ignoring it.");
  candidatePid = null;
}
if (!candidatePid) {
  let portPid: string | undefined;
  try {
    portPid = execSync("lsof -ti :9222 2>/dev/null", { encoding: "utf-8" }).trim().split("\n")[0];
  } catch {
    portPid = undefined; // Nothing is listening on :9222
  }
  if (portPid && isOurChrome(portPid)) {
    candidatePid = portPid;
  }
}

const pids = new Set<string>(findOurChromePids());
if (candidatePid) pids.add(candidatePid);

if (pids.size === 0) {
  console.log("No browser-tools Chrome instance found.");
  fs.rmSync(CHROME_PID_FILE, { force: true });
  process.exit(0);
}

console.log(`Stopping Chrome (PID: ${[...pids].join(", ")})...`);

// Terminate, then force-kill anything that lingers.
for (const pid of pids) {
  execSync(`kill ${pid} 2>/dev/null || true`, { stdio: "ignore" });
}

const startedAt = Date.now();
while (Date.now() - startedAt < 5000 && findOurChromePids().length > 0) {
  await new Promise((r) => setTimeout(r, 200));
}

const remaining = findOurChromePids();
if (remaining.length > 0) {
  console.log("Still running after 5s — force killing.");
  for (const pid of remaining) {
    execSync(`kill -9 ${pid} 2>/dev/null || true`, { stdio: "ignore" });
  }
  await new Promise((r) => setTimeout(r, 300));
}

fs.rmSync(CHROME_PID_FILE, { force: true });
if (findOurChromePids().length > 0) {
  console.error("✗ Some Chrome processes survived SIGKILL — kill them manually.");
  process.exit(1);
}
console.log("✓ Chrome stopped cleanly.");
