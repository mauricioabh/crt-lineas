import type { Page } from "playwright";
import { normalizePhone10 } from "@/lib/verification-identity";
import type {
  CompanyPattern,
  MonitorRunContext,
  MonitorResult,
} from "../base-pattern";

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Timeout de acciones Playwright (ms), configurable con MONITOR_ACTION_TIMEOUT_MS. */
function actionTimeoutMs(): number {
  const raw = Number(process.env.MONITOR_ACTION_TIMEOUT_MS ?? 30_000);
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000;
}

/** Persona portal on Altán RNU, e.g. https://rnu.altanredes.com/2y2x/vinculatulinea */
export function matchesAltanRnuUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.toLowerCase() === "rnu.altanredes.com" &&
      /\/vinculatulinea\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

/** Consulta de líneas vinculadas en `rnu.altanredes.com/consulta` (CURP + términos + Buscar). */
export async function runAltanRnuConsulta(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const curp = context.curp?.trim();
  if (!curp || curp.length < 14) {
    return {
      hasActiveLines: null,
      notes:
        "Altán consulta: falta configurar el CURP de verificación en el servidor.",
      isManualReview: true,
    };
  }

  await page
    .getByRole("button", { name: /Persona f[ií]sica\s+Residente/i })
    .click();
  await delay(400);
  await page
    .getByRole("button", { name: /Ciudadano mexicano/i })
    .first()
    .click();
  await delay(400);

  const curpInput = page.getByPlaceholder(/^CURP$/i);
  await curpInput.waitFor({ state: "visible", timeout: 30_000 });
  await curpInput.clear().catch(() => {});
  await curpInput.fill(curp);

  await page.locator('input[type="checkbox"]').nth(0).check({ force: true });
  await page.locator('input[type="checkbox"]').nth(1).check({ force: true });

  // El portal carga `captcha/cap.min.js`; «Buscar» permanece `disabled` hasta que el captcha/validación lo permita.
  const headed = process.env.PLAYWRIGHT_HEADED === "true";
  const maxEnableMs = headed
    ? Math.min(Math.max(context.manualWaitMs, 5_000), 180_000)
    : 20_000;

  const buscar = page.getByRole("button", { name: /^Buscar$/i });
  try {
    await page.waitForFunction(
      () => {
        const nodes = [...document.querySelectorAll("button")];
        const btn = nodes.find(
          (b) => (b.textContent ?? "").trim() === "Buscar",
        );
        return !!(btn && !(btn as HTMLButtonElement).disabled);
      },
      { timeout: maxEnableMs },
    );
    await buscar.click();
  } catch {
    return {
      hasActiveLines: null,
      notes: headed
        ? "Altán consulta: el botón «Buscar» no se habilitó a tiempo (captcha). Resuelva el desafío en el navegador visible y, si hace falta, aumente el tiempo de espera manual en el servidor."
        : "Altán consulta: en modo sin ventana «Buscar» suele quedar bloqueado por captcha. Use navegador visible y un tiempo de espera manual alto en el servidor.",
      isManualReview: true,
    };
  }

  await delay(4500);
  const body = await page.locator("body").innerText();

  const NO_LINES_CONSULTA =
    /no\s+cuentas\s+con\s+l[ií]neas|no\s+hay\s+l[ií]neas|sin\s+l[ií]neas|no\s+se\s+encontraron|ninguna\s+l[ií]nea|no\s+registr/i;

  if (NO_LINES_CONSULTA.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "Altán consulta: el portal indica que no hay líneas asociadas al CURP (mensaje tipo «no cuentas con líneas…» u equivalente).",
      isManualReview: false,
    };
  }

  if (
    /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/.test(body) &&
    /vinculad|l[ií]nea/i.test(body)
  ) {
    return {
      hasActiveLines: true,
      notes:
        "Altán consulta: se detectaron patrones de listado/teléfono; confirme en la captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Altán consulta: resultado no claro tras «Buscar». Revise captura o el texto mostrado en el portal.",
    isManualReview: true,
  };
}

export function matchesAltanRnuConsultaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.hostname.toLowerCase() === "rnu.altanredes.com" &&
      /\/consulta\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

async function runAltanRnuConsultaFromUrl(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  await page.goto(context.url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1500);
  return runAltanRnuConsulta(page, context);
}

