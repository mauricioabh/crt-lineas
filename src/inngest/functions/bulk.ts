import { NonRetriableError } from "inngest";
import { inngest } from "@/inngest/client";
import {
  completeMonitorBulkJobItem,
  isMonitorBulkJobCancelled,
  markMonitorBulkJobItemRunning,
  markMonitorBulkJobRunning,
} from "@/lib/monitor-bulk-job";
import { verifyMonitorLinkForBulk } from "@/lib/monitor-bulk-verify-item";
import { prisma } from "@/lib/db";

function monitorEnvMs(name: string, fallback: number): number {
  const raw = Number(process.env[name] ?? fallback);
  return Number.isFinite(raw) ? raw : fallback;
}

export const monitorBulkStart = inngest.createFunction(
  { id: "monitor-bulk-start", name: "Monitor bulk — fan-out" },
  { event: "monitor/bulk.started" },
  async ({ event, step }) => {
    const { jobId, userId } = event.data;

    const job = await step.run("load-job", () =>
      prisma.monitorBulkJob.findFirst({
        where: { id: jobId, userId },
        include: { items: { orderBy: { index: "asc" } } },
      }),
    );

    if (!job) {
      throw new NonRetriableError(`Job ${jobId} not found`);
    }

    const pending = job.items.filter((item) => item.status === "pending");
    if (pending.length === 0) {
      return { jobId, dispatched: 0 };
    }

    await step.run("mark-running", () => markMonitorBulkJobRunning(jobId));

    await step.sendEvent(
      "fan-out-links",
      pending.map((item) => ({
        name: "monitor/link.verify" as const,
        data: {
          jobId,
          userId,
          itemId: item.id,
          linkId: item.linkId,
          index: item.index,
          batchId: job.batchId,
        },
      })),
    );

    return { jobId, dispatched: pending.length };
  },
);

export const monitorLinkVerify = inngest.createFunction(
  {
    id: "monitor-link-verify",
    name: "Monitor bulk — verify link",
    retries: 2,
    onFailure: async ({ event, error }) => {
      const { itemId } = event.data.event.data;
      await completeMonitorBulkJobItem(itemId, {
        ok: false,
        error: error.message,
      });
    },
  },
  { event: "monitor/link.verify" },
  async ({ event, step }) => {
    const { jobId, userId, itemId, linkId, batchId } = event.data;

    const cancelled = await step.run("check-cancelled", () =>
      isMonitorBulkJobCancelled(jobId),
    );
    if (cancelled) {
      await step.run("skip-cancelled", () =>
        completeMonitorBulkJobItem(itemId, {
          ok: false,
          skipped: true,
          error: "Cancelado por el usuario.",
        }),
      );
      return { skipped: true, reason: "cancelled" };
    }

    await step.run("mark-item-running", () =>
      markMonitorBulkJobItemRunning(itemId),
    );

    const manualWaitMs = monitorEnvMs("MONITOR_MANUAL_WAIT_MS", 120_000);
    // Cap por ítem. En el worker Hetzner (proceso persistente) los patrones
    // navegan hasta 120 s, así que el default debe superar la navegación + las
    // esperas; 180 s cubre el caso común. El viejo default de 20 s venía del
    // presupuesto corto de Vercel serverless y cancelaba casi toda verificación.
    // Ajustable/deshabilitable con MONITOR_BULK_ITEM_TIMEOUT_MS (0 = sin cap).
    const rawItemTimeout = monitorEnvMs(
      "MONITOR_BULK_ITEM_TIMEOUT_MS",
      180_000,
    );
    const itemTimeoutMs = rawItemTimeout > 0 ? rawItemTimeout : null;

    const result = await step.run("verify-link", () =>
      verifyMonitorLinkForBulk({
        userId,
        linkId,
        batchId,
        manualWaitMs,
        itemTimeoutMs,
      }),
    );

    if (result.skipped || result.ok || result.retriable === false) {
      await step.run("persist-item", () =>
        completeMonitorBulkJobItem(itemId, result),
      );
      return result;
    }

    throw new Error(result.error ?? "Monitor verification failed");
  },
);
