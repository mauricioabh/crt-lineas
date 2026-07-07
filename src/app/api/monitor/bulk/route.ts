import { randomUUID } from "node:crypto";
import type { Browser, BrowserContext } from "playwright";
import { parseJsonBody } from "@/lib/api/validate";
import { MonitorBulkBodySchema } from "@/lib/openapi/schemas";
import { launchChromium } from "@/lib/playwright-launch";
import { requireUserId } from "@/lib/auth";
import { requireMonitorCredentials } from "@/lib/verification-profile";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";
import { inngest } from "@/inngest/client";
import { isInngestEnabled } from "@/lib/inngest-enabled";
import { createMonitorBulkJob } from "@/lib/monitor-bulk-job";
import { streamMonitorBulkJobSse } from "@/lib/monitor-bulk-job-sse";
import {
  encodeMonitorBulkSse,
  monitorBulkSseHeaders,
  type MonitorBulkSsePayload,
} from "@/lib/monitor-bulk-sse";
import {
  formatUnknownMonitorError,
  MonitorRunError,
} from "@/lib/monitor-error-format";
import { executeAutomatedMonitorOnPage } from "@/lib/monitor-verify-link";
import { getPattern } from "@/monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) {
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function delayCancellable(ms: number, signal: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const t = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      signal.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort);
  });
}

async function streamInlineBulk(
  linkIds: string[],
  userId: string,
  curp: string | null,
  phone: string | null,
  signal: AbortSignal,
  send: (payload: MonitorBulkSsePayload) => void,
): Promise<void> {
  const links = await prisma.companyLink.findMany({
    where: { id: { in: linkIds } },
    include: { company: true },
  });
  const byId = new Map(links.map((l) => [l.id, l]));

  const manualWaitMs = Number(process.env.MONITOR_MANUAL_WAIT_MS ?? 120_000);
  const sameHostDelayMs = Math.max(
    0,
    Number(process.env.MONITOR_BULK_DELAY_MS ?? 5_000),
  );
  const rawItemTimeout = Number(
    process.env.MONITOR_BULK_ITEM_TIMEOUT_MS ?? 20_000,
  );
  const itemTimeoutMs =
    Number.isFinite(rawItemTimeout) && rawItemTimeout > 0
      ? rawItemTimeout
      : null;

  let ok = 0;
  let fail = 0;
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let lastBrowserHostname = "";
  let cancelled = false;
  const batchId = randomUUID();

  try {
    send({ type: "start", total: linkIds.length });

    for (let i = 0; i < linkIds.length; i += 1) {
      if (signal.aborted) {
        cancelled = true;
        break;
      }

      const linkId = linkIds[i]!;
      const index = i + 1;
      const link = byId.get(linkId);

      if (!link) {
        fail += 1;
        send({
          type: "item",
          index,
          linkId,
          companyName: "",
          ok: false,
          error: "Enlace no encontrado en la base de datos.",
        });
        continue;
      }

      const companyName = link.company.name;

      if (!link.company.enabled) {
        fail += 1;
        send({
          type: "item",
          index,
          linkId,
          companyName,
          ok: false,
          error:
            "La compañía está deshabilitada; no se puede verificar este enlace.",
        });
        continue;
      }

      const pattern = getPattern(link.company.name, link.url);
      if (!pattern.supportsAutomatedVerification) {
        fail += 1;
        send({
          type: "item",
          index,
          linkId,
          companyName,
          ok: false,
          error:
            "Este enlace no tiene verificación automática configurada en la aplicación.",
          patternId: pattern.id,
        });
        continue;
      }

      send({ type: "item_start", index, linkId, companyName });

      if (signal.aborted) {
        cancelled = true;
        break;
      }

      if (!browser) {
        browser = await launchChromium({ headless: true });
        context = await browser.newContext();
      }

      const host = hostnameOf(link.url);
      if (
        lastBrowserHostname &&
        host &&
        host === lastBrowserHostname &&
        sameHostDelayMs > 0
      ) {
        try {
          await delayCancellable(sameHostDelayMs, signal);
        } catch {
          cancelled = true;
          break;
        }
      }
      lastBrowserHostname = host;

      if (signal.aborted) {
        cancelled = true;
        break;
      }

      const page = await context!.newPage();
      try {
        const { patternId } = await executeAutomatedMonitorOnPage(page, link, {
          userId,
          curp,
          phone,
          manualWaitMs: Number.isFinite(manualWaitMs) ? manualWaitMs : 120_000,
          batchId,
          itemTimeoutMs,
        });
        ok += 1;
        send({
          type: "item",
          index,
          linkId,
          companyName,
          ok: true,
          patternId,
        });
      } catch (err) {
        fail += 1;
        const friendly =
          err instanceof MonitorRunError
            ? err.message
            : formatUnknownMonitorError(err).userMessage;
        if (!(err instanceof MonitorRunError)) {
          console.error("[monitor/bulk] item failed (unexpected)", linkId, err);
        }
        send({
          type: "item",
          index,
          linkId,
          companyName,
          ok: false,
          error: friendly,
        });
      } finally {
        await page.close().catch(() => {});
      }

      if (signal.aborted) {
        cancelled = true;
        break;
      }
    }

    send({
      type: "done",
      ok,
      fail,
      ...(cancelled ? { cancelled: true } : {}),
    });
  } catch (err) {
    const { userMessage } = formatUnknownMonitorError(err);
    console.error("[monitor/bulk] fatal", err);
    send({ type: "fatal", error: userMessage });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

export async function POST(request: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  let credentials;
  try {
    credentials = await requireMonitorCredentials(userId);
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Cuerpo JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = parseJsonBody(MonitorBulkBodySchema, body);
  if ("error" in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const linkIds = dedupePreserveOrder(parsed.data.linkIds);
  const signal = request.signal;

  const links = await prisma.companyLink.findMany({
    where: { id: { in: linkIds } },
    include: { company: true },
  });
  const linksById = new Map(links.map((l) => [l.id, l]));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: MonitorBulkSsePayload) => {
        controller.enqueue(encodeMonitorBulkSse(payload));
      };

      try {
        if (isInngestEnabled()) {
          const job = await createMonitorBulkJob({
            userId,
            linkIds,
            linksById,
          });
          await inngest.send({
            name: "monitor/bulk.started",
            data: { jobId: job.id, userId },
          });
          await streamMonitorBulkJobSse(job.id, userId, signal, send);
        } else {
          await streamInlineBulk(
            linkIds,
            userId,
            credentials.curp,
            credentials.phone,
            signal,
            send,
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: monitorBulkSseHeaders() });
}
