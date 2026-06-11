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

| Variable                       | Descripción                                                                                                                                                                                                                                                                                                                                           | Requerida                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `MONITOR_CURP`                 | _(Legacy)_ Solo referencia local; el monitor usa el perfil del usuario autenticado.                                                                                                                                                                                                                                                                   | No                           |
| `MONITOR_PHONE`                | _(Legacy)_ Idem.                                                                                                                                                                                                                                                                                                                                      | No                           |
| `PLAYWRIGHT_HEADED`            | `"true"` abre browser visible solo en verificación **individual** (`POST` sin `bulk=1`) y **solo en local** (`VERCEL` no definido). En Vercel siempre headless (`@sparticuz/chromium`). `POST /api/monitor/bulk` siempre headless. Para **Altán `/consulta`** y **Diri** (captcha), en local hace falta headed + `MONITOR_MANUAL_WAIT_MS` suficiente. | Opcional (default: `false`)  |
| `MONITOR_MANUAL_WAIT_MS`       | Tiempo máximo (ms) para pasos manuales (captchas)                                                                                                                                                                                                                                                                                                     | Opcional (default: `120000`) |
| `MONITOR_BULK_DELAY_MS`        | Pausa (ms) entre verificaciones consecutivas al **mismo hostname** dentro de `POST /api/monitor/bulk` (un solo Chromium). Reduce riesgo de rate-limit en dominios con muchas operadoras (p. ej. `rnu.altanredes.com`).                                                                                                                                | Opcional (default: `5000`)   |
| `MONITOR_BULK_ITEM_TIMEOUT_MS` | Tiempo máximo (ms) por ítem en la verificación masiva (`POST /api/monitor/bulk`). Si Playwright no termina dentro de este tiempo, el ítem se cancela automáticamente y se guarda como error en BD; la verificación masiva continúa con el siguiente ítem. `0` deshabilita el límite.                                                                  | Opcional (default: `20000`)  |

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
