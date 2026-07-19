import type { Browser, BrowserContext } from "playwright";
import { prisma } from "@/lib/db";
import {
  launchChromium,
  newContextWithEvalShim,
  parseProxyUrl,
} from "@/lib/playwright-launch";
import {
  formatUnknownMonitorError,
  MonitorRunError,
} from "@/lib/monitor-error-format";
import { executeAutomatedMonitorOnPage } from "@/lib/monitor-verify-link";
import { requireMonitorCredentials } from "@/lib/verification-profile";
import { getPattern } from "@/monitoring";

/**
 * IDs de patrón que deben salir por el proxy (`MONITOR_PROXY_URL`). Configurable
 * con `MONITOR_PROXY_PATTERN_IDS` (coma-separado). Por defecto, los portales de
 * Altán, cuyo WAF bloquea la IP del datacenter.
 */
function proxyPatternIds(): Set<string> {
  const raw = process.env.MONITOR_PROXY_PATTERN_IDS?.trim();
  const ids = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["altan-rnu", "altan-rnu-consulta"];
  return new Set(ids);
}

function patternRequiresProxy(patternId: string): boolean {
  return proxyPatternIds().has(patternId);
}

export type VerifyMonitorLinkResult = {
  ok: boolean;
  companyName: string;
  error?: string;
  patternId?: string;
  skipped?: boolean;
  /** When false, Inngest should not retry (business/permanent failure). */
  retriable?: boolean;
};

export async function verifyMonitorLinkForBulk(params: {
  userId: string;
  linkId: string;
  batchId: string;
  itemTimeoutMs: number | null;
  manualWaitMs: number;
}): Promise<VerifyMonitorLinkResult> {
  const link = await prisma.companyLink.findUnique({
    where: { id: params.linkId },
    include: { company: true },
  });

  if (!link) {
    return {
      ok: false,
      companyName: "",
      error: "Enlace no encontrado en la base de datos.",
    };
  }

  const companyName = link.company.name;

  if (!link.company.enabled) {
    return {
      ok: false,
      companyName,
      error:
        "La compañía está deshabilitada; no se puede verificar este enlace.",
      skipped: true,
    };
  }

  const pattern = getPattern(link.company.name, link.url);
  if (!pattern.supportsAutomatedVerification) {
    return {
      ok: false,
      companyName,
      error:
        "Este enlace no tiene verificación automática configurada en la aplicación.",
      patternId: pattern.id,
      skipped: true,
    };
  }

  const credentials = await requireMonitorCredentials(params.userId);

  // Algunos portales (p. ej. Altán RNU) bloquean por IP la red del datacenter
  // (AWS WAF → 403). Para esos patrones enrutamos Chromium por un proxy
  // (IP residencial/limpia) definido en `MONITOR_PROXY_URL`. El resto sale directo.
  const proxy = patternRequiresProxy(pattern.id)
    ? parseProxyUrl(process.env.MONITOR_PROXY_URL)
    : null;

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    browser = await launchChromium({ headless: true, proxy });
    context = await newContextWithEvalShim(browser);
    const page = await context.newPage();
    try {
      const { patternId } = await executeAutomatedMonitorOnPage(page, link, {
        userId: params.userId,
        curp: credentials.curp,
        phone: credentials.phone,
        manualWaitMs: params.manualWaitMs,
        batchId: params.batchId,
        itemTimeoutMs: params.itemTimeoutMs,
      });
      return { ok: true, companyName, patternId };
    } catch (err) {
      const friendly =
        err instanceof MonitorRunError
          ? err.message
          : formatUnknownMonitorError(err).userMessage;
      if (!(err instanceof MonitorRunError)) {
        console.error(
          "[monitor/bulk] item failed (unexpected)",
          params.linkId,
          err,
        );
      }
      return {
        ok: false,
        companyName,
        error: friendly,
        patternId: pattern.id,
        retriable: false,
      };
    } finally {
      await page.close().catch(() => {});
    }
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
