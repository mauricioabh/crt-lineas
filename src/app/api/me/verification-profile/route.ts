import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { authErrorResponse } from "@/lib/http";
import { parseVerificationIdentityInput } from "@/lib/verification-identity";
import {
  deleteVerificationProfile,
  getVerificationProfileStatus,
  upsertVerificationProfile,
} from "@/lib/verification-profile";

export async function GET() {
  try {
    const userId = await requireUserId();
    const status = await getVerificationProfileStatus(userId);
    return NextResponse.json(status);
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

export async function PUT(request: Request) {
  try {
    const userId = await requireUserId();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Cuerpo JSON inválido" },
        { status: 400 },
      );
    }
    const parsed = parseVerificationIdentityInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const status = await upsertVerificationProfile(userId, parsed.value);
    return NextResponse.json(status);
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId();
    await deleteVerificationProfile(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }
}
