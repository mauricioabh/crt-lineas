import { getCurrentRole, requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Ensures the signed-in user may read this link (same rules as dashboard listing).
 */
export async function assertUserCanAccessCompanyLink(linkId: string) {
  await requireUserId();
  const role = await getCurrentRole();
  const link = await prisma.companyLink.findUnique({
    where: { id: linkId },
    include: { company: true },
  });
  if (!link) {
    throw new Error("NOT_FOUND");
  }
  if (role !== "admin" && !link.company.enabled) {
    throw new Error("FORBIDDEN");
  }
  return link;
}
