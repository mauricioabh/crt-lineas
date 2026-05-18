import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";
import { readReviewScreenshotFromDisk } from "@/lib/review-screenshot-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ linkId: string }> },
) {
  const { linkId } = await context.params;

  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    throw e;
  }

  const result = await prisma.userCompanyLinkResult.findUnique({
    where: { userId_linkId: { userId, linkId } },
    select: { reviewScreenshotAt: true, reviewScreenshotUtKey: true },
  });

  if (!result?.reviewScreenshotAt) {
    return NextResponse.json({ error: "No screenshot" }, { status: 404 });
  }

  if (result.reviewScreenshotUtKey?.startsWith("https://")) {
    return NextResponse.redirect(result.reviewScreenshotUtKey, 302);
  }

  const buffer = await readReviewScreenshotFromDisk(linkId);
  if (!buffer) {
    return NextResponse.json({ error: "Screenshot missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
