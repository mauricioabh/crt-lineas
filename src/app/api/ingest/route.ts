import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/playwright-launch";
import { requireAdminUser } from "@/lib/auth";
import { scrapeCrtCompanies } from "@/lib/crt-ingest";
import { prisma } from "@/lib/db";
import { linkSupportsAutomatedVerification } from "@/monitoring";
import { authErrorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    await requireAdminUser();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  const headed =
    process.env.PLAYWRIGHT_HEADED === "true" && process.env.VERCEL !== "1";
  const browser = await launchChromium({ headless: !headed });
  try {
    const page = await browser.newPage();
    const scraped = await scrapeCrtCompanies(page);
    let companyCount = 0;
    let linkCount = 0;

    for (const c of scraped) {
      if (c.name.length < 2) {
        continue;
      }
      const company = await prisma.company.upsert({
        where: { name: c.name },
        create: { name: c.name, enabled: true },
        update: {},
      });
      companyCount += 1;

      for (const l of c.links) {
        const hasVerificationProtocol = linkSupportsAutomatedVerification(
          c.name,
          l.url,
        );
        await prisma.companyLink.upsert({
          where: {
            companyId_url: { companyId: company.id, url: l.url },
          },
          create: {
            companyId: company.id,
            url: l.url,
            label: l.label,
            hasVerificationProtocol,
          },
          update: { label: l.label, hasVerificationProtocol },
        });
        linkCount += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      companies: companyCount,
      links: linkCount,
      scrapedCompanies: scraped.length,
    });
  } finally {
    await browser.close();
  }
}
