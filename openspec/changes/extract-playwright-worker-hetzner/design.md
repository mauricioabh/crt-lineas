## Context

Hoy la app es un único proyecto Next.js 16 desplegado en Vercel en cada push a GitHub. El trabajo de navegador (scraping CRT + verificación por CURP) corre dentro de funciones serverless de Vercel con `@sparticuz/chromium`, `maxDuration: 300` y `memory: 2048`. La verificación bulk ya usa Inngest para fan-out (`monitor/bulk.started` → `monitor/link.verify`), pero **las funciones Inngest se sirven desde `/api/inngest` en Vercel**, por lo que Chromium sigue ejecutándose en Vercel. La verificación single (`/api/monitor/[linkId]`) es **síncrona**: lanza el navegador y devuelve el resultado en la misma request.

Piezas que tocan Playwright: `src/lib/playwright-launch.ts`, `src/lib/crt-ingest.ts`, `src/lib/monitor-verify-link.ts`, `src/lib/monitor-bulk-verify-item.ts`, `src/monitoring/**`, `src/inngest/functions/bulk.ts`, y las tres rutas API. Las credenciales de monitor se leen de la DB y se descifran con `field-encryption` (no requieren Clerk en el worker). El VPS Hetzner ya existe y será el host persistente.

Restricción del usuario: mover **solo el worker de Playwright** a Hetzner (Vercel conserva UI/auth/API ligera) usando **Inngest** como transporte único.

## Goals / Non-Goals

**Goals:**

- Sacar toda ejecución de Chromium de Vercel; que corra en un worker persistente en Hetzner.
- Reusar Inngest como único canal de despacho/ejecución (sin webhooks HTTP ad-hoc nuevos).
- Compartir una sola base de código de patrones/verificación entre app y worker (cero divergencia).
- Mantener el deploy actual a Vercel intacto para todo lo que no sea navegador.
- Persistir estado/resultado en la DB y exponerlo a la UI (SSE/polling) igual que hoy en bulk.

**Non-Goals:**

- No mover la API completa, la UI ni la auth a Hetzner.
- No cambiar el modelo de datos de negocio (`Company`, `CompanyLink`) salvo lo mínimo para jobs.
- No self-hostear el servidor de Inngest en esta fase (se usa Inngest Cloud gestionado).
- No reescribir los patrones de monitoreo ni la lógica de verificación.

## Decisions

### D1 — El worker sirve las funciones Inngest vía Inngest Connect (outbound)

El worker Hetzner establece una conexión **saliente** a Inngest con `connect()` (`inngest/connect`) y registra las funciones de navegador (`monitorBulkStart`, `monitorLinkVerify`, y una nueva `ingestScrape`). Vercel deja de servir esas funciones: `/api/inngest` en Vercel queda sin funciones de navegador (o se elimina si no queda ninguna).

- **Por qué**: un VPS detrás de firewall/NAT no necesita exponer un endpoint público ni gestionar URL de registro/firma entrante; la conexión saliente persistente encaja con un worker de larga duración.
- **Alternativa considerada**: worker con endpoint `serve()` HTTP público que Inngest invoca. Rechazada por requerir ingress público, TLS y registro de URL; más superficie y operación.

### D2 — La verificación single se vuelve asíncrona reusando la infra de jobs

`POST /api/monitor/[linkId]` deja de ejecutar inline. Se modela como un job de un solo item (reusando `MonitorBulkJob`/items o un evento `monitor/link.verify` directo) y la ruta devuelve un job id; el cliente observa el resultado por el mismo mecanismo SSE/polling de bulk.

- **Por qué**: unifica un solo camino de ejecución en el worker y evita mantener dos rutas (síncrona y asíncrona) hacia Playwright.
- **Alternativa considerada**: mantener single síncrono con llamada HTTP directa Vercel→worker esperando la respuesta. Rechazada: viola “Inngest como transporte único”, reintroduce timeouts largos en funciones Vercel y un canal HTTP paralelo.
- **Trade-off**: la UI de verificación single pasa de “respuesta inmediata” a “estado en progreso → resultado”. Requiere ajuste de UX (spinner/estado), aceptable.

### D3 — Monorepo-lite en el mismo repo: `worker/` que importa `src/` compartido

Se añade un directorio `worker/` (mismo repositorio) con su propio `package.json`/entrypoint que **importa la lógica compartida** desde `src/lib/*`, `src/monitoring/**`, `src/inngest/*`. Se configura path/build (tsx o tsc + `tsconfig` que resuelve `@/`) para el worker. Vercel sigue construyendo solo la app Next.js.

- **Por qué**: una sola fuente de verdad para patrones y verificación; agregar un patrón queda disponible en ambos sin duplicar.
- **Alternativa considerada**: repo separado para el worker (copiar/vendorizar código). Rechazada por riesgo de divergencia y doble mantenimiento. Alternativa `packages/*` con workspaces formales: viable a futuro, pero mayor reestructura ahora.

### D4 — `launchChromium` usa Chromium nativo fuera de Vercel

