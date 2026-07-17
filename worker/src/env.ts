/**
 * Variables de entorno obligatorias para el worker. Si falta alguna, el proceso
 * debe fallar en el arranque (no arrancar en estado degradado).
 *
 * - `DATABASE_URL`: Neon (Prisma).
 * - `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`: claves de Inngest Cloud (Connect).
 * - `VERIFICATION_CREDENTIALS_ENCRYPTION_KEY`: descifrado de CURP/teléfono.
 * - `UPLOADTHING_TOKEN`: subida de capturas de revisión.
 */
const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "VERIFICATION_CREDENTIALS_ENCRYPTION_KEY",
  "UPLOADTHING_TOKEN",
] as const;

export function assertWorkerEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter(
    (name) => !process.env[name]?.trim(),
  );
  if (missing.length > 0) {
    throw new Error(
      `[worker] Falta(n) variable(s) de entorno obligatoria(s): ${missing.join(
        ", ",
      )}. Configúrala(s) antes de arrancar el worker.`,
    );
  }
}

/** Puerto del healthcheck HTTP (responde "ok"). */
export const WORKER_HEALTH_PORT = Number(
  process.env.WORKER_HEALTH_PORT ?? 3100,
);

/**
 * Límite de concurrencia de jobs del worker (Inngest `maxWorkerConcurrency`).
 * Ajustar según recursos del VPS Hetzner. Por defecto 1 (secuencial).
 */
export const WORKER_CONCURRENCY = Math.max(
  1,
  Number(process.env.WORKER_CONCURRENCY ?? 1),
);
