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

/** ABIB Móvil — enlace corto del CRT: `https://www.abib.mx/vinculatulinea`. */
export function matchesAbibMxVinculatulineaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const h = u.hostname.toLowerCase().replace(/^www\./, "");
    return h === "abib.mx" && /vinculatulinea/i.test(u.pathname);
  } catch {
    return false;
  }
}

const NOT_ABIB_NETWORK =
  /no es una l[ií]nea abib|no es una linea abib|el n[uú]mero no pertenece a la red abib|numero no pertenece a la red abib/i;

export async function runAbibMxVinculatulinea(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const phone = normalizePhone10(context.phone ?? undefined);
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "ABIB (abib.mx): falta el número de teléfono de prueba en el servidor (10 dígitos) para el paso de número en el portal.",
      isManualReview: true,
    };
  }

  await page.goto(context.url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1200);

  // Flujo real del portal: primero hay que entrar al trámite "Consultar mis líneas".
  const consultarByRole = page
    .getByRole("link", { name: /consultar mis l[ií]neas/i })
    .or(page.getByRole("button", { name: /consultar mis l[ií]neas/i }))
    .first();
  const consultarByText = page.getByText(/consultar mis l[ií]neas/i).first();

  let openedConsulta = false;
  try {
    if (await consultarByRole.isVisible({ timeout: 3000 })) {
      await consultarByRole.click({ timeout: 10_000 });
      openedConsulta = true;
    } else if (await consultarByText.isVisible({ timeout: 2000 })) {
      await consultarByText.click({ timeout: 10_000 });
      openedConsulta = true;
    }
  } catch {
    // Si el click falla por cambios de layout/hidratación, continuamos con fallback.
  }

  if (!openedConsulta) {
    await page.goto("https://abib.com.mx/#/consultatuslineas", {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
  }
  await delay(1200);

  const input = page
    .getByRole("textbox", { name: /10 d[ií]gitos/i })
    .or(page.getByPlaceholder(/10 d[ií]gitos/i))
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

  await delay(2200);

  const body = await page.locator("body").innerText();
  if (NOT_ABIB_NETWORK.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "ABIB (abib.mx): el número no pertenece a la red ABIB (mensaje del portal).",
      isManualReview: false,
    };
  }

  // Evitamos falsos positivos por textos estáticos del encabezado (ej. "CURP").
  // Solo marcamos éxito cuando el portal realmente muestra avance a paso 2.
  if (
    /paso\s*2\s*de\s*2|paso\s*2/i.test(body) &&
    !NOT_ABIB_NETWORK.test(body)
  ) {
    return {
      hasActiveLines: true,
      notes:
        "ABIB (abib.mx): verificación de línea sin error conocido; posible acceso al siguiente paso.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "ABIB (abib.mx/vinculatulinea): resultado no claro. Revise captura o cambios en el portal.",
    isManualReview: true,
  };
}

export const abibMxVinculatulineaPattern: CompanyPattern = {
  id: "abib-mx-vinculatulinea",
  matches: () => false,
  matchesUrl: matchesAbibMxVinculatulineaUrl,
  supportsAutomatedVerification: true,
  run: runAbibMxVinculatulinea,
};
