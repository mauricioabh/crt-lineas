import type { MonitorBulkSsePayload } from "@/lib/monitor-bulk-sse";
import { sleep } from "@/lib/monitor-bulk-sse";
import {
  cancelMonitorBulkJob,
  getMonitorBulkJob,
} from "@/lib/monitor-bulk-job";

const TERMINAL_ITEM = new Set(["succeeded", "failed", "skipped"]);
const POLL_MS = 500;

export async function streamMonitorBulkJobSse(
  jobId: string,
  userId: string,
  signal: AbortSignal,
  send: (payload: MonitorBulkSsePayload) => void,
): Promise<void> {
  const emittedStart = new Set<string>();
  const emittedItem = new Set<string>();
  let startSent = false;

  while (!signal.aborted) {
    const job = await getMonitorBulkJob(jobId, userId);
    if (!job) {
      send({ type: "fatal", error: "Trabajo no encontrado." });
      return;
    }

    if (!startSent) {
      send({ type: "start", total: job.total });
      startSent = true;
    }

    for (const item of job.items) {
      if (item.status === "running" && !emittedStart.has(item.id)) {
        emittedStart.add(item.id);
        send({
          type: "item_start",
          index: item.index,
          linkId: item.linkId,
          companyName: item.companyName,
        });
      }

      if (TERMINAL_ITEM.has(item.status) && !emittedItem.has(item.id)) {
        emittedItem.add(item.id);
        send({
          type: "item",
          index: item.index,
          linkId: item.linkId,
          companyName: item.companyName,
          ok: item.ok ?? false,
          error: item.error ?? undefined,
          patternId: item.patternId ?? undefined,
        });
      }
    }

    if (
      job.status === "completed" ||
      job.status === "cancelled" ||
      job.status === "failed"
    ) {
      send({
        type: "done",
        ok: job.okCount,
        fail: job.failCount,
        ...(job.cancelled ? { cancelled: true } : {}),
      });
      if (job.status === "failed" && job.fatalError) {
        send({ type: "fatal", error: job.fatalError });
      }
      return;
    }

    if (signal.aborted) {
      await cancelMonitorBulkJob(jobId);
      const refreshed = await getMonitorBulkJob(jobId, userId);
      send({
        type: "done",
        ok: refreshed?.okCount ?? job.okCount,
        fail: refreshed?.failCount ?? job.failCount,
        cancelled: true,
      });
      return;
    }

    await sleep(POLL_MS);
  }
}
