import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 15000 });
const page = browser.contexts()[0].pages()[0];

const logs = [];
page.on("console", (m) => logs.push(`[console.${m.type()}] ${m.text().slice(0, 220)}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${String(e).slice(0, 220)}`));
page.on("requestfailed", (r) => logs.push(`[FAILED] ${r.method()} ${r.url().slice(0, 110)}`));
page.on("response", async (r) => {
  const u = r.url();
  if (u.includes("localhost:8787") || !/amos/i.test(u)) return;
  let body = "";
  try {
    body = (await r.text()).slice(0, 200);
  } catch {}
  if (r.status() >= 400 || /error|declin|fail/i.test(body)) {
    logs.push(`[HTTP ${r.status()}] ${r.request().method()} ${u.slice(0, 100)} :: ${body}`);
  }
});

const frame = page.frames().find((f) => f.url().includes("js-sandbox") || f.url() === "");
console.log("driver frame:", JSON.stringify(frame?.url()), await frame?.evaluate(() => document.title));

const dump = async (tag) => {
  const main = await page.evaluate(() => ({
    status: document.getElementById("status-line")?.textContent?.trim(),
    frameState: document.getElementById("frame-state")?.textContent?.trim(),
    payDisabled: document.getElementById("submit")?.disabled,
  }));
  const inner = await frame
    .evaluate(() => document.body.innerText.replace(/\n+/g, " | ").slice(-260))
    .catch(() => "?");
  console.log(`\n--- ${tag}\n  main: ${JSON.stringify(main)}\n  iframe: ${inner}`);
};

await dump("before");

const type = async (sel, text) => {
  const loc = frame.locator(sel).first();
  await loc.click({ timeout: 5000 }).catch(() => {});
  await page.keyboard.type(text, { delay: 45 });
  await page.waitForTimeout(250);
};

await type('input:not([name]):not([type=select])', "4242424242424242");
await type('input[name="expiration"]', "1133");
await type('input[name="cvc"]', "234");
await page.waitForTimeout(1200);
await dump("after typing 4242");

console.log("\n>>> submitting");
await page.evaluate(() => document.getElementById("payment-form")?.requestSubmit());
await page.waitForTimeout(14000);
await dump("after submit");

console.log("\n=== LOGS ===");
for (const l of logs.slice(-25)) console.log(l);
process.exit(0);
