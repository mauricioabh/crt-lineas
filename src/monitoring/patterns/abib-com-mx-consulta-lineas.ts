import type { Page } from "playwright";
import { normalizePhone10 } from "@/lib/verification-identity";
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
 * ABIB Móvil — navega siempre a `#/consultatuslineas` (paso 1 de consulta de líneas).
 * El CRT puede guardar el origen, `#/vinculatulinea` (hub), o la ruta exacta; todos mapean aquí.
 */
export function matchesAbibComMxConsultaLineasUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === "abib.com.mx";
  } catch {
    return false;
  }
}

const NOT_ABIB =
  /no es una l[ií]nea abib|no es una linea abib|el n[uú]mero no pertenece a la red abib|numero no pertenece a la red abib/i;

export async function runAbibComMxConsultaLineas(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  void context;
  const phone = normalizePhone10(context.phone ?? undefined);
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "ABIB (abib.com.mx): falta el número de teléfono de prueba en el servidor (10 dígitos) para «Verificar número ABIB».",
      isManualReview: true,
    };
  }

  // Siempre abrimos directamente la ruta de consulta, sin pasar por el hub (#/vinculatulinea),
  // cuya tarjeta «Consultar» es un <a> de SPA que no dispara navegación confiable en headless.
  await page.goto("https://abib.com.mx/#/consultatuslineas", {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1500);

  // Selector confirmado via browser inspection: textbox con placeholder "10 dígitos"
  const input = page
    .getByRole("textbox", { name: /10 d[ií]gitos/i })
    .or(page.getByPlaceholder(/10 d[ií]gitos/i))
    .or(page.locator('input[type="tel"]'))
    .first();

  await input.waitFor({ state: "visible", timeout: 40_000 });
  await input.clear().catch(() => {});
  await input.fill(phone);
  await input.press("Tab").catch(() => {});

  const verifyBtn = page
    .getByRole("button", { name: /verificar/i })
    .or(page.locator("button:has-text('Verificar')"))
    .first();
  await verifyBtn.waitFor({ state: "visible", timeout: 15_000 });
  await verifyBtn.scrollIntoViewIfNeeded().catch(() => {});

  let clicked = false;
  try {
    await verifyBtn.click({ timeout: 10_000 });
    clicked = true;
  } catch {
    // fallback abajo
  }
  if (!clicked) {
    try {
      await verifyBtn.dispatchEvent("click");
      clicked = true;
    } catch {
      // fallback final abajo
    }
  }
  if (!clicked) {
    await input.press("Enter").catch(() => {});
  }

  await delay(2500);

  const body = await page.locator("body").innerText();
  if (NOT_ABIB.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "ABIB (abib.com.mx): el portal indica que el número no es línea ABIB.",
      isManualReview: false,
    };
  }

  // Evitamos falsos positivos por textos estáticos del encabezado (ej. "CURP").
  // Solo contamos éxito cuando realmente aparece el siguiente paso.
  if (/paso\s*2\s*de\s*2|paso\s*2/i.test(body) && !NOT_ABIB.test(body)) {
    return {
      hasActiveLines: true,
      notes:
        "ABIB: paso 1 superado (no apareció error de línea no ABIB); revise paso 2 en captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "ABIB (abib.com.mx): resultado no claro tras verificar número. Revise captura o selectores del SPA.",
    isManualReview: true,
  };
}

export const abibComMxConsultaLineasPattern: CompanyPattern = {
  id: "abib-com-mx-consulta-lineas",
  matches: () => false,
  matchesUrl: matchesAbibComMxConsultaLineasUrl,
  supportsAutomatedVerification: true,
  run: runAbibComMxConsultaLineas,
};
