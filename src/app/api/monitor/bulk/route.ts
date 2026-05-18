import { randomUUID } from "node:crypto";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { requireUserId } from "@/lib/auth";
import { requireMonitorCredentials } from "@/lib/verification-profile";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";
import {
  formatUnknownMonitorError,
  MonitorRunError,
} from "@/lib/monitor-error-format";
import { executeAutomatedMonitorOnPage } from "@/lib/monitor-verify-link";
import { getPattern } from "@/monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_LINK_IDS = 150;

type SsePayload =
  | { type: "start"; total: number }
  | { type: "item_start"; index: number; linkId: string; companyName: string }
  | {
      type: "item";
      index: number;
      linkId: string;
      companyName: string;
      ok: boolean;
      error?: string;
      patternId?: string;
    }
  | { type: "done"; ok: number; fail: number; cancelled?: boolean }
  | { type: "fatal"; error: string };

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

/** Igual que `delay`, pero rechaza con `AbortError` si el cliente cancela la petición. */
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

  const rawIds =
    body &&
    typeof body === "object" &&
    "linkIds" in body &&
    Array.isArray((body as { linkIds: unknown }).linkIds)
      ? (body as { linkIds: unknown[] }).linkIds
      : null;

  if (!rawIds) {
    return new Response(
      JSON.stringify({ error: "Se requiere { linkIds: string[] }" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const linkIds = dedupePreserveOrder(
    rawIds.filter((id): id is string => typeof id === "string"),
  );

  if (linkIds.length === 0) {
    return new Response(
      JSON.stringify({ error: "linkIds no puede estar vacío" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (linkIds.length > MAX_LINK_IDS) {
    return new Response(
      JSON.stringify({ error: `Máximo ${MAX_LINK_IDS} enlaces por solicitud` }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const links = await prisma.companyLink.findMany({
    where: { id: { in: linkIds } },
    include: { company: true },
  });
  const byId = new Map(links.map((l) => [l.id, l]));

  const manualWaitMs = Number(process.env.MONITOR_MANUAL_WAIT_MS ?? 120_000);
  const curp = credentials.curp;
  const phone = credentials.phone;
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

  const signal = request.signal;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: SsePayload) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );
      };

      let ok = 0;
      let fail = 0;
      let browser: Browser | null = null;
      let context: BrowserContext | null = null;
      let lastBrowserHostname = "";
      let cancelled = false;
      const batchId = randomUUID();

      // Persistencia de fallos ya la maneja executeAutomatedMonitorOnPage (tryPersistFailure).
      // Para fallos previos al Playwright (disabled, sin protocolo) no hay nada que persistir aquí.

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
            browser = await chromium.launch({ headless: true });
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
            const { patternId } = await executeAutomatedMonitorOnPage(
              page,
              link,
              {
                userId,
                curp,
                phone,
                manualWaitMs: Number.isFinite(manualWaitMs)
                  ? manualWaitMs
                  : 120_000,
                batchId,
                itemTimeoutMs,
              },
            );
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
            // MonitorRunError ya fue persistido en tryPersistFailure dentro de executeAutomatedMonitorOnPage.
            const friendly =
              err instanceof MonitorRunError
                ? err.message
                : formatUnknownMonitorError(err).userMessage;
            if (!(err instanceof MonitorRunError)) {
              console.error(
                "[monitor/bulk] item failed (unexpected)",
                linkId,
                err,
              );
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
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
