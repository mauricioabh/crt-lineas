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

| Método   | Ruta                                     | Quién                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api-docs`                              | Público — **Scalar** UI (OpenAPI 3.0 generado desde Zod)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GET`    | `/api/openapi`                           | Público — JSON del contrato OpenAPI                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `GET`    | `/api/me/verification-profile`           | Autenticado — `{ complete, curpMasked?, phoneMasked? }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PUT`    | `/api/me/verification-profile`           | Autenticado — `{ curp, phone, privacyNoticeAccepted: true }` (validados; se guardan cifrados). Requerido antes de verificar líneas.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `DELETE` | `/api/me/verification-profile`           | Autenticado — elimina el CURP/celular cifrados del usuario.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `POST`   | `/api/ingest`                            | Admin — sincroniza compañías y enlaces Persona desde el CRT (Playwright)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GET`    | `/api/companies`                         | Autenticado — lista (usuarios normales: solo `enabled`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `PATCH`  | `/api/companies/[id]`                    | Admin — `{ "enabled": boolean }`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `POST`   | `/api/monitor/[linkId]`                  | Autenticado — requiere perfil CURP/celular (**428** si falta). Si el enlace tiene `supportsAutomatedVerification`, ejecuta Playwright y actualiza la fila; si no, **422** sin abrir navegador. Éxito: **200** `{ ok, patternId, result, link }`. Fallo de ejecución: **500** `{ error, errorDetail? }` (mensaje legible + detalle técnico); se persiste en `MonitorVerificationLog` y en `CompanyLink.lastMonitorError*`. Query opcional `?bulk=1`: fuerza **headless** aunque `PLAYWRIGHT_HEADED=true` (la masiva usa `POST /api/monitor/bulk`). |
| `POST`   | `/api/monitor/bulk`                      | Autenticado — cuerpo `{ "linkIds": string[] }` (máx. 150). Un solo Chromium y contexto compartido; serie + **SSE** (`text/event-stream`): `start`, `item_start` (enlace en curso), `item` (cada resultado; `error` con mensaje legible si `ok: false`), `done` (opcional `cancelled: true` si se abortó la petición). Cada ítem escribe historial en Neon con el mismo `batchId`. Siempre headless; pausa mismo hostname vía `MONITOR_BULK_DELAY_MS`.                                                                                             |
| `PATCH`  | `/api/company-links/[linkId]`            | Autenticado — ajuste manual de estado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `GET`    | `/api/company-links/[linkId]/screenshot` | Autenticado — PNG de la última verificación (si existe `reviewScreenshotAt`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

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
- **Observability:** Sentry planned — set `SENTRY_DSN` in `.env.local` after creating the `crt-lineas` project in Sentry.

## Licencia

Privado / uso interno.
