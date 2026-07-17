## Why

Playwright/Chromium se ejecuta hoy dentro de funciones serverless de Vercel (`/api/ingest`, `/api/monitor/[linkId]`, `/api/monitor/bulk` e Inngest), forzando el uso de `@sparticuz/chromium`, `maxDuration: 300` y 2 GB de memoria. Esto es frágil y caro en serverless: arranques en frío del binario, límites de tiempo/memoria, tamaño del bundle y comportamiento headless limitado. Separar el scraping/verificación a un worker persistente en el VPS Hetzner elimina esas restricciones, reduce costo y deja Vercel para lo que hace bien (UI, auth, edge, API ligera).

## What Changes

- Se crea un **servicio worker de navegador** independiente (desplegable en el VPS Hetzner) que ejecuta Playwright/Chromium para: (a) scraping del portal CRT y (b) verificación de líneas por CURP (single y bulk).
- El worker se registra en **Inngest** como app que sirve las funciones de navegador; Vercel solo **encola eventos** y lee resultados desde la DB. Inngest es el transporte único.
- Las rutas `/api/ingest`, `/api/monitor/[linkId]` y `/api/monitor/bulk` dejan de lanzar Chromium: pasan a **despachar trabajo** vía Inngest y a exponer estado/resultado (streaming SSE/polling desde `MonitorBulkJob`).
- Se **elimina de Vercel** la dependencia serverless de Chromium: `@sparticuz/chromium`, la config de `vercel.json` (functions con `includeFiles`) y `outputFileTracingIncludes`/`serverExternalPackages` de `next.config.ts` relativos a Playwright.
- La lógica compartida de Playwright (`playwright-launch`, `crt-ingest`, `monitor-verify-link`, `monitor-bulk-verify-item`, `src/monitoring/**`) se **reubica/comparte** con el worker; en el worker `launchChromium` usa el Chromium nativo de `playwright install` (no `@sparticuz`).
- **BREAKING (operacional)**: producción requiere ahora un worker Hetzner en línea y registrado en Inngest; sin él, ingest y monitor quedan encolados sin ejecutarse. Nueva infra y variables de entorno compartidas (claves Inngest, `DATABASE_URL`, credenciales de monitor, `UPLOADTHING_TOKEN`).

## Capabilities

### New Capabilities

- `browser-worker-service`: servicio Node persistente en Hetzner que ejecuta Playwright/Chromium para scraping CRT y verificación de líneas, empaquetado (Docker) y desplegable de forma independiente de Vercel.
- `remote-job-orchestration`: contrato de orquestación por el cual la app de Vercel despacha todo el trabajo de navegador (ingest, monitor single, monitor bulk) mediante eventos Inngest consumidos por el worker Hetzner, con estado/resultado persistido en la DB y expuesto a la UI.

### Modified Capabilities

<!-- No hay specs existentes en openspec/specs/; no se modifican capabilities previas. -->

## Impact

- **Código Vercel**: `src/app/api/ingest/route.ts`, `src/app/api/monitor/[linkId]/route.ts`, `src/app/api/monitor/bulk/route.ts` se convierten en despachadores; `src/inngest/functions/*` y `src/lib/monitor-*`, `src/lib/crt-ingest.ts`, `src/lib/playwright-launch.ts`, `src/monitoring/**` se comparten o migran al worker.
- **Config**: `vercel.json` (quitar bloque `functions` de Chromium), `next.config.ts` (quitar `serverExternalPackages`/`outputFileTracingIncludes` de Playwright), `package.json` (mover `playwright`/quitar `@sparticuz/chromium` del deploy Vercel).
- **Nueva infra**: proyecto/paquete del worker (p. ej. `apps/worker` o repo aparte), imagen Docker con Chromium, despliegue en Hetzner (systemd/PM2/Docker Compose), registro Inngest connect.
- **CI/CD**: pipeline para build+deploy del worker a Hetzner además del deploy actual a Vercel en push a GitHub.
- **Variables de entorno**: `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` compartidas Vercel↔worker; el worker necesita `DATABASE_URL`, `MONITOR_*`, `UPLOADTHING_TOKEN`. Documentar en `docs/ENV.md` y `.env.example`.
- **Dependencias**: `@sparticuz/chromium` deja de ser necesaria en Vercel; el worker usa `playwright` + navegadores instalados.
- **Docs**: `docs/TECH_STACK.md` (deploy target dual), `docs/PHASES.md` (Fase 2 — Opción B), `docs/DATA_MODEL.md` si cambia algo de jobs, `README.md` (rutas ahora asíncronas).
