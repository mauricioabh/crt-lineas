import { NextResponse } from "next/server";
import { getCurrentRole, requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUserId();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  const role = await getCurrentRole();
  const where = role === "admin" ? {} : { enabled: true };

  const companies = await prisma.company.findMany({
    where,
    include: { links: { orderBy: { label: "asc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(companies);
}
