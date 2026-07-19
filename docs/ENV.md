# Variables de entorno — crt-lineas

Copiar `.env.example` a `.env.local` y completar los valores.

## Base de datos

| Variable       | Descripción                          | Requerida |
| -------------- | ------------------------------------ | --------- |
| `DATABASE_URL` | Connection string de Neon PostgreSQL | ✅        |

En desarrollo, **`npm run db:push`**, **`npm run db:generate`** y **`npm run db:migrate`** cargan automáticamente `.env.local` (`node --env-file=.env.local`). El comando `npx prisma` **no** carga ese archivo: sin `DATABASE_URL` en la sesión obtendrás **P1012**. En Windows, si tras `npm run db:push` falla **EPERM** al actualizar `query_engine-windows.dll.node`, cierra `npm run dev` y ejecuta solo **`npm run db:generate`**.

Obtener de [console.neon.tech](https://console.neon.tech) → tu proyecto → Connection string.

## Clerk (autenticación)

| Variable                              | Descripción                                            | Requerida                      |
| ------------------------------------- | ------------------------------------------------------ | ------------------------------ |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`   | Clave pública de Clerk (`pk_test_...` o `pk_live_...`) | ✅                             |
| `CLERK_SECRET_KEY`                    | Clave secreta de Clerk (`sk_test_...` o `sk_live_...`) | ✅                             |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`       | Ruta de sign-in                                        | ✅ (default: `/sign-in`)       |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL`       | Ruta de sign-up                                        | ✅ (default: `/sign-up`)       |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Redirige tras login                                    | ✅ (default: `/dashboard`)     |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Redirige tras registro                                 | ✅ (default: `/dashboard`)     |
| `NEXT_PUBLIC_CLERK_SIGN_OUT_URL`      | Redirige tras logout                                   | Opcional (default: `/sign-in`) |

Obtener de [dashboard.clerk.com](https://dashboard.clerk.com) → tu aplicación → API Keys.

## Credenciales de verificación (por usuario)

| Variable                                  | Descripción                                                                                                                                                                                        | Requerida |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `VERIFICATION_CREDENTIALS_ENCRYPTION_KEY` | Clave AES-256 (32 bytes, codificados en **base64**) para cifrar CURP y celular en Neon antes de guardarlos. Generar: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | ✅        |

Cada usuario configura CURP y celular en **`/dashboard/setup`** (API `PUT /api/me/verification-profile`). Los valores **no** se guardan en texto claro en la base de datos.

## Monitoreo (Playwright)

| Variable                       | Descripción                                                                                                                                                                                                                                                                                                                                                          | Requerida                                          |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `MONITOR_CURP`                 | _(Legacy)_ Solo referencia local; el monitor usa el perfil del usuario autenticado.                                                                                                                                                                                                                                                                                  | No                                                 |
| `MONITOR_PHONE`                | _(Legacy)_ Idem.                                                                                                                                                                                                                                                                                                                                                     | No                                                 |
| `PLAYWRIGHT_HEADED`            | _(Legacy / debug local)_ El navegador corre en el **worker Hetzner**, siempre headless. La ejecución ya no ocurre en Vercel ni de forma síncrona; esta variable solo aplica si se corre un patrón en local para depurar.                                                                                                                                             | Opcional (default: `false`)                        |
| `MONITOR_MANUAL_WAIT_MS`       | Tiempo máximo (ms) para pasos manuales (captchas)                                                                                                                                                                                                                                                                                                                    | Opcional (default: `120000`)                       |
| `MONITOR_BULK_DELAY_MS`        | Pausa (ms) entre verificaciones consecutivas al **mismo hostname** dentro de `POST /api/monitor/bulk` (un solo Chromium). Reduce riesgo de rate-limit en dominios con muchas operadoras (p. ej. `rnu.altanredes.com`).                                                                                                                                               | Opcional (default: `5000`)                         |
| `MONITOR_BULK_ITEM_TIMEOUT_MS` | Tiempo máximo (ms) por ítem de verificación (single y bulk; se ejecuta en el worker Hetzner). Si Playwright no termina dentro de este tiempo, el ítem se cancela y se guarda como error en BD; en bulk continúa con el siguiente. `0` deshabilita el límite. Default `180000` (los patrones navegan hasta 120 s).                                                    | Opcional (default: `180000`)                       |
| `MONITOR_ACTION_TIMEOUT_MS`    | Timeout (ms) para acciones Playwright individuales (p. ej. `.click()`) dentro de los patrones de monitoreo. Útil para dar más margen bajo carga (verificación masiva contra el mismo host) sin tocar el timeout global del ítem. Default `30000`. Actualmente aplicado en el patrón Altán RNU (`src/monitoring/patterns/altan-rnu.ts`).                              | Opcional (default: `30000`)                        |
| `MONITOR_PROXY_URL`            | Proxy por el que salen **solo** los patrones de `MONITOR_PROXY_PATTERN_IDS` (Chromium `launch.proxy`). Sirve para portales que bloquean la IP del datacenter (Altán RNU → AWS WAF 403): se enruta por una IP residencial/limpia. Formatos: `socks5h://host:port`, `http://user:pass@host:port`. Vacío/ausente = todo sale directo. Ver `docs/ALTAN_PROXY_TUNNEL.md`. | Opcional (default: _(vacío)_)                      |
| `MONITOR_PROXY_PATTERN_IDS`    | Lista (coma-separada) de IDs de patrón que deben usar `MONITOR_PROXY_URL`. Default: `altan-rnu,altan-rnu-consulta`. El resto de portales ignora el proxy.                                                                                                                                                                                                            | Opcional (default: `altan-rnu,altan-rnu-consulta`) |

## Inngest y worker Hetzner (transporte de jobs de navegador)

Todo el trabajo de navegador (scraping de `/api/ingest`, verificación single y bulk) se despacha por **Inngest** y lo ejecuta un **worker persistente en Hetzner** (Playwright/Chromium). Vercel solo encola eventos y lee resultados desde la DB.

| Variable                          | Descripción                                                                                                                                                                                                                                         | Requerida                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `INNGEST_EVENT_KEY`               | Clave de envío de eventos (Inngest Cloud). **Compartida Vercel↔worker.**                                                                                                                                                                            | ✅ en producción                       |
| `INNGEST_SIGNING_KEY`             | Clave de firma/registro (Inngest Connect del worker). **Compartida Vercel↔worker.**                                                                                                                                                                 | ✅ en producción                       |
| `INNGEST_SERVE_BROWSER_ON_VERCEL` | Flag de coexistencia. Por defecto `/api/inngest` en Vercel **no** sirve las funciones de navegador (el worker Hetzner es el ejecutor único). Poner en `1` para reactivar el serve en Vercel (requiere restaurar `@sparticuz/chromium` y su config). | Opcional (default: no sirve en Vercel) |

Las siguientes son **exclusivas del worker** (VPS Hetzner; ver `.env.worker.example`):

| Variable             | Descripción                                                              | Requerida                               |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| `WORKER_HEALTH_PORT` | Puerto del healthcheck HTTP del worker (responde `ok`).                  | Opcional (default: `3100`)              |
| `WORKER_CONCURRENCY` | Límite de jobs concurrentes (`maxWorkerConcurrency` de Inngest Connect). | Opcional (default: `1`)                 |
| `WORKER_INSTANCE_ID` | Identificador estable de la instancia conectada a Inngest.               | Opcional (default: `crt-lineas-worker`) |

**Envs que el worker comparte con Vercel** (mismos valores en ambos entornos): `DATABASE_URL`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `VERIFICATION_CREDENTIALS_ENCRYPTION_KEY`, `UPLOADTHING_TOKEN`, y opcionalmente los `MONITOR_*`. El worker **no** necesita claves de Clerk (las credenciales se leen cifradas de la DB). Los secretos del worker se inyectan por `.env.worker` en el VPS (nunca en el repo).

## Sentry (observabilidad)

| Variable            | Descripción                                                                  | Requerida |
| ------------------- | ---------------------------------------------------------------------------- | --------- |
| `SENTRY_DSN`        | DSN del proyecto `crt-lineas` en [sentry.io](https://sentry.io)              | Opcional  |
| `SENTRY_ORG`        | Slug de la org en Sentry (subida de source maps en CI/Vercel)                | Opcional  |
| `SENTRY_PROJECT`    | Nombre del proyecto (default: `crt-lineas`)                                  | Opcional  |
| `SENTRY_AUTH_TOKEN` | Token de auth para upload de source maps en build (solo CI/Vercel, no local) | Opcional  |

Sin `SENTRY_DSN`, el SDK queda deshabilitado. Los eventos pasan por scrubbing de CURP, teléfono y cabeceras sensibles (`src/lib/sentry-config.ts`). En desarrollo, `GET /api/debug/sentry` envía un error de prueba (404 en producción).

## Capturas del monitor (UploadThing)

| Variable            | Descripción                                                                                                                                                                                                                                                                                                                                                                                               | Requerida |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `UPLOADTHING_TOKEN` | Token del dashboard de UploadThing (formato que espera el SDK en servidor). Si está definido, tras cada verificación exitosa el PNG se sube con ACL **privada** y se guarda el `fileKey` en BD; la ruta `GET /api/company-links/[linkId]/screenshot` firma una URL temporal para servir la imagen. Sin token, las capturas solo se escriben en `data/review-screenshots/` (adecuado en desarrollo local). | Opcional  |

## Notas

- **Nunca** commitear `.env.local` — está en `.gitignore`
- Tras `POST /api/monitor/:linkId`, si la captura se guarda bien: con `UPLOADTHING_TOKEN`, la imagen queda en UploadThing (privada) y el `fileKey` en la columna mapeada `reviewScreenshotUtKey`; sin token, queda `data/review-screenshots/<linkId>.png` (carpeta `data/` en `.gitignore`).
- Para CI, las variables de Clerk usan placeholders (ver `.github/workflows/ci.yml`)
- En producción, configurar las variables en el panel del proveedor (Railway/Vercel/etc.)
