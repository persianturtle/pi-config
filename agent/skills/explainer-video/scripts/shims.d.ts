/**
 * Playwright is not a dependency of this skill — frameprobe.ts reuses whichever
 * copy is already installed (its own, or browser-tools'). This shim only exists
 * so `npm run tsc` can type-check that import without the package present.
 */
declare module "playwright" {
  export interface Page {
    goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
    evaluate<T>(fn: (...args: never[]) => T, ...args: unknown[]): Promise<T>;
    addStyleTag(opts: { content: string }): Promise<unknown>;
    waitForSelector(sel: string, opts?: Record<string, unknown>): Promise<unknown>;
    waitForTimeout(ms: number): Promise<unknown>;
    screenshot(opts: Record<string, unknown>): Promise<Uint8Array>;
  }
  export interface BrowserContext {
    newPage(): Promise<Page>;
    close(): Promise<unknown>;
  }
  export interface Browser {
    newContext(opts?: Record<string, unknown>): Promise<BrowserContext>;
    close(): Promise<unknown>;
  }
  export const chromium: {
    launch(opts?: Record<string, unknown>): Promise<Browser>;
  };
}
