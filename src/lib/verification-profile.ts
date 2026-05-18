import { prisma } from "@/lib/db";
import {
  decryptSensitiveField,
  encryptSensitiveField,
} from "@/lib/field-encryption";
import {
  maskCurp,
  maskPhone10,
  type VerificationIdentityInput,
} from "@/lib/verification-identity";

export type VerificationProfileStatus = {
  complete: boolean;
  curpMasked: string | null;
  phoneMasked: string | null;
  privacyNoticeVersion: string | null;
  privacyNoticeAcceptedAt: string | null;
};

export const CURRENT_PRIVACY_NOTICE_VERSION = "2026-05-18";

export class VerificationProfileIncompleteError extends Error {
  constructor() {
    super("VERIFICATION_PROFILE_INCOMPLETE");
  }
}

export async function isVerificationProfileComplete(
  userId: string,
): Promise<boolean> {
  const row = await prisma.userVerificationProfile.findUnique({
    where: { userId },
    select: {
      privacyNoticeVersion: true,
      privacyNoticeAcceptedAt: true,
    },
  });
  return (
    row != null &&
    row.privacyNoticeVersion === CURRENT_PRIVACY_NOTICE_VERSION &&
    row.privacyNoticeAcceptedAt != null
  );
}

export async function getVerificationProfileStatus(
  userId: string,
): Promise<VerificationProfileStatus> {
  const row = await prisma.userVerificationProfile.findUnique({
    where: { userId },
    select: {
      curpEnc: true,
      phoneEnc: true,
      privacyNoticeVersion: true,
      privacyNoticeAcceptedAt: true,
    },
  });
  if (!row) {
    return {
      complete: false,
      curpMasked: null,
      phoneMasked: null,
      privacyNoticeVersion: null,
      privacyNoticeAcceptedAt: null,
    };
  }
  const curp = decryptSensitiveField(row.curpEnc);
  const phone = decryptSensitiveField(row.phoneEnc);
  const complete =
    row.privacyNoticeVersion === CURRENT_PRIVACY_NOTICE_VERSION &&
    row.privacyNoticeAcceptedAt != null;
  return {
    complete,
    curpMasked: maskCurp(curp),
    phoneMasked: maskPhone10(phone),
    privacyNoticeVersion: row.privacyNoticeVersion,
    privacyNoticeAcceptedAt: row.privacyNoticeAcceptedAt?.toISOString() ?? null,
  };
}

export async function upsertVerificationProfile(
  userId: string,
  input: VerificationIdentityInput,
): Promise<VerificationProfileStatus> {
  const curpEnc = encryptSensitiveField(input.curp);
  const phoneEnc = encryptSensitiveField(input.phone);
  const acceptedAt = new Date();
  await prisma.userVerificationProfile.upsert({
    where: { userId },
    create: {
      userId,
      curpEnc,
      phoneEnc,
      privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      privacyNoticeAcceptedAt: acceptedAt,
    },
    update: {
      curpEnc,
      phoneEnc,
      privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
      privacyNoticeAcceptedAt: acceptedAt,
    },
  });
  return {
    complete: true,
    curpMasked: maskCurp(input.curp),
    phoneMasked: maskPhone10(input.phone),
    privacyNoticeVersion: CURRENT_PRIVACY_NOTICE_VERSION,
    privacyNoticeAcceptedAt: acceptedAt.toISOString(),
  };
}

export async function deleteVerificationProfile(userId: string): Promise<void> {
  await prisma.userVerificationProfile.deleteMany({
    where: { userId },
  });
}

export type MonitorCredentials = {
  curp: string;
  phone: string;
};

/** Credenciales descifradas para Playwright (solo uso en servidor). */
export async function requireMonitorCredentials(
  userId: string,
): Promise<MonitorCredentials> {
  const row = await prisma.userVerificationProfile.findUnique({
    where: { userId },
  });
  if (!row) {
    throw new VerificationProfileIncompleteError();
  }
  return {
    curp: decryptSensitiveField(row.curpEnc),
    phone: decryptSensitiveField(row.phoneEnc),
  };
}
