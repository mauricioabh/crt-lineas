import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright";

/** Vercel serverless no incluye el Chromium de `playwright install`; usa @sparticuz/chromium. */
function isVercelServerless(): boolean {
  return process.env.VERCEL === "1";
}

function sparticuzBinDir(): string {
  return path.join(
    process.cwd(),
    "node_modules",
    "@sparticuz",
    "chromium",
    "bin",
  );
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
    const binDir = sparticuzBinDir();
    const executablePath = fs.existsSync(binDir)
      ? await chromiumPack.executablePath(binDir)
      : await chromiumPack.executablePath();
    return chromium.launch({
      args: chromiumPack.args,
      executablePath,
      headless: true,
    });
  }

  return chromium.launch({ headless: wantHeadless });
}
