/**
 * Start (or inspect) the automation Chrome that the browser-* scripts drive.
 *
 * Default: headed, with a fresh snapshot of your real Chrome session cookies copied
 * into a private profile — so logged-in sites (private GitHub repos included) read
 * as logged in. Chrome 136+ refuses to attach to your everyday Chrome, which is why
 * we run a separate instance and copy what we need instead.
 *
 * Usage:
 *   node browser-start.ts                        # headed + your session copied (default)
 *   node browser-start.ts --no-copy              # keep the automation profile as-is
 *   node browser-start.ts --fresh                # wipe it, anonymous
 *   node browser-start.ts --headless             # hidden window (AI Mode will refuse)
 *   node browser-start.ts --restart              # kill and relaunch, keeping the mode
 *   node browser-start.ts --profile "Profile 1"  # snapshot a different Chrome profile
 *
 * Already-running automation Chrome is reused, never restarted, unless a flag changes
 * its mode (then it restarts). Your own Chrome is never touched.
 */
import { killOurChrome, launchChrome, PROFILE_DIR, readMode, tryConnectChrome } from "./chrome.ts";

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(
    [
      "Usage: node browser-start.ts [--headless] [--no-copy] [--fresh] [--restart] [--profile <name>]",
      "",
      "  (no flags)      headed + your Chrome session copied — this is the default",
      "  --headless      launch hidden (Google AI Mode refuses headless; bot walls bite harder)",
      "  --no-copy       do not refresh session cookies; reuse the automation profile as-is",
      "  --fresh         wipe the automation profile first (anonymous)",
      "  --restart       kill the current automation Chrome, then start again",
      '  --profile <n>   snapshot that profile instead of "Default" (see chrome://version)',
      "",
      `Profile dir: ${PROFILE_DIR}`,
      "Note: with a copied session the automation browser acts as YOU. Read-only checks",
      "are the intended use; anything that submits data should be something you asked for.",
    ].join("\n"),
  );
  process.exit(0);
}

const headless = args.includes("--headless");
const fresh = args.includes("--fresh");
const noCopy = args.includes("--no-copy");
const restart = args.includes("--restart");
const profileIndex = args.indexOf("--profile");
const profileName = profileIndex >= 0 ? args[profileIndex + 1] : undefined;

if (profileIndex >= 0 && (!profileName || profileName.startsWith("--"))) {
  console.error('Error: --profile requires a value (e.g. --profile "Profile 1")');
  process.exit(1);
}

// Any of these changes the running instance, so restart it; plain "start" should not.
const changesMode = headless || fresh || noCopy || restart || profileName !== undefined;

const running = await tryConnectChrome(3000);
if (running) {
  await running.close();
  if (!changesMode) {
    console.log("✓ Chrome already running on :9222 — nothing to do.");
    console.log(
      `  mode: ${readMode().headed ? "headed" : "headless"} · profile: ${PROFILE_DIR} (--no-copy keeps its session)`,
    );
    process.exit(0);
  }
  console.log("• Chrome is running and these flags change it — restarting it.");
  killOurChrome();
}

const result = await launchChrome({
  headed: !headless,
  fresh,
  noCopy,
  profile: profileName,
});

for (const note of result.notes) {
  console.log(note.startsWith("  ") ? note : `• ${note}`);
}
if (result.headed) {
  console.log("• Window is visible on purpose; it stays up between commands.");
}
console.log("✓ Chrome ready on 127.0.0.1:9222");
