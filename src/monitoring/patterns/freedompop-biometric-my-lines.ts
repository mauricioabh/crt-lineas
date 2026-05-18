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

/** Sin líneas / credencial sin líneas asociadas (mensajes reales del portal FreedomPop). */
const NO_LINES_OR_REJECT = new RegExp(
  [
    "no associated lines",
    "has no associated lines",
    "information you entered has no",
    "sin l[ií]neas asociadas",
    "no hay l[ií]neas",
    "no lines associated",
    "no se encontr",
    "not found",
    "invalid",
    "incorrect",
    "this field is required",
    "este campo es obligatorio",
  ].join("|"),
  "i",
);

/** Fallo transitorio del backend: no implica «sin líneas», conviene reintentar. */
const TRANSIENT_RETRIEVE_ERROR =
  /error retrieving lines|try again later|an error occurred while trying to retrieve/i;

/**
 * Biometric Portal — FreedomPop (Chedraui móvil y marcas que compartan ruta), ej.
 * `https://vinculatulinea.com/Chedrauimovil` (CRT) → redirige a `freedompop/welcome` → **My Lines**,
 * o `…/freedompop/welcome`, o `…/Freedompop` (hub sin sub-ruta), o enlace directo a `…/my-lines`.
 */
export function matchesFreedompopBiometricMyLinesUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vinculatulinea.com") return false;
    const p = u.pathname;
    return (
      /\/freedompop\/(my-lines|welcome)/i.test(p) ||
      /^\/freedompop\/?$/i.test(p) ||
      /\/chedrauimovil\/?$/i.test(p)
    );
  } catch {
    return false;
  }
}

/**
 * Abre la URL del CRT (p. ej. Chedraui), espera redirección SPA y deja el formulario en `…/my-lines`.
 */
