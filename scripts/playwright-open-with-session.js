const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: ".playwright/auth.json" });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await page.waitForURL("**/dashboard**", { timeout: 30_000 });

  // eslint-disable-next-line no-console
  console.log("Session OK: landed on /dashboard");
  // Keep window open briefly for visual confirmation.
  await page.waitForTimeout(2_000);

  await browser.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

