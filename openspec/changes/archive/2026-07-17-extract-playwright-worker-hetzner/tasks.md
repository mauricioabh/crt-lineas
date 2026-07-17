## 1. Preparar código compartido para el worker

- [x] 1.1 Auditar imports de `src/lib/playwright-launch.ts`, `src/lib/crt-ingest.ts`, `src/lib/monitor-verify-link.ts`, `src/lib/monitor-bulk-verify-item.ts`, `src/monitoring/**` y confirmar que no dependen de APIs exclusivas de Next/Vercel
- [x] 1.2 Verificar que `launchChromium` usa Chromium nativo cuando `process.env.VERCEL !== "1"` (comportamiento actual) y documentar el branch
- [x] 1.3 Confirmar que `requireMonitorCredentials` solo necesita `DATABASE_URL` + clave de `field-encryption` (sin Clerk) desde un proceso worker

## 2. Scaffolding del worker (`worker/`)

- [x] 2.1 Crear directorio `worker/` con `package.json` (entrypoint, scripts `dev`/`start`/`build`) en el mismo repo
- [x] 2.2 Configurar `tsconfig` del worker que resuelva el alias `@/` hacia `src/` para reusar la lógica compartida
- [x] 2.3 Añadir dependencia `inngest` + `playwright` y asegurar reuso del Prisma Client generado
- [x] 2.4 Crear entrypoint que arranque el worker y exponga un healthcheck que responda `ok`
- [x] 2.5 Fallar en arranque si falta una env obligatoria, con mensaje que nombre la variable

## 3. Registro de funciones Inngest en el worker (Inngest Connect)

- [x] 3.1 Registrar `monitorBulkStart` y `monitorLinkVerify` en el worker vía `connect()` de `inngest/connect`
- [x] 3.2 Crear función Inngest `ingestScrape` que ejecute `scrapeCrtCompanies` + upsert de `Company`/`CompanyLink` (mover la lógica actual de `/api/ingest`)
- [x] 3.3 Añadir el evento `ingest/scrape.requested` al `EventSchemas` del cliente Inngest
- [x] 3.4 Validar firma/registro: el serve/connect del worker rechaza peticiones no firmadas por Inngest (Inngest Connect autentica con `INNGEST_SIGNING_KEY`, obligatoria en el arranque del worker)

## 4. Convertir rutas de Vercel en despachadores

- [x] 4.1 `POST /api/ingest`: `requireAdminUser()`, despachar `ingest/scrape.requested` y devolver un identificador de job (sin lanzar Chromium)
- [x] 4.2 `POST /api/monitor/[linkId]`: convertir a asíncrono (job de 1 item reusando `MonitorBulkJob` o evento directo) y devolver job id; exponer resultado por SSE/polling
- [x] 4.3 `POST /api/monitor/bulk`: eliminar la rama `streamInlineBulk` con Chromium; siempre encolar en Inngest y transmitir progreso desde la DB
- [x] 4.4 Ajustar la UI de verificación single para estado en progreso → resultado (sin respuesta síncrona inmediata)
- [x] 4.5 Verificar reconexión SSE: el cliente recupera el estado del job desde la DB sin perder items completados (`GET /api/monitor/bulk?jobId=` reanuda el stream; `streamMonitorBulkJobSse` reconstruye el estado desde la DB)

## 5. Desactivar ejecución de navegador en Vercel

- [x] 5.1 Añadir flag de coexistencia para que `/api/inngest` de Vercel deje de servir las funciones de navegador (retención temporal para rollback) — `INNGEST_SERVE_BROWSER_ON_VERCEL` (default: no sirve; el worker es el ejecutor único)
- [x] 5.2 Retirar `@sparticuz/chromium` de las dependencias del build de Vercel — desinstalado; `launchChromium` usa solo Chromium nativo
- [x] 5.3 Quitar el bloque `functions` con `includeFiles` de `vercel.json`
- [x] 5.4 Quitar `serverExternalPackages`/`outputFileTracingIncludes` de Playwright en `next.config.ts` — se quitó `@sparticuz` y `outputFileTracingIncludes`; `playwright`/`playwright-core` siguen como external (los importa `/api/inngest`)

## 6. Contenedor y despliegue en Hetzner

- [x] 6.1 Crear `Dockerfile` del worker basado en imagen oficial de Playwright (Chromium + deps del sistema incluidas)
- [x] 6.2 Crear `docker-compose` (o unidad systemd) con restart policy `unless-stopped` e inyección de secretos por entorno
- [x] 6.3 Definir las envs del worker en Hetzner: `DATABASE_URL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `MONITOR_*`, `UPLOADTHING_TOKEN`, clave de `field-encryption` — configuradas en `.env.worker` del VPS; worker levantado y conectado a Inngest
- [x] 6.4 Configurar límite de concurrencia de Inngest según recursos del VPS — `WORKER_CONCURRENCY` → `maxWorkerConcurrency` en `connect()`

## 7. CI/CD

- [x] 7.1 Workflow de GitHub Actions: build de la imagen Docker del worker y push a GHCR en push a la rama de deploy
- [x] 7.2 Paso de despliegue a Hetzner (SSH `docker compose pull && up -d` o Watchtower)
- [x] 7.3 Añadir typecheck del worker al CI
- [x] 7.4 Confirmar que el deploy a Vercel sigue funcionando sin la config de Chromium — deploy de producción `READY` tras el merge a `main` (cutover); build pasa sin `@sparticuz`

## 8. Validación end-to-end

- [x] 8.1 Worker con Connect a Inngest ejecuta ingest correctamente — validado en el VPS Hetzner: evento despachado, `ingest-scrape` corrió y scrapeó el portal (tras fix del shim `__name`). Monitor single/bulk aún sin probar E2E (requiere perfil de verificación de un usuario real)
- [x] 8.2 Smoke test: evento `ingest/scrape.requested` despachado a Inngest Cloud (`inn.gs`), ejecutado en el worker Hetzner y confirmado en Neon (+8 `Company`/`CompanyLink`, `updatedAt` de hoy)
- [x] 8.3 Verificar que no se loguean CURP/teléfono en claro en el worker — verificado por inspección: los logs compartidos solo emiten `linkId`/compañía/patternId/conteos y errores sanitizados (`sanitizeEnvFromUserFacingText`); las funciones Inngest no referencian `curp`/`phone`
- [x] 8.4 Rollback documentado (no ejecutado): `INNGEST_SERVE_BROWSER_ON_VERCEL=1` requiere restaurar `@sparticuz/chromium` y su config. Tras el cutover el rollback deja de ser trivial (por diseño); el worker es el ejecutor único. No se probó E2E porque producción quedó operativa en el worker

## 9. Documentación (obligatoria en el mismo PR)

- [x] 9.1 `docs/ENV.md` + `.env.example`: envs compartidas Vercel↔worker y envs del worker
- [x] 9.2 `docs/TECH_STACK.md`: deploy target dual (Vercel + worker Hetzner) y Inngest como transporte
- [x] 9.3 `docs/PHASES.md`: marcar Fase 2 — Opción B como estrategia elegida
- [x] 9.4 `README.md`: documentar que `/api/ingest` y `/api/monitor/*` ahora son asíncronas
- [x] 9.5 `docs/MONITORING_PATTERNS.md`: nota de que los patrones corren en el worker