`launchChromium` ya cae en `chromium.launch()` nativo cuando `process.env.VERCEL !== "1"`. El worker no define `VERCEL`, así que usa el Chromium de `playwright install`. Se retira `@sparticuz/chromium` de la ruta de ejecución de Vercel (ya no corre navegador ahí) y de las dependencias del build de Vercel.

- **Por qué**: el binario `@sparticuz` solo existe por la restricción serverless; en un VPS persistente el Chromium nativo es más estable y completo.
- **Alternativa considerada**: dejar `@sparticuz` en el worker. Rechazada: innecesario e inferior en entorno persistente.

### D5 — Inngest Cloud gestionado

Se usa Inngest Cloud (claves `INNGEST_EVENT_KEY` para envío desde Vercel y `INNGEST_SIGNING_KEY` para el Connect del worker), compartidas entre ambos entornos.

- **Por qué**: evita operar un servidor Inngest adicional en Hetzner; el volumen de jobs es bajo.
- **Alternativa considerada**: self-host de Inngest en Hetzner. Rechazada por operación extra; se puede migrar luego sin cambiar el código de funciones.

### D6 — CI/CD: build de imagen Docker del worker + deploy a Hetzner

En push a GitHub, además del deploy a Vercel: GitHub Actions construye la imagen Docker del worker (Chromium + deps del sistema), la publica en GHCR, y Hetzner la actualiza (SSH `docker compose pull && up -d` o Watchtower). Restart policy `unless-stopped` para reinicio automático.

- **Por qué**: despliegue reproducible y auto-recuperable, alineado con el flujo push→deploy existente.
- **Alternativa considerada**: `git pull` + `pm2` en el host sin contenedor. Rechazada por dependencias del sistema de Chromium frágiles fuera de imagen controlada.

### D7 — Secretos del worker

El worker necesita: `DATABASE_URL` (Neon), claves de Inngest, `MONITOR_*` (timeouts/waits), `UPLOADTHING_TOKEN` (subida de capturas) y la clave de `field-encryption` para descifrar credenciales. **No** necesita claves de Clerk (las credenciales se leen de la DB). Los secretos se inyectan por entorno del contenedor en Hetzner, nunca en el repo.

## Risks / Trade-offs

- **[Worker caído deja jobs sin procesar]** → Inngest retiene/reintenta; healthcheck + restart policy + alerta (Sentry/log) cuando el Connect se cae. Estado del job permanece “pendiente”, la UI lo refleja.
- **[Single monitor pasa a asíncrono cambia la UX]** → Ajustar el componente de verificación single para estado en progreso; documentar el cambio de contrato en README (rutas ahora asíncronas).
- **[Divergencia de dependencias app↔worker]** → Compartir `src/` y fijar versión de `playwright` única; el worker reusa el `prisma` client generado. CI corre typecheck sobre worker.
- **[Chromium en Docker le faltan libs del sistema]** → Partir de imagen base oficial de Playwright (`mcr.microsoft.com/playwright`) que ya trae Chromium y dependencias.
- **[Fuga de credenciales/CURP en logs del worker]** → Reusar el enmascarado existente; no loguear CURP/teléfono en claro; secretos solo por env.
- **[Claves de Inngest desincronizadas entre Vercel y worker]** → Documentar en `docs/ENV.md`; un solo origen de claves por entorno; smoke test post-deploy que despacha un job de prueba.
- **[Coexistencia durante migración]** → Mientras el worker no esté en línea, mantener temporalmente el `serve` en Vercel detrás de un flag para no romper producción; retirar al confirmar el worker.

## Migration Plan

1. Extraer/compartir la lógica de navegador en `worker/` sin cambiar comportamiento; verificar typecheck.
2. Añadir la función `ingestScrape` en Inngest y hacer que `/api/ingest` despache el evento en vez de lanzar Chromium.
3. Convertir `/api/monitor/[linkId]` a despacho asíncrono (job de 1 item) y ajustar la UI.
4. Levantar el worker en local con Connect apuntando a Inngest (dev) y validar los tres flujos end-to-end.
5. Construir imagen Docker y desplegar en Hetzner; registrar Connect contra Inngest Cloud.
6. Cambiar `/api/inngest` de Vercel para no servir funciones de navegador (flag de coexistencia).
7. Retirar `@sparticuz/chromium` y la config de Chromium en `vercel.json`/`next.config.ts`.
8. **Rollback**: reactivar el flag que sirve las funciones en Vercel y restaurar la config de `@sparticuz`; el código compartido no cambia, así que el rollback es de configuración/deploy.

## Open Questions

- ¿Se usará Inngest Cloud o se prevé self-host a corto plazo? (afecta D5 y las claves).
- ¿El worker corre múltiples jobs en paralelo (concurrencia Inngest) o de a uno? Definir límite de concurrencia según recursos del VPS.
- ¿Registro de imagen: GHCR u otro? ¿Deploy por SSH o Watchtower?
- ¿Se mantiene el modo headed local para debug o el worker es siempre headless?
