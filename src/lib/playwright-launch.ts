import { chromium, type Browser } from "playwright";

/**
 * Lanza Chromium usando el navegador instalado por `playwright install`.
 *
 * El navegador solo corre en el worker Hetzner (proceso Node persistente); ya
 * no se ejecuta en Vercel serverless, por lo que no se usa `@sparticuz/chromium`.
 */
export async function launchChromium(options?: {
  headless?: boolean;
}): Promise<Browser> {
  const wantHeadless = options?.headless ?? true;
  return chromium.launch({ headless: wantHeadless });
}
