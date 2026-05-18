import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";

type PatchBody = {
  hasActiveLines?: boolean | null;
  isManualReview?: boolean;
  isReviewed?: boolean;
  notes?: string | null;
};

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
  const body = (await request.json()) as PatchBody;

  const data: {
    hasActiveLines?: boolean | null;
    isManualReview?: boolean;
    isReviewed?: boolean;
    reviewNotes?: string | null;
    lastReviewedAt?: Date;
  } = {};

  if ("hasActiveLines" in body) {
    data.hasActiveLines = body.hasActiveLines ?? null;
  }
  if (typeof body.isManualReview === "boolean") {
    data.isManualReview = body.isManualReview;
  }
  if (typeof body.isReviewed === "boolean") {
    data.isReviewed = body.isReviewed;
  }
  if (body.notes !== undefined) {
    data.reviewNotes = body.notes;
  }
  if (
    "hasActiveLines" in body ||
    typeof body.isManualReview === "boolean" ||
    typeof body.isReviewed === "boolean"
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
