import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { authErrorResponse } from "@/lib/http";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";

/**
 * Despacha el scraping del CRT a Inngest (ejecutado por el worker Hetzner vía
 * `ingestScrape`). No lanza Chromium en Vercel; devuelve el id del job.
 */
export async function POST() {
  let requestedByUserId: string;
  try {
    const user = await requireAdminUser();
    requestedByUserId = user.id;
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  const { ids } = await inngest.send({
    name: "ingest/scrape.requested",
    data: { requestedByUserId },
  });

  return NextResponse.json({ ok: true, queued: true, jobId: ids[0] ?? null });
}
