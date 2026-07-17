import {
  encodeMonitorBulkSse,
  monitorBulkSseHeaders,
  type MonitorBulkSsePayload,
} from "@/lib/monitor-bulk-sse";
import { streamMonitorBulkJobSse } from "@/lib/monitor-bulk-job-sse";

/**
 * Devuelve una respuesta SSE que transmite el progreso/resultado de un
 * `MonitorBulkJob` leyendo su estado desde la base de datos.
 *
 * `streamMonitorBulkJobSse` reconstruye el estado completo desde la DB en cada
 * conexión (reenvía `start` + los items ya terminados), por lo que sirve tanto
 * para la conexión inicial como para una reconexión (recuperación sin perder
 * items completados).
 */
export function createMonitorJobSseResponse(
  jobId: string,
  userId: string,
  signal: AbortSignal,
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: MonitorBulkSsePayload) => {
        controller.enqueue(encodeMonitorBulkSse(payload));
      };
      try {
        await streamMonitorBulkJobSse(jobId, userId, signal, send);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: monitorBulkSseHeaders() });
}
