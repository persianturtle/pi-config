/**
 * "Am I logged in?" — check the session state of the automation profile before
 * you conclude that a 404, an empty page, or a missing resource is real.
 *
 * Usage:
 *   node browser-whoami.ts                       # check the tab that is open
 *   node browser-whoami.ts https://github.com    # navigate there first, then check
 *
 * Why: a private repo looks exactly like a non-existent repo when you are signed
 * out, and Google AI features behave differently without an account.
 */
import type { Page } from "playwright";
import { flagValue, noteTab, parseArgs, pickPage, runBrowserCommand } from "./shared.ts";

const args = parseArgs(process.argv.slice(2));
const target = args.rest[0];

type SiteProbe = {
  label: string;
  host: (host: string) => boolean;
  /** Cookie names that only exist for a signed-in session. */
  sessionCookies: RegExp;
  /** A URL that only resolves when authenticated (redirect to /login proves otherwise). */
  authenticatedUrl?: string;
};

const SITES: SiteProbe[] = [
  {
    label: "GitHub",
    host: (host) => host.endsWith("github.com"),
    sessionCookies: /^(logged_in|_gh_sess)$/i,
    authenticatedUrl: "https://github.com/settings/profile",
  },
  {
    label: "Google",
    host: (host) => host.endsWith("google.com"),
    sessionCookies: /^(__Secure-1PSID|__Secure-1PSIDTS|osid|__Secure-PSID)$/i,
  },
  {
    label: "GitLab",
    host: (host) => host.endsWith("gitlab.com"),
    sessionCookies: /^(_gitlab_session)$/i,
    authenticatedUrl: "https://gitlab.com/profile/account",
  },
];

async function checkSite(page: Page, site: SiteProbe, url: string) {
  const cookies = await page
    .context()
    .cookies(url)
    .catch(() => []);
  const session = cookies.filter((cookie) => site.sessionCookies.test(cookie.name));
  const ghFlag = cookies.find((cookie) => cookie.name === "logged_in");

  if (ghFlag !== undefined && /^(no|false|0)$/i.test(ghFlag.value)) {
    return { state: "NOT logged in", evidence: `cookie logged_in=${ghFlag.value}` };
  }
  if (ghFlag !== undefined) {
    return { state: "logged in", evidence: `cookie logged_in=${ghFlag.value}` };
  }
  if (isAuthPage(url)) {
    return { state: "NOT logged in", evidence: `you are standing on a sign-in page: ${url}` };
  }
  if (site.authenticatedUrl !== undefined) {
    const response = await page
      .context()
      .request.get(site.authenticatedUrl, { timeout: 15_000 })
      .catch(() => undefined);
    if (!response) return { state: "unknown (probe failed)", evidence: site.authenticatedUrl };
    const finalUrl = response.url();
    // Redirected away (to /login, /users/sign_in, /sso/…) or refused = session not accepted.
    if (
      finalUrl !== site.authenticatedUrl &&
      (isAuthPage(finalUrl) || !finalUrl.startsWith(site.authenticatedUrl))
    ) {
      return { state: "NOT logged in", evidence: `${site.authenticatedUrl} → ${finalUrl}` };
    }
    if (response.status() === 401 || response.status() === 403) {
      return {
        state: "NOT logged in",
        evidence: `${site.authenticatedUrl} → HTTP ${response.status()}`,
      };
    }
    return {
      state: "logged in",
      evidence: `${site.authenticatedUrl} → ${response.status()} ${finalUrl}`,
    };
  }
  if (session.length > 0) {
    return {
      state: "maybe logged in",
      evidence: `session cookie(s): ${session.map((cookie) => cookie.name).join(", ")} (unverified)`,
    };
  }
  return { state: "unknown (no session cookie, no probe)", evidence: "no account markers" };
}

/** A URL that means "we got bounced to sign-in", i.e. the session was not accepted. */
function isAuthPage(url: string): boolean {
  return /(\/login|\/sign_in|\/sign-in|\/signin|\/account\/login|\/users\/auth)/i.test(url);
}

await runBrowserCommand(async (browser) => {
  const page = await pickPage(browser, { tab: flagValue(args, "tab") });

  if (target && target !== "--current" && target !== page.url()) {
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await new Promise((resolve) => setTimeout(resolve, 800));
  }

  const url = page.url();
  console.log(`Page: ${url}`);
  noteTab(page);

  if (!/^https?:/.test(url)) {
    console.log("Not an http(s) page, so there is no session to probe. Pass a URL to check one.");
    return;
  }

  const host = new URL(url).host;
  const site = SITES.find((candidate) => candidate.host(host));

  if (!site) {
    const cookies = await page
      .context()
      .cookies(url)
      .catch(() => []);
    console.log(`No login probe for ${host} — ${cookies.length} cookie(s) in this profile.`);
    console.log("Login state unknown here; check for a sign-in form before trusting the content.");
    return;
  }

  const verdict = await checkSite(page, site, url);
  console.log(`${site.label}: ${verdict.state}`);
  console.log(`  evidence: ${verdict.evidence}`);
  if (verdict.state.startsWith("NOT")) {
    console.log("  → A 404/empty page here does NOT prove the resource is missing.");
    console.log(
      "    Log in once in the visible Chrome window (it persists in the profile), or use git/gh/CLI.",
    );
  }
});
