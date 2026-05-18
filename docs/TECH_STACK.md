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

| Tecnología | Versión | Rol                                            |
| ---------- | ------- | ---------------------------------------------- |
| Playwright | 1.59+   | Scraping CRT + verificación de líneas por CURP |

> **Nota**: Playwright requiere un runtime Node persistente. No funciona en Edge o Serverless sin configuración especial.

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

## Deploy target

Planeado: **Railway** (o equivalente con Node persistente para Playwright).
Alternativa serverless: Vercel con estrategia de servidor externo para Playwright.
