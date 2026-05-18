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

/** Dalefon e Internet Bienestar Mex — consulta de líneas por CURP en `/vinculatulinea/`. */
export function matchesDalefonVinculatulineaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!/vinculatulinea/i.test(u.pathname)) return false;
    return h === "dalefon.mx" || h === "internetbienestarmex.com";
  } catch {
    return false;
  }
}

function portalLabelFromUrl(url: string): string {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (h === "internetbienestarmex.com") return "Internet Bienestar Mex";
    return "Dalefon";
  } catch {
    return "Dalefon";
  }
}

/** El portal puede partir el mensaje en varias líneas: «No cuentas con líneas» + «asociadas…». */
const NO_LINES = /no cuentas con l[ií]neas\s*asociadas/i;

/** Posible resultado con líneas (heurístico; conviene confirmar en captura). */
const HAS_LINES_HINT =
  /l[ií]neas?\s+vinculadas|tus\s+l[ií]neas|últimos\s+4\s+d[ií]gitos|últimos\s+4\s+digitos/i;

export async function runDalefonVinculatulinea(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const brand = portalLabelFromUrl(context.url);
  const curp = context.curp?.trim();
  if (!curp || curp.length < 14) {
    return {
      hasActiveLines: null,
      notes: `${brand}: falta configurar el CURP de verificación en el servidor (18 caracteres típico) para la consulta de líneas vinculadas.`,
      isManualReview: true,
    };
  }

  await page.goto(context.url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(2000);

  let host = "dalefon.mx";
  try {
    host = new URL(page.url()).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    // mantener default
  }

  if (host === "internetbienestarmex.com") {
    await page
      .getByRole("radio", { name: /Persona f[ií]sica/i })
      .click()
      .catch(() => {});
  } else {
    await page
      .getByRole("radio", { name: /Mexicanos|CURP/i })
      .click()
      .catch(() => {});
  }

  const curpInput = page
    .locator('input[name="curp"]')
    .or(page.getByPlaceholder(/CURP/i))
    .first();
  await curpInput.waitFor({ state: "visible", timeout: 35_000 });
  await curpInput.clear().catch(() => {});
  await curpInput.fill(curp);

  // Dalefon: dos «Continuar» (vinculación vs consulta) → el de consulta es el último.
  // Internet Bienestar Mex: un solo «Continuar» en la columna de consulta.
  const continuarBtns = page.getByRole("button", { name: /^Continuar$/i });
  const nContinuar = await continuarBtns.count();
  const continuarConsulta =
    nContinuar > 1 ? continuarBtns.last() : continuarBtns.first();
  await continuarConsulta.waitFor({ state: "visible", timeout: 15_000 });
  await continuarConsulta.scrollIntoViewIfNeeded().catch(() => {});
  await continuarConsulta.click();

  await delay(4000);

  const body = await page.locator("body").innerText();

  if (NO_LINES.test(body)) {
    return {
      hasActiveLines: false,
      notes: `${brand}: el portal indica que no hay líneas asociadas al CURP consultado (mensaje «No cuentas con líneas asociadas…»).`,
      isManualReview: false,
    };
  }

  if (HAS_LINES_HINT.test(body) && !NO_LINES.test(body)) {
    return {
      hasActiveLines: true,
      notes: `${brand}: el portal muestra señales de líneas vinculadas; confirme en la captura (puede requerir pasos adicionales).`,
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes: `${brand}: resultado no claro tras «Continuar» en consulta de líneas. Revise captura o texto mostrado por el portal.`,
    isManualReview: true,
  };
}

export const dalefonVinculatulineaPattern: CompanyPattern = {
  id: "dalefon-vinculatulinea",
  matches: () => false,
  matchesUrl: matchesDalefonVinculatulineaUrl,
  supportsAutomatedVerification: true,
  run: runDalefonVinculatulinea,
};
