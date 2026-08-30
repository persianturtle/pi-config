import { type Browser, chromium, type Page } from "playwright";

/** Standard viewport for all browser interactions (1512×827 CSS pixels).
 * Adjust this in shared.ts if you need a different viewport size for your display. */
export const VIEWPORT = { width: 1512, height: 827 };

/** Connect to Chrome via the Chrome DevTools Protocol on port 9222. */
export async function connectCDP(): Promise<Browser> {
  return chromium.connectOverCDP("http://localhost:9222");
}

/** Get the most recently opened page from the first browser context. */
export async function getActivePage(browser: Browser): Promise<Page> {
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error("No browser contexts open");
  }
  const context = contexts[0];
  if (context === undefined) {
    throw new Error("No browser contexts open");
  }
  const pages = context.pages();
  if (pages.length === 0) {
    throw new Error("No pages open");
  }
  const lastPage = pages[pages.length - 1];
  if (lastPage === undefined) {
    throw new Error("Could not find active page");
  }
  await lastPage.setViewportSize(VIEWPORT);
  return lastPage;
}

/** Create a new page with the standard viewport in the first browser context. */
export async function createPage(browser: Browser): Promise<Page> {
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error("No browser contexts open");
  }
  const context = contexts[0];
  if (context === undefined) {
    throw new Error("No browser contexts open");
  }
  const page = await context.newPage();
  await page.setViewportSize(VIEWPORT);
  return page;
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Run a browser command with standard setup and error handling. */
export async function runBrowserCommand<T>(action: (browser: Browser) => Promise<T>): Promise<T> {
  const browser = await connectCDP();
  let outcome: Outcome<T>;
  try {
    outcome = { ok: true, value: await action(browser) };
  } catch (error) {
    outcome = { ok: false, error };
  } finally {
    // Disconnects the CDP client without killing Chrome — the browser
    // process keeps running for the next command.
    await browser.close();
  }
  if (!outcome.ok) {
    console.error(
      "✗ Command failed:",
      outcome.error instanceof Error ? outcome.error.message : outcome.error,
    );
    process.exit(1);
  }
  return outcome.value;
}
