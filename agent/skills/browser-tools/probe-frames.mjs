import { chromium } from "playwright";

const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes("localhost:8787")) ?? ctx.pages()[0];

console.log("page:", page.url());

const frames = page.frames();
for (const f of frames) {
  console.log("\n--- FRAME:", f.url().slice(0, 90));
  if (!f.url().includes("js-sandbox")) continue;
  const info = await f
    .evaluate(() => {
      const inputs = [...document.querySelectorAll("input, select")].map((i) => ({
        tag: i.tagName,
        type: i.type,
        name: i.name || null,
        id: i.id || null,
        label: i.getAttribute("aria-label") || i.placeholder || null,
        value: i.value,
      }));
      const red = [...document.querySelectorAll("*")]
        .filter((n) => {
          const c = getComputedStyle(n);
          return (
            n.children.length === 0 &&
            n.textContent.trim().length > 3 &&
            (c.color.includes("220") || c.color.includes("239") || /red/i.test(c.color))
          );
        })
        .map((n) => n.textContent.trim().slice(0, 80));
      return { body: document.body.innerText.slice(0, 500), inputs, red: [...new Set(red)] };
    })
    .catch((e) => ({ error: String(e).slice(0, 200) }));
  console.log(JSON.stringify(info, null, 1));
}

