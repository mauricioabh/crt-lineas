import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/validate";
import { UpdateCompanyLinkBodySchema } from "@/lib/openapi/schemas";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ linkId: string }> },
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  const { linkId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseJsonBody(UpdateCompanyLinkBodySchema, body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const patch = parsed.data;

  const data: {
    hasActiveLines?: boolean | null;
    isManualReview?: boolean;
    isReviewed?: boolean;
    reviewNotes?: string | null;
    lastReviewedAt?: Date;
  } = {};

  if ("hasActiveLines" in patch) {
    data.hasActiveLines = patch.hasActiveLines ?? null;
  }
  if (typeof patch.isManualReview === "boolean") {
    data.isManualReview = patch.isManualReview;
  }
  if (typeof patch.isReviewed === "boolean") {
    data.isReviewed = patch.isReviewed;
  }
  if (patch.notes !== undefined) {
    data.reviewNotes = patch.notes;
  }
  if (
    "hasActiveLines" in patch ||
    typeof patch.isManualReview === "boolean" ||
    typeof patch.isReviewed === "boolean"
  ) {
    data.lastReviewedAt = new Date();
  }

  const link = await prisma.companyLink.findUnique({
    where: { id: linkId },
    select: { id: true },
  });
  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  const updated = await prisma.userCompanyLinkResult.upsert({
    where: { userId_linkId: { userId, linkId } },
    create: { userId, linkId, ...data },
    update: data,
  });
  return NextResponse.json(updated);
}
