# CRT Líneas — Monitoreo

Aplicación Next.js para listar compañías del portal del CRT (México), guardar enlaces **solo tipo Persona**, y dar seguimiento semimanual con **Playwright** y autenticación **Clerk** (Google + correo/contraseña).

## Requisitos

- Node.js 20+
- Cuenta [Neon](https://neon.tech) (Postgres) y cadena `DATABASE_URL`
- Proyecto [Clerk](https://clerk.com) con inicio de sesión Google y email/contraseña

## Configuración

1. Copia `.env.example` a `.env.local` y completa las variables.
2. Aplica el esquema a Neon:

   ```bash
   npm run db:push
   ```

   (Carga `DATABASE_URL` desde `.env.local` en dos pasos: sincroniza la base y luego regenera el cliente. **No** uses `npx prisma db push` sin variables: dará **P1012**. En Windows, si falla **EPERM** al regenerar, cierra `npm run dev` y ejecuta `npm run db:generate`.)

3. Instala el navegador de Playwright (Chromium):

   ```bash
   npx playwright install chromium
   ```

4. Arranca en desarrollo:

   ```bash
   npm run dev
   ```

5. Abre [http://localhost:3000](http://localhost:3000), inicia sesión y entra a `/dashboard`.

### Rol administrador

En el panel de Clerk, asigna a un usuario en **Public metadata**:

```json
{ "role": "admin" }
```

Sin esto, el rol por defecto es `user` (solo ve compañías con `enabled: true` y no puede sincronizar ni activar/desactivar compañías).

### Variables útiles

| Variable                                  | Descripción                                                          |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `VERIFICATION_CREDENTIALS_ENCRYPTION_KEY` | Clave base64 (32 bytes) para cifrar CURP/celular en Neon             |
| `MONITOR_CURP` / `MONITOR_PHONE`          | _(Legacy)_ Sustituidos por el perfil en `/dashboard/setup`           |
| `PLAYWRIGHT_HEADED=true`                  | Abre Chromium visible (recomendado para captchas / flujo semimanual) |
| `MONITOR_MANUAL_WAIT_MS`                  | Tiempo de espera (ms) en el patrón genérico tras cargar la página    |

## API

| Método   | Ruta                                     | Quién                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/api-docs`                              | Público — **Scalar** UI (OpenAPI 3.0 generado desde Zod)                                                                                                                                                                                                                                                                                                                                                                 |
| `GET`    | `/api/openapi`                           | Público — JSON del contrato OpenAPI                                                                                                                                                                                                                                                                                                                                                                                      |
| `GET`    | `/api/me/verification-profile`           | Autenticado — `{ complete, curpMasked?, phoneMasked? }`                                                                                                                                                                                                                                                                                                                                                                  |
| `PUT`    | `/api/me/verification-profile`           | Autenticado — `{ curp, phone, privacyNoticeAccepted: true }` (validados; se guardan cifrados). Requerido antes de verificar líneas.                                                                                                                                                                                                                                                                                      |
| `DELETE` | `/api/me/verification-profile`           | Autenticado — elimina el CURP/celular cifrados del usuario.                                                                                                                                                                                                                                                                                                                                                              |
| `POST`   | `/api/ingest`                            | Admin — **asíncrono**: encola `ingest/scrape.requested` en Inngest (el scraping corre en el worker Hetzner, no en Vercel) y responde **200** `{ ok, queued: true, jobId }`. La lista se actualiza al terminar el job.                                                                                                                                                                                                    |
| `GET`    | `/api/companies`                         | Autenticado — lista (usuarios normales: solo `enabled`)                                                                                                                                                                                                                                                                                                                                                                  |
| `PATCH`  | `/api/companies/[id]`                    | Admin — `{ "enabled": boolean }`                                                                                                                                                                                                                                                                                                                                                                                         |
| `POST`   | `/api/monitor/[linkId]`                  | Autenticado — requiere perfil CURP/celular (**428** si falta). **Asíncrono**: si el enlace no tiene `supportsAutomatedVerification`, **422** sin encolar; si lo tiene, encola un `MonitorBulkJob` de 1 item (ejecutado en el worker) y transmite el resultado por **SSE** (`text/event-stream`): `start`, `item_start`, `item` (`ok`/`error`), `done`/`fatal`. Ya no lanza Chromium en Vercel ni devuelve JSON síncrono. |
| `POST`   | `/api/monitor/bulk`                      | Autenticado — cuerpo `{ "linkIds": string[] }` (máx. 150). **Asíncrono**: crea el `MonitorBulkJob`, encola el fan-out en Inngest (worker Hetzner) y transmite progreso desde la DB por **SSE**: `start`, `item_start`, `item`, `done` (opcional `cancelled`), `fatal`. Ya no ejecuta Chromium inline en Vercel. Reconexión: `GET /api/monitor/bulk?jobId=` reanuda el stream reconstruyendo el estado desde la DB.       |
| `PATCH`  | `/api/company-links/[linkId]`            | Autenticado — ajuste manual de estado                                                                                                                                                                                                                                                                                                                                                                                    |
| `GET`    | `/api/company-links/[linkId]/screenshot` | Autenticado — PNG de la última verificación (si existe `reviewScreenshotAt`)                                                                                                                                                                                                                                                                                                                                             |

## Patrones de monitoreo

Los patrones viven en `src/monitoring/patterns/`. El registro en `src/monitoring/index.ts` elige un patrón por **URL** (`matchesUrl`) o por **nombre de compañía** (`matches`) y cae en **generic** si no hay coincidencia. Solo los patrones con `supportsAutomatedVerification: true` disparan Playwright desde el botón «Verificar»; el resto se revisa manualmente en el dashboard. Amplía con selectores y lógica por operador cuando conozcas cada portal.

## Documentación

| Doc                                                          | Descripción                                        |
| ------------------------------------------------------------ | -------------------------------------------------- |
| [`docs/PRD.md`](docs/PRD.md)                                 | Producto, objetivo y alcance                       |
| [`docs/PHASES.md`](docs/PHASES.md)                           | Fases de desarrollo — fuente de verdad de progreso |
| [`docs/ENV.md`](docs/ENV.md)                                 | Variables de entorno detalladas                    |
| [`docs/AVISO_PRIVACIDAD.md`](docs/AVISO_PRIVACIDAD.md)       | Base legal/operativa para tratar CURP y celular    |
| [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md)                   | Schema y modelo de datos                           |
| [`docs/TECH_STACK.md`](docs/TECH_STACK.md)                   | Stack tecnológico                                  |
| [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)               | Flujo de contribución                              |
| [`docs/TESTING.md`](docs/TESTING.md)                         | Estrategia de testing                              |
| [`docs/MONITORING_PATTERNS.md`](docs/MONITORING_PATTERNS.md) | Cómo funcionan y agregar patrones                  |

## Notas

- El sitio del CRT puede devolver **403** a clientes simples; por eso el ingest usa Playwright.
- Las capturas de verificación se guardan en **`data/review-screenshots/`** (local / servidor con disco). En Vercel serverless no son persistentes: usar almacenamiento externo si despliegas ahí.
- El ingest **filtra** enlaces `*.gob.mx` y rutas típicas de pie de página; para tablas, el nombre de compañía sale de la **primera columna con texto válido** antes del enlace (se ignoran índices numéricos y ruido de UI como selectores `[class*="title"]`).
- Despliegue serverless (p. ej. Vercel) no es adecuado para Playwright. Ver `docs/PHASES.md` — Fase 2 para opciones de deployment en producción.

## Production practices

- **Pre-commit:** Husky runs lint-staged (`eslint --fix`, `prettier --write`) on staged `*.ts` / `*.tsx`.
- **API contracts:** Zod schemas for monitor and companies routes → OpenAPI via `@asteasolutions/zod-to-openapi` → Scalar UI at `/api-docs` (spec JSON at `/api/openapi`).
- **Observability:** `@sentry/nextjs` with PII scrubbing (CURP/credentials headers). Set `SENTRY_DSN` in `.env.local` after creating the `crt-lineas` project in Sentry. **Core Web Vitals (RUM):** Sentry Performance → Web Vitals. **Lab:** Lighthouse CI on PRs. Dev probe: `GET /api/debug/sentry` (disabled when `VERCEL_ENV=production`); verify with `npm run test:observability`.
- **Async jobs:** All browser work (ingest scrape, single + bulk verification) is dispatched via Inngest and executed by the persistent **Hetzner worker** (`worker/`, Inngest Connect) — never Chromium on Vercel. Single/bulk create a `MonitorBulkJob`; SSE streams progress from Neon (`GET /api/monitor/bulk?jobId=` resumes). During migration, `INNGEST_SERVE_BROWSER_ON_VERCEL` (default on) keeps Vercel serving the functions for rollback. Pattern reference: [portfolio `docs/inngest-pattern.md`](https://github.com/mauricioabh/portfolio/blob/master/docs/inngest-pattern.md).
- **API authorization tests:** Vitest suite in `tests/auth/` (`npm run test:auth`) — non-admin blocked from `POST /api/ingest`; company-link screenshot/review routes scoped by Clerk `userId`. Runs in CI (`.github/workflows/ci.yml`); mocks auth/Prisma, no Neon or Playwright required.
- **Security scanning:** GitHub CodeQL (`.github/workflows/codeql.yml`); Dependabot for npm and Actions (`.github/dependabot.yml`).

## Licencia

Privado / uso interno.
