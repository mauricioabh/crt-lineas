/**
 * Borra todas las filas de Company (y CompanyLink vía onDelete: Cascade),
 * las capturas PNG en disco y los objetos correspondientes en UploadThing (si hay token).
 * Uso: npm run db:clear-companies
 * Requiere DATABASE_URL (p. ej. node --env-file=.env.local … o variable en la sesión).
 */
const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs/promises");
const path = require("node:path");

const prisma = new PrismaClient();

async function deleteReviewScreenshotsUploadThing() {
  const token = process.env.UPLOADTHING_TOKEN?.trim();
  if (!token) {
    return;
  }
  const rows = await prisma.companyLink.findMany({
    select: { reviewScreenshotUtKey: true },
  });
  const keys = rows.map((r) => r.reviewScreenshotUtKey).filter(Boolean);
  if (keys.length === 0) {
    return;
  }
  try {
    const { UTApi } = await import("uploadthing/server");
    const utapi = new UTApi({ token });
    await utapi.deleteFiles(keys);
  } catch (e) {
    console.warn("[clear-companies] UploadThing deleteFiles omitido o falló:", e?.message ?? e);
  }
}

async function main() {
  await deleteReviewScreenshotsUploadThing();

  const shotDir = path.join(process.cwd(), "data", "review-screenshots");
  await fs.rm(shotDir, { recursive: true, force: true });

  const result = await prisma.company.deleteMany({});
  console.log(
    `Listo: se eliminaron ${result.count} compañías (y sus enlaces en cascada). Capturas locales borradas si existían.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
