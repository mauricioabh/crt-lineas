import type { Page } from "playwright";
import type {
  CompanyPattern,
  MonitorRunContext,
  MonitorResult,
} from "../base-pattern";
import { runAltanRnuConsulta } from "./altan-rnu";

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Diri Móvil — Portal de consulta (redirige a Altán RNU `/consulta`). */
export function matchesDiriMovilRegistroLineasUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === "diri.mx" && /registrolineas/i.test(u.pathname);
  } catch {
    return false;
  }
}

export async function runDiriMovilRegistroLineas(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  await page.goto(context.url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1500);

  const consultar = page
    .getByRole("button", { name: /consultar\s+l[ií]neas\s+registradas/i })
    .or(
      page.getByRole("link", { name: /consultar\s+l[ií]neas\s+registradas/i }),
    );

  await consultar.first().waitFor({ state: "visible", timeout: 20_000 });
  await Promise.all([
    page.waitForURL(/rnu\.altanredes\.com\/consulta/i, { timeout: 45_000 }),
    consultar.first().click(),
  ]);

  await delay(1500);
  return runAltanRnuConsulta(page, context);
}

export const diriMovilRegistroLineasPattern: CompanyPattern = {
  id: "diri-movil-registro-lineas",
  matches: () => false,
  matchesUrl: matchesDiriMovilRegistroLineasUrl,
  supportsAutomatedVerification: true,
  run: runDiriMovilRegistroLineas,
};
