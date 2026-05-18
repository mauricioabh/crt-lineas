import { NextResponse } from "next/server";

export function authErrorResponse(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (
    error instanceof Error &&
    error.message === "VERIFICATION_PROFILE_INCOMPLETE"
  ) {
    return NextResponse.json(
      {
        error:
          "Configura tu CURP y celular antes de verificar líneas (Configuración de verificación).",
        code: "VERIFICATION_PROFILE_INCOMPLETE",
      },
      { status: 428 },
    );
  }
  if (
    error instanceof Error &&
    (error.message === "MISSING_VERIFICATION_CREDENTIALS_ENCRYPTION_KEY" ||
      error.message === "INVALID_VERIFICATION_CREDENTIALS_ENCRYPTION_KEY")
  ) {
    return NextResponse.json(
      {
        error:
          "El servidor no tiene clave de cifrado configurada (VERIFICATION_CREDENTIALS_ENCRYPTION_KEY).",
        code: "MISSING_ENCRYPTION_KEY",
      },
      { status: 503 },
    );
  }
  return null;
}
