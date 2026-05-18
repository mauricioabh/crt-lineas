import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CompaniesTable } from "@/components/companies-table";
import { getCurrentRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isVerificationProfileComplete } from "@/lib/verification-profile";
import {
  getLinkVerificationStatus,
  type VerificationStatus,
} from "@/monitoring";

export const dynamic = "force-dynamic";

export type DashboardCompany = {
  id: string;
  name: string;
  enabled: boolean;
  links: DashboardCompanyLink[];
};

export type DashboardCompanyLink = {
  id: string;
  label: string;
  url: string;
  /** Tri-state automation status derived from the monitoring pattern registry. */
  verificationStatus: VerificationStatus;
  hasActiveLines: boolean | null;
  isReviewed: boolean;
  isManualReview: boolean;
  lastReviewedAt: string | null;
  reviewNotes: string | null;
  reviewScreenshotAt: string | null;
  /** Último fallo de verificación automática (se limpia al completar un run exitoso). */
  lastMonitorErrorAt: string | null;
  lastMonitorErrorMessage: string | null;
  lastMonitorErrorDetail: string | null;
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  if (!(await isVerificationProfileComplete(userId))) {
    redirect("/dashboard/setup");
  }

  const role = await getCurrentRole();
  const where = role === "admin" ? {} : { enabled: true };

  const [companies, userResults] = await Promise.all([
    prisma.company.findMany({
      where,
      include: { links: { orderBy: { label: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.userCompanyLinkResult.findMany({
      where: { userId },
      select: {
        linkId: true,
        hasActiveLines: true,
        isReviewed: true,
        isManualReview: true,
        lastReviewedAt: true,
        reviewNotes: true,
        reviewScreenshotAt: true,
        lastMonitorErrorAt: true,
        lastMonitorErrorMessage: true,
        lastMonitorErrorDetail: true,
      },
    }),
  ]);

  const resultByLinkId = new Map(userResults.map((r) => [r.linkId, r]));

  const serialized: DashboardCompany[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    enabled: c.enabled,
    links: c.links.map((l) => {
      const r = resultByLinkId.get(l.id);
      return {
        id: l.id,
        label: l.label,
        url: l.url,
        verificationStatus: getLinkVerificationStatus(c.name, l.url),
        hasActiveLines: r?.hasActiveLines ?? null,
        isReviewed: r?.isReviewed ?? false,
        isManualReview: r?.isManualReview ?? false,
        lastReviewedAt: r?.lastReviewedAt?.toISOString() ?? null,
        reviewNotes: r?.reviewNotes ?? null,
        reviewScreenshotAt: r?.reviewScreenshotAt?.toISOString() ?? null,
        lastMonitorErrorAt: r?.lastMonitorErrorAt?.toISOString() ?? null,
        lastMonitorErrorMessage: r?.lastMonitorErrorMessage ?? null,
        lastMonitorErrorDetail: r?.lastMonitorErrorDetail ?? null,
      };
    }),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Monitoreo de compañías
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Lista sincronizada desde el portal del CRT (solo enlaces tipo
          Persona). La columna «Auto»: Sí (flujo automatizado activo), En
          revisión (protocolo escrito, en pruebas), Pendiente (portal
          identificado, flujo aún no definido), No (sin protocolo; usar ajuste
          manual).
        </p>
      </div>
      <CompaniesTable companies={serialized} isAdmin={role === "admin"} />
    </div>
  );
}
