/**
 * Stop the automation Chrome. Only kills Chrome started with our private
 * profile dir, so your own Chrome (and its tabs) is never touched.
 *
 * Usage: node browser-stop.ts
 *
 * Chrome is *allowed* to stay up between commands and between pi sessions —
 * stopping is for when all browser work in the current task is finished.
 */
import { killOurChrome, PROFILE_DIR } from "./chrome.ts";

const before = killOurChrome();

if (before.length === 0) {
  console.log("No browser-tools Chrome running (nothing to stop).");
  process.exit(0);
}

console.log(`✓ Stopped ${before.length} browser-tools Chrome process(es).`);
console.log(`  Profile kept at ${PROFILE_DIR} — logins survive; use --fresh to wipe it.`);
