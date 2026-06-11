/** SSE payloads for bulk monitor — shared by API route and OpenAPI. */
export type MonitorBulkSsePayload =
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

export function encodeMonitorBulkSse(
  payload: MonitorBulkSsePayload,
): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export function monitorBulkSseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
