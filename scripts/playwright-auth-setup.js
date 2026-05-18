const { chromium } = require("playwright");

async function main() {
  // eslint-disable-next-line no-console
  console.log("[pw:auth] Opening sign-in page…");
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto("http://localhost:3000/sign-in", { waitUntil: "domcontentloaded" });

  // Login manually (email + password) in the opened browser window.
  // When done, make sure you land on /dashboard (or any page under /dashboard).
  //
  // Some auth flows may momentarily show "Rendering…" or bounce through OAuth URLs.
  // We log the URL periodically so you can see progress.
  // eslint-disable-next-line no-console
  console.log("[pw:auth] Please complete login in the browser window.");
  // eslint-disable-next-line no-console
  console.log("[pw:auth] Waiting to reach /dashboard …");

  let lastUrl = "";
  const interval = setInterval(async () => {
    try {
      const url = page.url();
      if (url !== lastUrl) {
        lastUrl = url;
        // eslint-disable-next-line no-console
        console.log(`[pw:auth] URL: ${url}`);
      }
    } catch {
      // ignore
    }
  }, 1000);

  try {
    await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 0 });
  } finally {
    clearInterval(interval);
  }

  await context.storageState({ path: ".playwright/auth.json" });
  await browser.close();

  // eslint-disable-next-line no-console
  console.log("Saved Playwright storageState to .playwright/auth.json");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

