/**
 * Scrape CRT + upsert companies/links to DB.
 * Uso: node --env-file=.env.local scripts/run-ingest.js
 */
const { chromium } = require("playwright");
const { PrismaClient } = require("@prisma/client");

const CRT_URL =
  process.env.NEXT_PUBLIC_CRT_MOBILE_LINES_URL ??
  "https://portal.crt.gob.mx/gestion-de-lineas-telefonicas-moviles";

const prisma = new PrismaClient();

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** True when the URL points to the Altán RNU automated-verification portal. */
function isAltanRnuUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname.toLowerCase() === "rnu.altanredes.com" &&
      /\/vinculatulinea\/?$/i.test(u.pathname)
    );
  } catch {
    return false;
  }
}

function linkSupportsAutomatedVerification(_companyName, url) {
  return isAltanRnuUrl(url);
}

async function scrape(page) {
  await page.goto(CRT_URL, { waitUntil: "networkidle", timeout: 120_000 });
  await delay(4000);

  const rows = await page.evaluate(() => {
    const out = [];
    const seen = new Set();

    function norm(s) {
      return s.replace(/\s+/g, " ").trim();
    }

    function isEmpresaLink(a) {
      const text = norm(a.textContent ?? "").toLowerCase();
      if (/\bempresa\b/.test(text) && !/\bpersona\b/.test(text)) return true;
      try {
        const path = new URL(a.href).pathname.toLowerCase();
        if (path.includes("/empresas/")) return true;
      } catch {}
      return false;
    }

    function labelFromText(text) {
      if (text.includes("/")) {
        const parts = text.split("/").map((p) => p.trim());
        return parts[parts.length - 1] || "Persona";
      }
      return text || "Persona";
    }

    document.querySelectorAll("li.accordion-item").forEach((li) => {
      const company = norm(
        (li.dataset.name ?? "") ||
          (li.querySelector(".acc-name")?.textContent ?? ""),
      );
      if (company.length < 2) return;

      li.querySelectorAll("a[href]").forEach((a) => {
        const href = a.href;
        if (!href || !href.startsWith("http")) return;
        if (isEmpresaLink(a)) return;
        const key = `${company}|${href}`;
        if (seen.has(key)) return;
        seen.add(key);
        const rawText = norm(a.textContent ?? "");
        const label = labelFromText(rawText) || "Persona";
        out.push({ company, href, label });
      });
    });

    document.querySelectorAll("ul.operators-list > li").forEach((li) => {
      if (li.classList.contains("accordion-item")) return;
      const a = li.querySelector("a.operator-btn[href]");
      if (!a) return;
      const href = a.href;
      if (!href || !href.startsWith("http")) return;
      if (isEmpresaLink(a)) return;
      const rawText = norm(a.textContent ?? "");
      const company = rawText;
      if (company.length < 2) return;
      const key = `${company}|${href}`;
      if (seen.has(key)) return;
      seen.add(key);
      const label = rawText.includes("/")
        ? labelFromText(rawText) || "Persona"
        : "Persona";
      out.push({ company, href, label });
    });

    document
      .querySelectorAll(".top5-item.top5-item--clickable a[href]")
      .forEach((a) => {
        if (a.closest("footer")) return;
        const href = a.href;
        if (!href || !href.startsWith("http")) return;
        if (isEmpresaLink(a)) return;
        const rawText = norm(a.textContent ?? "");
        const company = rawText.replace(/^\d+/, "").trim();
        if (company.length < 2) return;
        const key = `${company}|${href}`;
        if (seen.has(key)) return;
        seen.add(key);
        out.push({ company, href, label: "Persona" });
      });

    return out;
  });

  const map = new Map();
  const personaIndex = new Map();

  for (const r of rows) {
    if (!map.has(r.company)) {
      map.set(r.company, { name: r.company, links: [] });
      personaIndex.set(r.company, 0);
    }
    let label = r.label;
    if (/^persona$/i.test(label)) {
      const idx = (personaIndex.get(r.company) ?? 0) + 1;
      personaIndex.set(r.company, idx);
      if (idx > 1) label = `Persona (${idx})`;
    }
    map.get(r.company).links.push({ url: r.href, label });
  }

  const companies = [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
  );

  console.log(
    `[scrape] ${companies.length} compañías, ${rows.length} links totales`,
  );
  return companies;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  let scraped;
  try {
    const page = await browser.newPage();
    scraped = await scrape(page);
  } finally {
    await browser.close();
  }

  let companyCount = 0;
  let linkCount = 0;

  for (const c of scraped) {
    if (c.name.length < 2) continue;
    const company = await prisma.company.upsert({
      where: { name: c.name },
      create: { name: c.name, enabled: true },
      update: {},
    });
    companyCount++;

    for (const l of c.links) {
      const hasVerificationProtocol = linkSupportsAutomatedVerification(
        c.name,
        l.url,
      );
      await prisma.companyLink.upsert({
        where: { companyId_url: { companyId: company.id, url: l.url } },
        create: {
          companyId: company.id,
          url: l.url,
          label: l.label,
          hasVerificationProtocol,
        },
        update: { label: l.label, hasVerificationProtocol },
      });
      linkCount++;
    }
  }

  console.log(
    `[ingest] Listo: ${companyCount} compañías, ${linkCount} links guardados.`,
  );
  console.log("\nCompañías importadas:");
  scraped.forEach((c, i) =>
    console.log(`  ${String(i + 1).padStart(3)}. ${c.name} (${c.links.length} link(s))`),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
