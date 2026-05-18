# Contributing — crt-lineas

## Setup

Ver `/onboarding` command o `docs/ENV.md` para el setup inicial completo.

```powershell
git clone https://github.com/mauricioabh/crt-lineas.git
Set-Location crt-lineas
npm install
Copy-Item .env.example .env.local
# completar .env.local
npm run dev
```

## Ramas

| Rama            | Propósito                              |
| --------------- | -------------------------------------- |
| `main`          | Producción — siempre estable           |
| `dev`           | Desarrollo activo — base para features |
| `feat/<nombre>` | Nueva funcionalidad                    |
| `fix/<nombre>`  | Corrección de bug                      |
| `db/<nombre>`   | Cambio de schema o migración           |
| `ci/<nombre>`   | CI/CD o infraestructura                |

## Commits

Usar **Conventional Commits**. Formato: `tipo(scope): descripción`

Tipos: `feat`, `fix`, `refactor`, `style`, `db`, `chore`, `docs`, `test`, `ci`

Ejemplos:

```
feat(monitor): add telcel-specific verification selectors
fix(dashboard): handle null hasActiveLines in status badge
db: add reviewHistory table
docs: update ENV.md with MONITOR_CURP description
```

El commit-msg hook valida el formato automáticamente.

## Pull Requests

1. Crear rama desde `dev`
2. Hacer cambios + verificar con `npm run typecheck` y `npm run lint`
3. Push y abrir PR hacia `dev`
4. Completar el PR template (`.github/pull_request_template.md`)
5. CI debe pasar antes del merge

## Comandos útiles

```powershell
npm run dev          # Servidor de desarrollo
npm run typecheck    # TypeScript sin emitir
npm run lint         # ESLint
npm run format       # Prettier en todos los archivos
npm run build        # Build de producción
npm run db:push      # Sync schema a DB (dev); lee `.env.local`
npm run db:migrate   # Migración formal; lee `.env.local`
npm run db:generate  # Regenerar Prisma Client; lee `.env.local`
npm run db:clear-companies  # Borra Company + CompanyLink (sync limpio desde CRT)
```

### Prisma en Windows (P1012 / EPERM)

| Error                                                      | Qué hacer                                                                                                                                                                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1012** — `Environment variable not found: DATABASE_URL` | No uses `npx prisma` solo: no lee `.env.local`. Usa **`npm run db:push`** o define antes `$env:DATABASE_URL="..."` en PowerShell.                                                                                                         |
| **EPERM** al renombrar `query_engine-windows.dll.node`     | Suele ser un proceso que bloquea el archivo (p. ej. **`npm run dev`**, otro terminal con Node). Cierra el dev server, espera 2 s y ejecuta **`npm run db:generate`**. Si la base ya estaba sincronizada, solo falta regenerar el cliente. |

## Cursor commands disponibles

- `/onboarding` — Setup inicial
- `/ship` — Verificar + commit + PR
- `/fix` — Diagnosticar y corregir un bug
- `/db-migration` — Cambio de schema Prisma
- `/post-implementation` — Checklist de cierre: docs + calidad + residuos
- `/opsx-propose` — Proponer nueva feature/fase con OpenSpec
- `/opsx-apply` — Implementar desde un spec de OpenSpec
- `/opsx-explore` — Explorar/analizar sin implementar
- `/opsx-archive` — Archivar un change completado

## Flujo OpenSpec (para features y fases)

OpenSpec v1.3 está instalado globalmente. Ver `docs/DEVELOPMENT_FLOW.md` para el flujo completo con diagramas y ejemplos.

Resumen:

1. **Proponer** — `/opsx-propose <nombre>` genera `proposal.md`, `design.md` y `tasks.md`
2. **Implementar** — `/opsx-apply` ejecuta las tareas con checkboxes
3. **Cerrar** — `/post-implementation` verifica docs + calidad antes del commit
4. **Publicar** — `/ship` hace commit + PR
5. **Archivar** — `/opsx-archive` mueve el change a `openspec/changes/archive/`

Los changes de OpenSpec **sí se commitean**.

## Guardrails

- **No commitear `.env.local`** — está en `.gitignore`
- **No editear `prisma/schema.prisma`** sin leer `docs/DATA_MODEL.md` primero
- **Pedir aprobación** para migraciones destructivas
- Pre-commit hook corre lint-staged automáticamente
