import * as Sentry from "@sentry/nextjs";
import {
  getSentryDsn,
  scrubBreadcrumb,
  scrubSentryEvent,
} from "./src/lib/sentry-config";

Sentry.init({
  dsn: getSentryDsn(),
  enabled: Boolean(getSentryDsn()),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  beforeSend: scrubSentryEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});
