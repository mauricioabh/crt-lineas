import type { Page } from "playwright";
import type {
  CompanyPattern,
  MonitorRunContext,
  MonitorResult,
} from "../base-pattern";

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function tryFillCurp(page: Page, curp: string) {
  const selectors = [
    'input[name*="curp" i]',
    'input[id*="curp" i]',
    'input[placeholder*="CURP" i]',
    "#curp",
    'textarea[name*="curp" i]',
  ];
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.fill(curp);
      return true;
    }
  }
  return false;
}

function inferFromBodyText(body: string): boolean | null {
  const lower = body.toLowerCase();
  if (/no\s+(cuenta|tiene|hay)\s+con\s+l[ií]neas/i.test(lower)) {
    return false;
  }
  if (/sin\s+l[ií]neas/i.test(lower) && !/l[ií]neas?\s+activas/i.test(lower)) {
    return false;
  }
  if (
    /l[ií]nea(s)?\s+activa(s)?/i.test(body) ||
    /l[ií]neas?\s+registradas/i.test(body)
  ) {
    if (/ninguna|no\s+se\s+encontr/i.test(lower)) {
      return false;
    }
    return true;
  }
  return null;
}

export async function runGeneric(
  page: Page,
  context: MonitorRunContext,
): Promise<MonitorResult> {
  await page.goto(context.url, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await delay(1500);

  if (context.curp) {
    await tryFillCurp(page, context.curp);
  }

  await delay(context.manualWaitMs);

  const body = await page.locator("body").innerText();
  const hasActiveLines = inferFromBodyText(body);
  const notes =
    hasActiveLines === null
      ? "No se pudo inferir el resultado automáticamente; revise la página abierta y actualice el estado manualmente si aplica."
      : "Resultado inferido por texto de la página; confirme visualmente.";

  return {
    hasActiveLines,
    notes,
    isManualReview: hasActiveLines === null,
  };
}

export const genericPattern: CompanyPattern = {
  id: "generic",
  matches: () => true,
  supportsAutomatedVerification: false,
  run: runGeneric,
};
