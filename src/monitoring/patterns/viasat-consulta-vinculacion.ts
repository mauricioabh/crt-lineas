import type { Page } from "playwright";
import type {
  CompanyPattern,
  MonitorRunContext,
  MonitorResult,
} from "../base-pattern";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Viasat — Consulta de líneas vinculadas por CURP o RFC.
 * URL CRT: `https://viasatprepago.com.mx/vinculatulinea/`
 * Flujo: aterrizaje en la página → pestaña «Consulta vinculación» → CURP → «Enviar».
 * Resultado negativo: «No se encontraron números Viasat vinculados».
 */
export function matchesViasatConsultaVinculacionUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === "viasatprepago.com.mx";
  } catch {
    return false;
  }
}

const NO_LINES = /no\s+se\s+encontraron\s+n[uú]meros\s+viasat\s+vinculados/i;
const HAS_LINES =
  /n[uú]mero(?:s)?\s+viasat\s+vinculado|l[ií]nea(?:s)?\s+viasat\s+vinculada/i;

export async function runViasatConsultaVinculacion(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const curp = context.curp?.trim();
  if (!curp || curp.length < 14) {
    return {
      hasActiveLines: null,
      notes:
        "Viasat: falta configurar el CURP de verificación en el servidor (18 caracteres) para la consulta de líneas vinculadas.",
      isManualReview: true,
    };
  }

  await page.goto("https://viasatprepago.com.mx/vinculatulinea/", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1500);

  // Activar la pestaña «Consulta vinculación» si el portal inicia en «Vincula tu línea».
  const consultaTab = page
    .getByRole("tab", { name: /consulta\s+vinculaci[oó]n/i })
    .or(page.getByText(/consulta\s+vinculaci[oó]n/i).first());
  try {
    await consultaTab.first().click({ timeout: 8_000 });
    await delay(600);
  } catch {
    // Tab may already be active or use a different mechanism.
  }

  const curpInput = page
    .getByLabel(/^CURP$/i)
    .or(page.getByPlaceholder(/^CURP$/i))
    .or(page.locator('input[placeholder="CURP"]'))
    .first();

  await curpInput.waitFor({ state: "visible", timeout: 20_000 });
  await curpInput.clear().catch(() => {});
  await curpInput.fill(curp);

  const enviarBtn = page.getByRole("button", { name: /^Enviar$/i }).first();
  await enviarBtn.waitFor({ state: "visible", timeout: 15_000 });
  await enviarBtn.scrollIntoViewIfNeeded().catch(() => {});
  await enviarBtn.click();

  await delay(3500);

  const body = await page.locator("body").innerText();

  if (NO_LINES.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "Viasat: el portal indica que no se encontraron números Viasat vinculados al CURP.",
      isManualReview: false,
    };
  }

  if (HAS_LINES.test(body)) {
    return {
      hasActiveLines: true,
      notes:
        "Viasat: el portal muestra números Viasat vinculados al CURP; confirme en la captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Viasat: resultado no claro tras «Enviar». Revise la captura o posibles cambios en el portal.",
    isManualReview: true,
  };
}

export const viasatConsultaVinculacionPattern: CompanyPattern = {
  id: "viasat-consulta-vinculacion",
  matches: (companyName: string) => /viasat/i.test(companyName),
  matchesUrl: matchesViasatConsultaVinculacionUrl,
  supportsAutomatedVerification: true,
  run: runViasatConsultaVinculacion,
};
