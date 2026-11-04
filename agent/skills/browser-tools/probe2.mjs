import { chromium } from "playwright";

const run = async () => {
  console.log("connecting…");
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222", { timeout: 15000 });
  console.log("connected");
  const ctx = browser.contexts()[0];
  const pages = ctx.pages();
  console.log("pages:", pages.length);
  const page = pages.find((p) => p.url().includes("localhost:8787")) ?? pages[0];
  console.log("page url:", page.url());

  for (const f of page.frames()) {
    console.log("\nFRAME:", f.url().slice(0, 70));
    if (!f.url().includes("js-sandbox")) continue;
    const info = await f
      .evaluate(() => ({
        text: document.body.innerText.slice(0, 400),
        inputs: [...document.querySelectorAll("input,select")].map((i) => ({
          t: i.tagName,
          ty: i.type,
          ph: i.placeholder || null,
          name: i.name || null,
          v: i.value,
        })),
      }))
      .catch((e) => ({ err: String(e).slice(0, 160) }));
    console.log(JSON.stringify(info));
  }
};

await Promise.race([
  run().catch((e) => console.log("ERROR:", String(e).slice(0, 300))),
  new Promise((r) => setTimeout(() => console.log("TIMEOUT after 40s"), 40000)),
]);
process.exit(0);
