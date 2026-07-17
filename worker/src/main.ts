import { createServer } from "node:http";
import { connect } from "inngest/connect";
import { inngest } from "@/inngest/client";
import { browserFunctions } from "@/inngest/functions";
import { assertWorkerEnv, WORKER_CONCURRENCY, WORKER_HEALTH_PORT } from "./env";

/**
 * Entrypoint del worker Hetzner:
 *  1. Valida env obligatoria (falla explícito si falta).
 *  2. Expone un healthcheck HTTP que responde `ok`.
 *  3. Abre una conexión saliente a Inngest (Connect) y sirve las funciones de
 *     navegador (`monitorBulkStart`, `monitorLinkVerify`, `ingestScrape`).
 */
async function main(): Promise<void> {
  assertWorkerEnv();

  const health = createServer((req, res) => {
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  await new Promise<void>((resolve) => {
    health.listen(WORKER_HEALTH_PORT, () => {
      console.log(`[worker] healthcheck escuchando en :${WORKER_HEALTH_PORT}`);
      resolve();
    });
  });

  const connection = await connect({
    apps: [{ client: inngest, functions: browserFunctions }],
    instanceId: process.env.WORKER_INSTANCE_ID ?? "crt-lineas-worker",
    maxWorkerConcurrency: WORKER_CONCURRENCY,
  });

  console.log(
    `[worker] conectado a Inngest (estado: ${connection.state}, concurrencia: ${WORKER_CONCURRENCY})`,
  );

  const shutdown = () => {
    health.close();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await connection.closed;
  health.close();
  console.log("[worker] conexión cerrada, saliendo");
}

main().catch((err) => {
  console.error("[worker] fallo fatal en el arranque", err);
  process.exit(1);
});
