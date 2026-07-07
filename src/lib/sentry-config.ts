import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

const SENSITIVE_KEYS = /authorization|cookie|token|password|email|curp|phone/i;

function scrubValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/[A-Z]{4}\d{6}[A-Z]{6}\d{2}/gi, "[REDACTED_CURP]");
  }
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.test(k) ? "[REDACTED]" : scrubValue(v);
    }
    return out;
  }
  return value;
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_KEYS.test(key)) {
        event.request.headers[key] = "[REDACTED]";
      }
    }
  }
  if (event.extra) event.extra = scrubValue(event.extra) as ErrorEvent["extra"];
  return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.data) {
    breadcrumb.data = scrubValue(breadcrumb.data) as Breadcrumb["data"];
  }
  return breadcrumb;
}

export function getSentryDsn(): string | undefined {
  return process.env.SENTRY_DSN?.trim() || undefined;
}
