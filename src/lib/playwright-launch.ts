import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";

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

/**
 * Shim de `__name` para el contexto del navegador.
 *
 * El worker corre con `tsx` (esbuild con `keepNames: true`), que envuelve las
 * funciones nombradas con un helper `__name(...)`. Al serializar un callback de
 * `page.evaluate` / `frame.evaluate` hacia el navegador, `__name` no existe en
 * ese contexto y lanza `ReferenceError: __name is not defined`. Se inyecta como
 * no-op vía `addInitScript`, que corre en cada documento y frame antes del
 * código de la página.
 *
 * Se define como STRING a propósito: así esbuild no lo transpila y no puede
 * reintroducir una referencia a `__name` dentro del propio shim.
 */
const EVAL_SHIM_SOURCE =
  "globalThis.__name = globalThis.__name || function (f) { return f; };";

/** Crea una página con el shim de `__name` ya instalado (para `page.evaluate`). */
export async function newPageWithEvalShim(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.addInitScript({ content: EVAL_SHIM_SOURCE });
  return page;
}

/**
 * Crea un contexto con el shim de `__name` instalado. Aplica a todas las
 * páginas y frames del contexto (cubre `page.evaluate` y `frame.evaluate`).
 */
export async function newContextWithEvalShim(
  browser: Browser,
): Promise<BrowserContext> {
  const context = await browser.newContext();
  await context.addInitScript({ content: EVAL_SHIM_SOURCE });
  return context;
}
