# Testing — crt-lineas

> API authorization tests live in `tests/auth/` (`npm run test:auth`). E2E and broader unit coverage remain planned — see Fase 4 in `docs/PHASES.md`.

## API authorization tests (Vitest)

| Script              | Scope                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| `npm run test:auth` | Non-admin blocked from `POST /api/ingest`; company-link review/screenshot scoped by Clerk `userId` |

Mocks `@/lib/auth` and Prisma — no Neon or Playwright required in CI.

## Plan de testing

### Tests unitarios (Vitest)

Candidatos prioritarios:

| Módulo                               | Qué probar                                         |
| ------------------------------------ | -------------------------------------------------- |
| `src/lib/auth.ts`                    | `getRoleFromPublicMetadata()` con distintos inputs |
| `src/monitoring/patterns/generic.ts` | `inferFromBodyText()` con texto de ejemplo         |
| `src/lib/crt-ingest.ts`              | Parsing de empresas y links desde HTML de ejemplo  |
| `src/lib/http.ts`                    | Helpers de respuesta HTTP                          |

### Tests E2E (Playwright)

| Caso                   | Descripción                                             |
| ---------------------- | ------------------------------------------------------- |
| Redirección sin auth   | `GET /` → `/sign-in` sin sesión activa                  |
| Redirección tras login | `/dashboard` carga correctamente tras autenticación     |
| Toggle de empresa      | Admin puede cambiar `enabled` de una empresa            |
| Verificación de link   | Botón "Verificar" dispara el flujo y persiste resultado |

### Reusar sesión en Playwright (evitar login social)

Google OAuth suele bloquear navegadores automatizados. Para E2E / automatización, usar **email + password** (o email code) en Clerk y reusar sesión con `storageState`.

1. Levanta el dev server:

```powershell
npm run dev
```

2. Corre el setup una sola vez y haz login manual en la ventana (cuando caiga en `/dashboard` guardará la sesión):

```powershell
npm run pw:auth
```

Esto crea `/.playwright/auth.json` (ignorado por git).

3. Abrir la app ya autenticado (sin volver a escribir credenciales):

```powershell
npm run pw:open
```

### Configuración planeada

**Vitest** para unitarios:

```ts
// vitest.config.ts
{
  environment: "node",
  include: ["src/**/*.test.{ts,tsx}"]
}
```

**Playwright** para E2E:

```ts
// playwright.config.ts
{
  testDir: "e2e/",
  baseURL: "http://localhost:3000",
  webServer: { command: "npm run dev", reuseExistingServer: true }
}
```

## Correr tests (cuando estén implementados)

```powershell
npm run test          # Vitest unitarios
npm run test:e2e      # Playwright E2E
```
