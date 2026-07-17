import { monitorBulkStart, monitorLinkVerify } from "./bulk";
import { ingestScrape } from "./ingest";

export { monitorBulkStart, monitorLinkVerify } from "./bulk";
export { ingestScrape } from "./ingest";

/**
 * Todas las funciones de navegador (scraping + verificación). El worker Hetzner
 * las sirve vía Inngest Connect; Vercel puede servirlas temporalmente detrás del
 * flag de coexistencia para rollback.
 */
export const browserFunctions = [
  monitorBulkStart,
  monitorLinkVerify,
  ingestScrape,
];

/** Alias retro-compatible usado por `serve()` en `/api/inngest`. */
export const functions = browserFunctions;
