import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminUser();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  const { id } = await context.params;
  const body = (await request.json()) as { enabled?: unknown };

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled (boolean) required" },
      { status: 400 },
    );
  }

  try {
    const updated = await prisma.company.update({
      where: { id },
      data: { enabled: body.enabled },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
}
