import { prisma } from "@/lib/db";
import { sanitizeEnvFromUserFacingText } from "@/lib/monitor-error-format";

const MAX_USER = 4000;
const MAX_TECH = 50_000;

export async function persistMonitorVerificationFailure(
  linkId: string,
  userId: string,
  opts: {
    userFacingMessage: string;
    technicalDetail: string;
    patternId?: string | null;
    batchId?: string | null;
  },
): Promise<void> {
  const userFacing = sanitizeEnvFromUserFacingText(
    opts.userFacingMessage,
  ).slice(0, MAX_USER);
  const technical = sanitizeEnvFromUserFacingText(opts.technicalDetail).slice(
    0,
    MAX_TECH,
  );
  const now = new Date();
  await prisma.$transaction([
    prisma.monitorVerificationLog.create({
      data: {
        linkId,
        userId,
        success: false,
        userFacingMessage: userFacing,
        technicalDetail: technical,
        patternId: opts.patternId ?? null,
        batchId: opts.batchId ?? null,
      },
    }),
    prisma.userCompanyLinkResult.upsert({
      where: { userId_linkId: { userId, linkId } },
      create: {
        userId,
        linkId,
        lastMonitorErrorAt: now,
        lastMonitorErrorMessage: userFacing,
        lastMonitorErrorDetail: technical,
      },
      update: {
        lastMonitorErrorAt: now,
        lastMonitorErrorMessage: userFacing,
        lastMonitorErrorDetail: technical,
      },
    }),
  ]);
}
