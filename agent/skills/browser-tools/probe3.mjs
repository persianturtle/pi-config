import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 15000 });
const page = browser.contexts()[0].pages()[0];
console.log("page:", page.url());
console.log("frame count:", page.frames().length);

for (const f of page.frames()) {
  console.log("\n=== FRAME:", JSON.stringify(f.url()).slice(0, 90));
  const probe = await Promise.race([
    f
      .evaluate(() => ({
        title: document.title,
        text: document.body?.innerText?.slice(0, 300) ?? null,
        inputs: [...document.querySelectorAll("input,select")].map((i) => ({
          tag: i.tagName,
          ty: i.type,
          ph: i.placeholder || null,
          nm: i.name || null,
          v: i.value,
        })),
      }))
      .catch((e) => ({ err: String(e).slice(0, 140) })),
    new Promise((r) => setTimeout(() => r({ err: "evaluate TIMEOUT" }), 8000)),
  ]);
  console.log(JSON.stringify(probe));
}
process.exit(0);
