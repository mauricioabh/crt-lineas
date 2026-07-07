import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/ingest/route";
import { requireAdminUser } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  requireAdminUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

vi.mock("@/lib/playwright-launch", () => ({
  launchChromium: vi.fn(),
}));

describe("POST /api/ingest authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(requireAdminUser).mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await POST();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when authenticated but not admin", async () => {
    vi.mocked(requireAdminUser).mockRejectedValue(new Error("FORBIDDEN"));

    const response = await POST();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });
});
