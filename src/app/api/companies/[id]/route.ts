import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/validate";
import { UpdateCompanyBodySchema } from "@/lib/openapi/schemas";
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseJsonBody(UpdateCompanyBodySchema, body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const updated = await prisma.company.update({
      where: { id },
      data: { enabled: parsed.data.enabled },
    });
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }
}
