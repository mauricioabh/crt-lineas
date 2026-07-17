import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { requireMonitorCredentials } from "@/lib/verification-profile";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";
import { inngest } from "@/inngest/client";
import { createMonitorBulkJob } from "@/lib/monitor-bulk-job";
import { createMonitorJobSseResponse } from "@/lib/monitor-job-sse-response";
import { getPattern } from "@/monitoring";

export const runtime = "nodejs";

/**
 * Verificación single asíncrona: encola un `MonitorBulkJob` de un solo item y
 * transmite el progreso/resultado por SSE (mismo camino de ejecución que bulk;
 * el navegador corre en el worker Hetzner, no en Vercel).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ linkId: string }> },
) {
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

  try {
    // Valida que el perfil de verificación esté completo (lanza 428 si no).
    await requireMonitorCredentials(userId);
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  const { linkId } = await context.params;

  const link = await prisma.companyLink.findUnique({
    where: { id: linkId },
    include: { company: true },
  });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  if (!link.company.enabled) {
    return NextResponse.json({ error: "Company disabled" }, { status: 400 });
  }

  const pattern = getPattern(link.company.name, link.url);
  if (!pattern.supportsAutomatedVerification) {
    return NextResponse.json(
      {
        error:
          "Este enlace no tiene un protocolo de verificación automatizado configurado. Use el desplegable «Líneas activas» y las acciones manuales, o espere a que se agregue soporte para este portal.",
        code: "NO_AUTOMATED_VERIFICATION_PROTOCOL",
        patternId: pattern.id,
      },
      { status: 422 },
    );
  }

  const job = await createMonitorBulkJob({
    userId,
    linkIds: [link.id],
    linksById: new Map([[link.id, link]]),
  });

  await inngest.send({
    name: "monitor/bulk.started",
    data: { jobId: job.id, userId },
  });

  return createMonitorJobSseResponse(job.id, userId, request.signal);
}
