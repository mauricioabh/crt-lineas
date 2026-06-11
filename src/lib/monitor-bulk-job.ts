import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type MonitorBulkJobWithItems = Prisma.MonitorBulkJobGetPayload<{
  include: { items: true };
}>;

export async function createMonitorBulkJob(params: {
  userId: string;
  linkIds: string[];
  linksById: Map<
    string,
    Prisma.CompanyLinkGetPayload<{ include: { company: true } }>
  >;
}): Promise<MonitorBulkJobWithItems> {
  const batchId = randomUUID();
  const itemsData = params.linkIds.map((linkId, i) => {
    const link = params.linksById.get(linkId);
    return {
      linkId,
      index: i + 1,
      companyName: link?.company.name ?? "",
    };
  });

  return prisma.monitorBulkJob.create({
    data: {
      userId: params.userId,
      batchId,
      total: params.linkIds.length,
      status: "pending",
      items: { create: itemsData },
    },
    include: { items: { orderBy: { index: "asc" } } },
  });
}

export async function getMonitorBulkJob(
  jobId: string,
  userId: string,
): Promise<MonitorBulkJobWithItems | null> {
  return prisma.monitorBulkJob.findFirst({
    where: { id: jobId, userId },
    include: { items: { orderBy: { index: "asc" } } },
  });
}

export async function markMonitorBulkJobRunning(jobId: string): Promise<void> {
  await prisma.monitorBulkJob.update({
    where: { id: jobId },
    data: { status: "running" },
  });
}

export async function cancelMonitorBulkJob(jobId: string): Promise<void> {
  await prisma.monitorBulkJob.update({
    where: { id: jobId },
    data: { cancelled: true, status: "cancelled" },
  });
}

export async function isMonitorBulkJobCancelled(
  jobId: string,
): Promise<boolean> {
  const job = await prisma.monitorBulkJob.findUnique({
    where: { id: jobId },
    select: { cancelled: true },
  });
  return job?.cancelled ?? false;
}

export async function markMonitorBulkJobItemRunning(
  itemId: string,
): Promise<void> {
  await prisma.monitorBulkJobItem.update({
    where: { id: itemId },
    data: { status: "running" },
  });
}

export async function completeMonitorBulkJobItem(
  itemId: string,
  result: {
    ok: boolean;
    error?: string;
    patternId?: string;
    skipped?: boolean;
  },
): Promise<void> {
  const item = await prisma.monitorBulkJobItem.update({
    where: { id: itemId },
    data: {
      status: result.skipped ? "skipped" : result.ok ? "succeeded" : "failed",
      ok: result.ok,
      error: result.error ?? null,
      patternId: result.patternId ?? null,
      attempt: { increment: 1 },
    },
    select: { jobId: true },
  });

  await prisma.monitorBulkJob.update({
    where: { id: item.jobId },
    data: {
      okCount: result.ok ? { increment: 1 } : undefined,
      failCount: !result.ok ? { increment: 1 } : undefined,
    },
  });

  await finalizeMonitorBulkJobIfDone(item.jobId);
}

async function finalizeMonitorBulkJobIfDone(jobId: string): Promise<void> {
  const job = await prisma.monitorBulkJob.findUnique({
    where: { id: jobId },
    include: { items: true },
  });
  if (!job) return;

  const pending = job.items.filter(
    (i) => i.status === "pending" || i.status === "running",
  );
  if (pending.length > 0) return;

  await prisma.monitorBulkJob.update({
    where: { id: jobId },
    data: {
      status: job.cancelled ? "cancelled" : "completed",
    },
  });
}

export async function failMonitorBulkJob(
  jobId: string,
  error: string,
): Promise<void> {
  await prisma.monitorBulkJob.update({
    where: { id: jobId },
    data: { status: "failed", fatalError: error },
  });
}