const ALTAN_NO_LINE =
  /no existe o no pertenece a este operador|la l[ií]nea que introdujiste no existe/i;

export async function runAltanRnu(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const curp = context.curp?.trim();
  const phone = normalizePhone10(context.phone ?? undefined);

  if (!curp || curp.length < 14) {
    return {
      hasActiveLines: null,
      notes:
        "Patrón Altán RNU: falta configurar el CURP de verificación en el servidor.",
      isManualReview: true,
    };
  }
  if (!phone) {
    return {
      hasActiveLines: null,
      notes:
        "Patrón Altán RNU: falta el número de teléfono de prueba en el servidor (10 dígitos sin +52, ej. 5512345678).",
      isManualReview: true,
    };
  }

  await page.goto(context.url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  // El portal es una SPA: `domcontentloaded` no garantiza que el bundle haya
  // montado/hidratado el botón. Espera a la red inactiva (best-effort) y luego
  // a que «Continuar» esté visible antes de clicar, en vez de un delay fijo.
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => {});

  const continuar = page.getByRole("button", { name: /^Continuar$/i }).first();
  await continuar.waitFor({ state: "visible", timeout: 90_000 });
  await continuar.scrollIntoViewIfNeeded();
  await continuar.click({ timeout: actionTimeoutMs() });

  const curpInput = page
    .getByLabel(/CURP/i)
    .or(page.locator('input[placeholder*="AAAA" i]'))
    .first();
  await curpInput.waitFor({ state: "visible", timeout: 30_000 });
  await curpInput.fill(curp);

  const terms = page.getByRole("checkbox", {
    name: /Términos\s+y\s+Condiciones/i,
  });
  if ((await terms.count()) > 0) {
    await terms.first().check({ force: true });
  }

  const privacy = page.getByRole("checkbox", {
    name: /Aviso\s+de\s+Privacidad/i,
  });
  if ((await privacy.count()) > 0) {
    await privacy.first().check({ force: true });
  }

  const phoneInput = page
    .getByRole("textbox", { name: /celular|número/i })
    .or(page.locator('input[placeholder*="5512345678" i]'))
    .or(page.locator('input[placeholder*="12345678" i]'))
    .first();
  await phoneInput.waitFor({ state: "visible", timeout: 15_000 });
  await phoneInput.fill(phone);

  const continuarSubmit = page
    .getByRole("button", { name: /^Continuar$/i })
    .first();
  await continuarSubmit.waitFor({ state: "visible", timeout: 90_000 });
  await continuarSubmit.scrollIntoViewIfNeeded();
  await continuarSubmit.click({ timeout: actionTimeoutMs() });

  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText();
    if (ALTAN_NO_LINE.test(body)) {
      return {
        hasActiveLines: false,
        notes:
          "Portal Altán: la línea no existe o no pertenece a este operador (mensaje oficial).",
        isManualReview: false,
      };
    }
    await delay(400);
  }

  const bodyFinal = await page.locator("body").innerText();
  if (ALTAN_NO_LINE.test(bodyFinal)) {
    return {
      hasActiveLines: false,
      notes: "Portal Altán: sin líneas según mensaje del operador.",
      isManualReview: false,
    };
  }

  if (
    /validaci[oó]n de identidad|prueba de vida|selfie|toma una foto/i.test(
      bodyFinal,
    ) &&
    !ALTAN_NO_LINE.test(bodyFinal)
  ) {
    return {
      hasActiveLines: true,
      notes:
        "El portal avanzó a validación de identidad (no apareció el error de línea inexistente). Confirme visualmente si aplica línea activa.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Altán RNU: en 25s no se detectó el mensaje de línea inexistente ni un paso claro de éxito. Revise captchas o cambios en el portal.",
    isManualReview: true,
  };
}

export const altanRnuPattern: CompanyPattern = {
  id: "altan-rnu",
  matches: () => false,
  matchesUrl: matchesAltanRnuUrl,
  supportsAutomatedVerification: true,
  run: runAltanRnu,
};

export const altanRnuConsultaPattern: CompanyPattern = {
  id: "altan-rnu-consulta",
  matches: () => false,
  matchesUrl: matchesAltanRnuConsultaUrl,
  supportsAutomatedVerification: true,
  run: runAltanRnuConsultaFromUrl,
};
