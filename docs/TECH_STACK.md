# Tech Stack — crt-lineas

## Framework y runtime

| Tecnología | Versión | Rol                                             |
| ---------- | ------- | ----------------------------------------------- |
| Next.js    | 16.2.4  | Framework web (App Router, RSC, Route Handlers) |
| React      | 19      | UI                                              |
| TypeScript | 5       | Tipado estático                                 |
| Node.js    | 20      | Runtime                                         |

## Autenticación

| Tecnología | Versión | Rol                                        |
| ---------- | ------- | ------------------------------------------ |
| Clerk      | 7.x     | Auth, sesiones, roles vía `publicMetadata` |

Roles: `admin` (acceso total) y `user` (solo lectura + verificación).

## Base de datos

| Tecnología | Versión | Rol                            |
| ---------- | ------- | ------------------------------ |
| Neon       | —       | PostgreSQL serverless          |
| Prisma     | 6       | ORM, migrations, Prisma Client |

## Almacenamiento de archivos

| Tecnología  | Versión | Rol                                                                                                               |
| ----------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| UploadThing | 7.x     | Capturas de verificación del monitor (subida servidor con `UTApi`, ACL privada, opcional vía `UPLOADTHING_TOKEN`) |

## Automatización / Scraping

| Tecnología | Versión | Rol                                                                      |
| ---------- | ------- | ------------------------------------------------------------------------ |
| Playwright | 1.59+   | Scraping CRT + verificación de líneas por CURP (corre en el worker)      |
| Inngest    | 3.x     | Transporte de jobs de navegador (Vercel encola → worker Hetzner ejecuta) |
| tsx        | 4.x     | Runtime TypeScript del worker (`worker/`, resuelve alias `@/`)           |

> **Nota**: Playwright requiere un runtime Node persistente. El navegador ya **no** corre en Vercel: se ejecuta en el worker Hetzner (ver "Deploy target").

## Orquestación de jobs (Inngest)

El scraping y la verificación se despachan como eventos Inngest y los consume un **worker persistente** vía **Inngest Connect** (conexión saliente, sin ingress público):

- `ingest/scrape.requested` → `ingestScrape` (scraping CRT + upsert).
- `monitor/bulk.started` → `monitorBulkStart` (fan-out) → `monitor/link.verify` → `monitorLinkVerify`.
- La verificación single también encola un `MonitorBulkJob` de 1 item (mismo camino que bulk).
- Vercel puede seguir sirviendo estas funciones en `/api/inngest` mientras el flag `INNGEST_SERVE_BROWSER_ON_VERCEL` no sea `0` (coexistencia/rollback).

## UI / Estilos

| Tecnología               | Versión | Rol                                                                       |
| ------------------------ | ------- | ------------------------------------------------------------------------- |
| Tailwind CSS             | 4       | Estilos utilitarios                                                       |
| shadcn (base-ui)         | —       | Componentes UI (Button, Badge, Switch, Table, Card)                       |
| class-variance-authority | —       | Variantes de componentes                                                  |
| clsx + tailwind-merge    | —       | Composición de clases (`cn()`)                                            |
| lucide-react             | —       | Iconos                                                                    |
| framer-motion            | 12.x    | Animaciones de UI (landing y transiciones de página en client components) |

> **Nota**: `framer-motion` solo se usa en componentes `"use client"` (p. ej. `src/app/_marketing/landing.tsx`, `src/components/motion/*`). Las páginas server siguen siendo RSC donde aplica.

## Dev tooling

| Tecnología  | Rol                                         |
| ----------- | ------------------------------------------- |
| Prettier    | Formateo de código                          |
| ESLint      | Linting (next/core-web-vitals + TypeScript) |
| Husky       | Git hooks                                   |
| lint-staged | Lint/format en pre-commit                   |
| commitlint  | Conventional Commits enforcement            |

## CI/CD

| Tecnología     | Rol                               |
| -------------- | --------------------------------- |
| GitHub Actions | CI: typecheck + lint + build      |
| CodeQL         | Análisis de seguridad semanal     |
| Dependabot     | Actualizaciones semanales de deps |

## Deploy target (dual)

- **Vercel** — UI, auth (Clerk), API ligera, encolado de eventos Inngest y lectura de estado/resultado desde la DB. No ejecuta Chromium.
- **Worker Hetzner** — proceso Node persistente (imagen Docker basada en `mcr.microsoft.com/playwright`) que ejecuta Playwright/Chromium. Se registra en Inngest vía Connect. Empaquetado con `worker/Dockerfile` + `docker-compose.worker.yml` (restart `unless-stopped`); CI/CD en `.github/workflows/worker-deploy.yml` (build → GHCR → SSH deploy).

Inngest Cloud es el transporte único entre ambos. Durante la migración, la ejecución puede coexistir en Vercel (flag `INNGEST_SERVE_BROWSER_ON_VERCEL`) para rollback.