async function ensureOnMyLinesForm(
  page: Page,
  entryUrl: string,
): Promise<void> {
  await page.goto(entryUrl, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(2500);

  let u = page.url();
  // Hub `…/Freedompop` o `…/freedompop` sin `/welcome` ni `/my-lines`: el CRT a veces guarda solo eso.
  try {
    const path = new URL(u).pathname;
    if (/^\/freedompop\/?$/i.test(path)) {
      const origin = new URL(u).origin;
      await page.goto(`${origin}/freedompop/welcome`, {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
      await delay(2000);
      u = page.url();
    }
  } catch {
    // seguir con el flujo habitual
  }

  for (let i = 0; i < 45; i += 1) {
    if (
      /\/freedompop\/(my-lines|welcome)/i.test(u) ||
      /\/ahorrocel\/(my-lines|welcome)/i.test(u)
    ) {
      break;
    }
    await delay(400);
    u = page.url();
  }

  const slugMatch = u.match(/\/(freedompop|ahorrocel)\//i);
  const slug = slugMatch ? slugMatch[1]!.toLowerCase() : "freedompop";
  const welcomeRe = new RegExp(`/${slug}/welcome/?$`, "i");
  const myLinesRe = new RegExp(`/${slug}/my-lines`, "i");

  if (welcomeRe.test(new URL(u).pathname)) {
    const myLines = page
      .getByRole("button", { name: /^My Lines$/i })
      .or(page.getByRole("link", { name: /^My Lines$/i }));

    try {
      await myLines.first().click({ timeout: 15_000 });
    } catch {
      await page.goto(u.replace(/\/welcome\/?$/i, "/my-lines"), {
        waitUntil: "domcontentloaded",
        timeout: 120_000,
      });
    }
    await page.waitForURL(myLinesRe, { timeout: 25_000 }).catch(() => {});
    await delay(1200);
  } else if (!myLinesRe.test(u)) {
    let target = entryUrl;
    if (/\/welcome\/?$/i.test(target)) {
      target = target.replace(/\/welcome\/?$/i, "/my-lines");
    }
    await page
      .goto(target, { waitUntil: "domcontentloaded", timeout: 120_000 })
      .catch(() => {});
    await delay(1200);
  }
}

export async function runVinculatulineaBiometricMyLines(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  const curp = context.curp?.trim();
  if (!curp || curp.length < 14) {
    return {
      hasActiveLines: null,
      notes:
        "Portal biométrico (vinculatulinea.com): falta configurar el CURP de verificación (o pasaporte en el mismo campo) en el servidor.",
      isManualReview: true,
    };
  }

  await ensureOnMyLinesForm(page, context.url);

  const regimeSelect = page.locator("select").first();
  if ((await regimeSelect.count()) > 0) {
    await regimeSelect.selectOption({ value: "FISICA" }).catch(async () => {
      await regimeSelect
        .selectOption({ label: "Individual" })
        .catch(async () => {
          await regimeSelect.selectOption({ index: 1 }).catch(() => {});
        });
    });
    await delay(400);
  }

  const idInput = page
    .getByPlaceholder(/Enter your CURP or Passport Number/i)
    .or(page.getByLabel(/CURP or Passport|CURP o pasaporte/i))
    .or(page.getByPlaceholder(/curp|passport|AAAA/i))
    .first();

  await idInput.waitFor({ state: "visible", timeout: 35_000 });
  await idInput.clear().catch(() => {});
  await idInput.fill(curp);
  await idInput.press("Tab").catch(() => {});

  const continueBtn = page.getByRole("button", { name: /^Continue$/i }).first();
  await continueBtn.waitFor({ state: "visible", timeout: 15_000 });
  await continueBtn.scrollIntoViewIfNeeded().catch(() => {});

  let clicked = false;
  try {
    await continueBtn.click({ timeout: 10_000 });
    clicked = true;
  } catch {
    // fallback abajo
  }
  if (!clicked) {
    try {
      await continueBtn.dispatchEvent("click");
      clicked = true;
    } catch {
      await idInput.press("Enter").catch(() => {});
    }
  }

  await delay(2800);

  const body = await page.locator("body").innerText();

  if (NO_LINES_OR_REJECT.test(body)) {
    return {
      hasActiveLines: false,
      notes:
        "Portal biométrico (FreedomPop / Chedraui): el portal indica que no hay líneas asociadas a la identificación o que la credencial no es válida.",
      isManualReview: false,
    };
  }

  if (TRANSIENT_RETRIEVE_ERROR.test(body)) {
    return {
      hasActiveLines: null,
      notes:
        "Portal biométrico: el sitio devolvió un error al recuperar líneas (posible fallo temporal). Intente de nuevo más tarde.",
      isManualReview: true,
    };
  }

  const lower = body.toLowerCase();

  // Señales de avance real (evitar /line/ suelto, que coincide con «no associated lines»).
  if (
    /otp|one[- ]time|verification code|enter (the )?code|sms code|email code/i.test(
      body,
    ) ||
    /prove your identity|proof of life|selfie|facial/i.test(lower) ||
    /dashboard|welcome back|your account/i.test(lower)
  ) {
    return {
      hasActiveLines: true,
      notes:
        "Portal biométrico: tras enviar CURP/pasaporte el sitio avanzó a un paso posterior (OTP, identidad, etc.). Revise captura.",
      isManualReview: true,
    };
  }

  return {
    hasActiveLines: null,
    notes:
      "Portal biométrico (my-lines): resultado no claro tras «Continue». Revise captura u OTP.",
    isManualReview: true,
  };
}

export const freedompopBiometricMyLinesPattern: CompanyPattern = {
  id: "freedompop-biometric-my-lines",
  matches: () => false,
  matchesUrl: matchesFreedompopBiometricMyLinesUrl,
  supportsAutomatedVerification: true,
  run: runVinculatulineaBiometricMyLines,
};

export function matchesAhorrocelBiometricMyLinesUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    return (
      host === "vinculatulinea.com" &&
      /\/ahorrocel\/(my-lines|welcome)/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

export const ahorrocelBiometricMyLinesPattern: CompanyPattern = {
  id: "ahorrocel-biometric-my-lines",
  matches: () => false,
  matchesUrl: matchesAhorrocelBiometricMyLinesUrl,
  supportsAutomatedVerification: true,
  run: runVinculatulineaBiometricMyLines,
};

// ── OUI (vinculatulinea.com/oui) ──────────────────────────────────────────────

export function matchesOuiBiometricMyLinesUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vinculatulinea.com") return false;
    const p = u.pathname;
    return /\/oui\/(my-lines|welcome)/i.test(p) || /^\/oui\/?$/i.test(p);
  } catch {
    return false;
  }
}

export const ouiBiometricMyLinesPattern: CompanyPattern = {
  id: "oui-biometric-my-lines",
  matches: () => false,
  matchesUrl: matchesOuiBiometricMyLinesUrl,
  supportsAutomatedVerification: true,
  run: runVinculatulineaBiometricMyLines,
};

// ── Yobi Telecom (vinculatulinea.com/yobitelecom) ────────────────────────────

export function matchesYobiTelecomBiometricMyLinesUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vinculatulinea.com") return false;
    const p = u.pathname;
    return (
      /\/yobitelecom\/(my-lines|welcome)/i.test(p) ||
      /^\/yobitelecom\/?$/i.test(p)
    );
  } catch {
    return false;
  }
}

export const yobiTelecomBiometricMyLinesPattern: CompanyPattern = {
  id: "yobi-telecom-biometric-my-lines",
  matches: () => false,
  matchesUrl: matchesYobiTelecomBiometricMyLinesUrl,
  supportsAutomatedVerification: true,
  run: runVinculatulineaBiometricMyLines,
};

// ── Wimotelecom (vinculatulinea.com/wimotelecom) ──────────────────────────────

export function matchesWimotelecomBiometricMyLinesUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vinculatulinea.com") return false;
    const p = u.pathname;
    return (
      /\/wimotelecom\/(my-lines|welcome)/i.test(p) ||
      /^\/wimotelecom\/?$/i.test(p)
    );
  } catch {
    return false;
  }
}

export const wimotelecomBiometricMyLinesPattern: CompanyPattern = {
  id: "wimotelecom-biometric-my-lines",
  matches: () => false,
  matchesUrl: matchesWimotelecomBiometricMyLinesUrl,
  supportsAutomatedVerification: true,
  run: runVinculatulineaBiometricMyLines,
};

// ── OXXO CEL (vinculatulinea.com/oxxo*) ───────────────────────────────────────

export function matchesOxxoCelBiometricMyLinesUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "vinculatulinea.com") return false;
    const p = u.pathname;
    return /\/oxxo/i.test(p);
  } catch {
    return false;
  }
}

export const oxxoCelBiometricMyLinesPattern: CompanyPattern = {
  id: "oxxo-cel-biometric-my-lines",
  matches: (companyName: string) => /oxxo\s*cel/i.test(companyName),
  matchesUrl: matchesOxxoCelBiometricMyLinesUrl,
  supportsAutomatedVerification: true,
  run: runVinculatulineaBiometricMyLines,
};
