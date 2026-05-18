import { prisma } from "@/lib/db";
import { sanitizeEnvFromUserFacingText } from "@/lib/monitor-error-format";

const MAX_USER = 4000;
const MAX_TECH = 50_000;

export async function persistMonitorVerificationFailure(
  linkId: string,
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
  await prisma.$transaction([
    prisma.monitorVerificationLog.create({
      data: {
        linkId,
        success: false,
        userFacingMessage: userFacing,
        technicalDetail: technical,
        patternId: opts.patternId ?? null,
        batchId: opts.batchId ?? null,
      },
    }),
    prisma.companyLink.update({
      where: { id: linkId },
      data: {
        lastMonitorErrorAt: new Date(),
        lastMonitorErrorMessage: userFacing,
        lastMonitorErrorDetail: technical,
      },
    }),
  ]);
}
