import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";
import { shouldServeBrowserFunctionsOnVercel } from "@/lib/inngest-serve-flag";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Flag de coexistencia: mientras `INNGEST_SERVE_BROWSER_ON_VERCEL` no sea `0`,
 * Vercel sigue sirviendo las funciones de navegador (rollback-safe). Al poner el
 * flag en `0`, el worker Hetzner queda como único ejecutor.
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: shouldServeBrowserFunctionsOnVercel() ? functions : [],
});
