import { chromium, type Browser } from "playwright";

/** Vercel serverless no incluye el Chromium de `playwright install`; usa @sparticuz/chromium. */
function isVercelServerless(): boolean {
  return process.env.VERCEL === "1";
}

/**
 * Lanza Chromium en local (`playwright install`) o en Vercel (binario @sparticuz/chromium).
 * En Vercel siempre headless; `PLAYWRIGHT_HEADED` no aplica.
 */
export async function launchChromium(options?: {
  headless?: boolean;
}): Promise<Browser> {
  const wantHeadless = options?.headless ?? true;

  if (isVercelServerless()) {
    const chromiumPack = (await import("@sparticuz/chromium")).default;
    return chromium.launch({
      args: chromiumPack.args,
      executablePath: await chromiumPack.executablePath(),
      headless: true,
    });
  }

  return chromium.launch({ headless: wantHeadless });
}
