import { inngest } from "@/inngest/client";
import { scrapeCrtCompanies } from "@/lib/crt-ingest";
import { prisma } from "@/lib/db";
import { launchChromium, newPageWithEvalShim } from "@/lib/playwright-launch";
import { linkSupportsAutomatedVerification } from "@/monitoring";

/**
 * Scrapea el portal CRT y hace upsert de `Company`/`CompanyLink`.
 *
 * Corre en el worker Hetzner (Inngest Connect), no en Vercel. La ruta
 * `POST /api/ingest` solo despacha el evento `ingest/scrape.requested`.
 */
export const ingestScrape = inngest.createFunction(
  { id: "ingest-scrape", name: "Ingest — scrape CRT", retries: 1 },
  { event: "ingest/scrape.requested" },
  async ({ step }) => {
    const scraped = await step.run("scrape-crt", async () => {
      const browser = await launchChromium({ headless: true });
      try {
        const page = await newPageWithEvalShim(browser);
        return await scrapeCrtCompanies(page);
      } finally {
        await browser.close();
      }
    });

    const result = await step.run("upsert-companies", async () => {
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

      return {
        companies: companyCount,
        links: linkCount,
        scrapedCompanies: scraped.length,
      };
    });

    return { ok: true, ...result };
  },
);
