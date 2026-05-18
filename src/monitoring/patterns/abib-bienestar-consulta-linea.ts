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

/** ABIB Internet para el Bienestar — `/consultatulinea` o `/vinculatulinea` (CRT). */
export function matchesAbibBienestarConsultaLineaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    const p = u.pathname.toLowerCase();
    return (
      h === "abibinternetdelbienestar.mx" &&
      (/consultatulinea/i.test(p) || /vinculatulinea/i.test(p))
    );
  } catch {
    return false;
  }
}

const NOT_ABIB_NETWORK =
  /no es una l[ií]nea abib|no es una linea abib|el n[uú]mero no pertenece a la red abib|numero no pertenece a la red abib/i;

async function openBienestarConsultaFromHub(
  page: Page,
  startUrl: string,
): Promise<void> {
  let path = "";
  try {
    path = new URL(page.url()).pathname.toLowerCase();
  } catch {
    path = "";
  }

  const isVinculaHub = /vinculatulinea/i.test(path);
  if (!isVinculaHub) {
    return;
  }

  const goConsult = page
    .getByRole("button", { name: /ir a consulta/i })
    .or(page.getByRole("link", { name: /ir a consulta/i }));

  let opened = false;
  try {
    if (await goConsult.first().isVisible({ timeout: 5000 })) {
      await goConsult.first().click({ timeout: 15_000 });
      opened = true;
    }
  } catch {
    // fallback abajo
  }

  if (!opened) {
    try {
      const u = new URL(startUrl);
      const origin = `${u.protocol}//${u.host}`;
      await page.goto(`${origin}/consultatulinea`, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
    } catch {
      // último recurso: dejamos que falle el selector del input más abajo
    }
  }

  await delay(1500);
}

export async function runAbibBienestarConsultaLinea(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const phone = normalizePhone10(context.phone ?? undefined);
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "ABIB Internet del Bienestar: falta el número de teléfono de prueba en el servidor (10 dígitos) para «Número ABIB».",
      isManualReview: true,
    };
  }

  await page.goto(context.url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1200);

  await openBienestarConsultaFromHub(page, context.url);

  const input = page
    .getByPlaceholder(/ingresa n[uú]mero/i)
    .or(page.getByPlaceholder(/10 d[ií]gitos/i))
    .or(page.getByRole("textbox", { name: /n[uú]mero abib/i }))
    .or(page.getByLabel(/número abib|numero abib/i))
    .or(page.getByLabel(/tel[eé]fono|celular/i))
    .or(page.locator('input[type="tel"]'))
    .first();

  await input.waitFor({ state: "visible", timeout: 40_000 });
  await input.clear().catch(() => {});
  await input.fill(phone);
  await input.press("Tab").catch(() => {});

  const btn = page
    .getByRole("button", { name: /verificar\s*l[ií]nea/i })
    .or(page.getByRole("button", { name: /^verificar$/i }))
    .or(page.locator("button:has-text('Verificar')"))
    .first();
  await btn.waitFor({ state: "visible", timeout: 15_000 });
  await btn.scrollIntoViewIfNeeded().catch(() => {});

  let clicked = false;
  try {
    await btn.click({ timeout: 10_000 });
    clicked = true;
  } catch {
    // fallback abajo
  }
  if (!clicked) {
    try {
      await btn.dispatchEvent("click");
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
  if (NOT_ABIB_NETWORK.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "ABIB Internet del Bienestar: el portal indica que el número no es línea ABIB o no pertenece a la red ABIB.",
      isManualReview: false,
    };
  }

  if (
    /paso\s*2\s*de\s*2|paso\s*2/i.test(body) &&
    !NOT_ABIB_NETWORK.test(body)
  ) {
    return {
      hasActiveLines: true,
      notes:
        "ABIB Bienestar: verificación de línea sin error conocido; posible acceso al siguiente paso.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "ABIB Bienestar (consultatulinea / vinculatulinea): resultado no claro. Revise captura o cambios en el portal.",
    isManualReview: true,
  };
}

export const abibBienestarConsultaLineaPattern: CompanyPattern = {
  id: "abib-bienestar-consulta-linea",
  matches: () => false,
  matchesUrl: matchesAbibBienestarConsultaLineaUrl,
  supportsAutomatedVerification: true,
  run: runAbibBienestarConsultaLinea,
};
