/** Celular MX a 10 dígitos (sin +52). */
export function normalizePhone10(
  raw: string | undefined | null,
): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 10) return digits.slice(-10);
  return null;
}

/** CURP en mayúsculas, sin espacios. */
export function normalizeCurp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const curp = raw.trim().toUpperCase().replace(/\s/g, "");
  if (curp.length !== 18) return null;
  if (!/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/.test(curp)) return null;
  return curp;
}

export function maskCurp(curp: string): string {
  if (curp.length < 8) return "********";
  return `${curp.slice(0, 4)}********${curp.slice(-4)}`;
}

export function maskPhone10(phone: string): string {
  if (phone.length < 4) return "**********";
  return `${phone.slice(0, 2)}******${phone.slice(-2)}`;
}

export type VerificationIdentityInput = {
  curp: string;
  phone: string;
  privacyNoticeAccepted: boolean;
};

export function parseVerificationIdentityInput(
  body: unknown,
):
  | { ok: true; value: VerificationIdentityInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Cuerpo JSON inválido" };
  }
  const curpRaw = "curp" in body ? (body as { curp: unknown }).curp : null;
  const phoneRaw = "phone" in body ? (body as { phone: unknown }).phone : null;
  if (typeof curpRaw !== "string" || typeof phoneRaw !== "string") {
    return { ok: false, error: "Se requieren curp y phone (texto)" };
  }
  const privacyNoticeAccepted =
    "privacyNoticeAccepted" in body
      ? (body as { privacyNoticeAccepted: unknown }).privacyNoticeAccepted
      : false;
  if (privacyNoticeAccepted !== true) {
    return {
      ok: false,
      error: "Debes aceptar el aviso de privacidad para guardar tus datos.",
    };
  }
  const curp = normalizeCurp(curpRaw);
  if (!curp) {
    return {
      ok: false,
      error: "CURP inválida (18 caracteres, formato oficial)",
    };
  }
  const phone = normalizePhone10(phoneRaw);
  if (!phone) {
    return {
      ok: false,
      error: "Celular inválido (10 dígitos, sin +52)",
    };
  }
  return { ok: true, value: { curp, phone, privacyNoticeAccepted } };
}
