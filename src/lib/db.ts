import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function getPrismaDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  // Neon pooled endpoints use PgBouncer. Prisma recommends enabling `pgbouncer=true`
  // so it uses the correct connection behavior. This avoids intermittent "kind: Closed"
  // errors during local dev when the pooler closes idle connections.
  try {
    const url = new URL(raw);
    if (
      url.hostname.includes("-pooler.") &&
      !url.searchParams.has("pgbouncer")
    ) {
      url.searchParams.set("pgbouncer", "true");
      return url.toString();
    }
  } catch {
    // If DATABASE_URL is not a valid URL, fall back to raw value.
  }

  return raw;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: getPrismaDatabaseUrl() } },
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
