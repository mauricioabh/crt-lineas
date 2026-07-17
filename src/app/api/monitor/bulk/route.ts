import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/validate";
import { MonitorBulkBodySchema } from "@/lib/openapi/schemas";
import { requireUserId } from "@/lib/auth";
import { requireMonitorCredentials } from "@/lib/verification-profile";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";
import { inngest } from "@/inngest/client";
import {
  createMonitorBulkJob,
  getMonitorBulkJob,
} from "@/lib/monitor-bulk-job";
import { createMonitorJobSseResponse } from "@/lib/monitor-job-sse-response";

export const runtime = "nodejs";

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) {
      continue;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Encola una verificación masiva en Inngest (ejecutada por el worker Hetzner) y
 * transmite el progreso desde la base de datos por SSE. Ya no lanza Chromium en
 * Vercel; siempre pasa por el `MonitorBulkJob`.
 */
export async function POST(request: Request) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Cuerpo JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = parseJsonBody(MonitorBulkBodySchema, body);
  if ("error" in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const linkIds = dedupePreserveOrder(parsed.data.linkIds);

  const links = await prisma.companyLink.findMany({
    where: { id: { in: linkIds } },
    include: { company: true },
  });
  const linksById = new Map(links.map((l) => [l.id, l]));

  const job = await createMonitorBulkJob({ userId, linkIds, linksById });
  await inngest.send({
    name: "monitor/bulk.started",
    data: { jobId: job.id, userId },
  });

  return createMonitorJobSseResponse(job.id, userId, request.signal);
}

/**
 * Reconexión: reanuda el stream SSE de un job existente (`?jobId=`).
 * `streamMonitorBulkJobSse` reconstruye el estado desde la DB, por lo que el
 * cliente recupera los items ya completados sin perderlos.
 */
export async function GET(request: Request) {
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

  const jobId = new URL(request.url).searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json(
      { error: "Falta el parámetro jobId" },
      { status: 400 },
    );
  }

  const job = await getMonitorBulkJob(jobId, userId);
  if (!job) {
    return NextResponse.json(
      { error: "Trabajo no encontrado" },
      { status: 404 },
    );
  }

  return createMonitorJobSseResponse(jobId, userId, request.signal);
}
