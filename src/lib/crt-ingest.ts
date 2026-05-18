import type { Page } from "playwright";

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export type ScrapedLink = { url: string; label: string };
export type ScrapedCompany = { name: string; links: ScrapedLink[] };

export const CRT_MOBILE_LINES_URL =
  process.env.NEXT_PUBLIC_CRT_MOBILE_LINES_URL ??
  "https://portal.crt.gob.mx/gestion-de-lineas-telefonicas-moviles";

/**
 * Scrape CRT "gestión de líneas telefónicas móviles" page.
 *
 * Page structure (as of 2026-05):
 *   - `ul.operators-list` mixes two row types:
 *     - `li.accordion-item`: MVNO-style rows; name in `data-name` / `.acc-name`; links in `.accordion-body`
 *     - plain `li` (no accordion class): one `a.operator-btn` per row; name = anchor text (Telcel, AT&T, ADS/…, etc.)
 *   - Top carriers also appear in a carousel: `.top5-item.top5-item--clickable a` with text like "1Telcel" (strip leading digits)
 *   - Persona link URL often contains vinculatulinea; Empresa links contain `/empresas/` or anchor text "Empresa"
 *   - Do not scrape generic `document.querySelectorAll("a[href]")` — that pulls footer/nav (e.g. datos.gob.mx).
 */
export async function scrapeCrtCompanies(
  page: Page,
): Promise<ScrapedCompany[]> {
  await page.goto(CRT_MOBILE_LINES_URL, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  await delay(4000);

  const rows = await page.evaluate(() => {
    type Row = { company: string; href: string; label: string };
    const out: Row[] = [];
    const seen = new Set<string>();

    function norm(s: string) {
      return s.replace(/\s+/g, " ").trim();
    }

    function isEmpresaLink(anchor: HTMLAnchorElement): boolean {
      const text = norm(anchor.textContent ?? "").toLowerCase();
      if (/\bempresa\b/.test(text) && !/\bpersona\b/.test(text)) {
        return true;
      }
      try {
        const path = new URL(anchor.href).pathname.toLowerCase();
        if (path.includes("/empresas/")) {
          return true;
        }
      } catch {
        // ignore
      }
      return false;
    }

    function labelFromAnchorText(text: string): string {
      // Embedded pattern: "Turbored/Persona", "Ultracel/Internet para el Bienestar/Persona"
      if (text.includes("/")) {
        const parts = text.split("/").map((p) => p.trim());
        // Last part is the role label (Persona / Empresa / Internet para el Bienestar)
        return parts[parts.length - 1] || "Persona";
      }
      return text || "Persona";
    }

    // --- Accordion rows (MVNOs, multi-link) ---
    document
      .querySelectorAll<HTMLLIElement>("li.accordion-item")
      .forEach((li) => {
        const company = norm(
          (li.dataset.name ?? "") ||
            (li.querySelector(".acc-name")?.textContent ?? ""),
        );
        if (company.length < 2) {
          return;
        }

        li.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
          const href = a.href;
          if (!href || !href.startsWith("http")) {
            return;
          }
          if (isEmpresaLink(a)) {
            return;
          }
          const key = `${company}|${href}`;
          if (seen.has(key)) {
            return;
          }
          seen.add(key);
          const rawText = norm(a.textContent ?? "");
          const label = labelFromAnchorText(rawText) || "Persona";
          out.push({ company, href, label });
        });
      });

    // --- Plain single-link rows in the same operators list (major brands + more) ---
    document
      .querySelectorAll<HTMLLIElement>("ul.operators-list > li")
      .forEach((li) => {
        if (li.classList.contains("accordion-item")) {
          return;
        }
        const a = li.querySelector<HTMLAnchorElement>("a.operator-btn[href]");
        if (!a) {
          return;
        }
        const href = a.href;
        if (!href || !href.startsWith("http")) {
          return;
        }
        if (isEmpresaLink(a)) {
          return;
        }
        const rawText = norm(a.textContent ?? "");
        const company = rawText;
        if (company.length < 2) {
          return;
        }
        const key = `${company}|${href}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        const label = rawText.includes("/")
          ? labelFromAnchorText(rawText) || "Persona"
          : "Persona";
        out.push({ company, href, label });
      });

    // --- Top-5 carousel (same URLs as some plain rows; deduped by `seen`) ---
    document
      .querySelectorAll<HTMLAnchorElement>(
        ".top5-item.top5-item--clickable a[href]",
      )
      .forEach((a) => {
        if (a.closest("footer")) {
          return;
        }
        const href = a.href;
        if (!href || !href.startsWith("http")) {
          return;
        }
        if (isEmpresaLink(a)) {
          return;
        }
        const rawText = norm(a.textContent ?? "");
        const company = rawText.replace(/^\d+/, "").trim();
        if (company.length < 2) {
          return;
        }
        const key = `${company}|${href}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        out.push({ company, href, label: "Persona" });
      });

    return out;
  });

  const map = new Map<string, ScrapedCompany>();
  const personaIndex = new Map<string, number>();

  for (const r of rows) {
    const company = r.company;
    if (!map.has(company)) {
      map.set(company, { name: company, links: [] });
      personaIndex.set(company, 0);
    }
    let label = r.label;
    if (/^persona$/i.test(label)) {
      const idx = (personaIndex.get(company) ?? 0) + 1;
      personaIndex.set(company, idx);
      if (idx > 1) {
        label = `Persona (${idx})`;
      }
    }
    map.get(company)!.links.push({ url: r.href, label });
  }

  console.log(
    `[crt-ingest] scraped ${map.size} companies, ${rows.length} links`,
  );

  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
  );
}
