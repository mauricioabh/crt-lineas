import type { Page } from "playwright";
import type {
  CompanyPattern,
  MonitorRunContext,
  MonitorResult,
} from "../base-pattern";
import { runAltanRnuConsulta } from "./altan-rnu";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Pillofon — Portal de consulta (`pillofon.mx/registrolineas`).
 * Al hacer clic en «Consultar líneas registradas» redirige a `rnu.altanredes.com/consulta`.
 * Misma lógica que Diri Móvil y Turbocel.
 */
export function matchesPillofonRegistroLineasUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === "pillofon.mx" && /registrolineas/i.test(u.pathname);
  } catch {
    return false;
  }
}

export async function runPillofonRegistroLineas(
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

export const pillofonRegistroLineasPattern: CompanyPattern = {
  id: "pillofon-registro-lineas",
  matches: () => false,
  matchesUrl: matchesPillofonRegistroLineasUrl,
  supportsAutomatedVerification: true,
  run: runPillofonRegistroLineas,
};
