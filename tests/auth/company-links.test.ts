import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/company-links/[linkId]/screenshot/route";
import { PATCH } from "@/app/api/company-links/[linkId]/route";
import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    companyLink: {
      findUnique: vi.fn(),
    },
    userCompanyLinkResult: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/review-screenshot-storage", () => ({
  readReviewScreenshotFromDisk: vi.fn(),
}));

describe("company-links user isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes screenshot lookup to the authenticated user", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user-a");
    vi.mocked(prisma.userCompanyLinkResult.findUnique).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/company-links/link-1/screenshot"),
      {
        params: Promise.resolve({ linkId: "link-1" }),
      },
    );

    expect(response.status).toBe(404);
    expect(prisma.userCompanyLinkResult.findUnique).toHaveBeenCalledWith({
      where: { userId_linkId: { userId: "user-a", linkId: "link-1" } },
      select: { reviewScreenshotAt: true, reviewScreenshotUtKey: true },
    });
  });

  it("user A cannot read user B review result via screenshot route", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user-a");
    vi.mocked(prisma.userCompanyLinkResult.findUnique).mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/company-links/shared-link/screenshot"),
      {
        params: Promise.resolve({ linkId: "shared-link" }),
      },
    );

    expect(response.status).toBe(404);
    expect(prisma.userCompanyLinkResult.findUnique).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_linkId: { userId: "user-b", linkId: "shared-link" } },
      }),
    );
  });

  it("PATCH upserts review state only for the authenticated user", async () => {
    vi.mocked(requireUserId).mockResolvedValue("user-a");
    vi.mocked(prisma.companyLink.findUnique).mockResolvedValue({
      id: "link-1",
    } as Awaited<ReturnType<typeof prisma.companyLink.findUnique>>);
    vi.mocked(prisma.userCompanyLinkResult.upsert).mockResolvedValue({
      id: "result-a",
      userId: "user-a",
      linkId: "link-1",
    } as Awaited<ReturnType<typeof prisma.userCompanyLinkResult.upsert>>);

    const response = await PATCH(
      new Request("http://localhost/api/company-links/link-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isReviewed: true }),
      }),
      { params: Promise.resolve({ linkId: "link-1" }) },
    );

    expect(response.status).toBe(200);
    expect(prisma.userCompanyLinkResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_linkId: { userId: "user-a", linkId: "link-1" } },
        create: expect.objectContaining({ userId: "user-a", linkId: "link-1" }),
      }),
    );
  });
});
