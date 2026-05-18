# Development Flow — crt-lineas

Flujo estándar para implementar cualquier feature o fase usando AI + OpenSpec.

## Vista general

```
Nuevo agente
    │
    ├── /opsx-propose <nombre>     → spec completo (proposal + design + tasks)
    │       └── Aprobación humana (revisar tasks.md antes de continuar)
    │
    ├── /opsx-apply                → implementación con checkboxes
    │       └── Agente ejecuta tareas en orden, marcando progreso
    │
    ├── /post-implementation       → cierre: docs + calidad + residuos
    │       └── Actualiza docs según tabla de coherencia
    │
    ├── /ship                      → commit Conventional + PR hacia dev
    │       └── CI corre: typecheck + lint + build + docs-coherence
    │
    └── /opsx-archive              → archiva el change de OpenSpec
```

## Cuándo usar un agente nuevo vs continuar en el mismo

| Situación                                                       | Acción                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Nueva fase o feature                                            | Agente nuevo                                                                    |
| Bug fix puntual                                                 | Mismo agente si el contexto es relevante                                        |
| Fase compleja con decisión de arquitectura pendiente            | Agente de exploración (`/opsx-explore`) primero, luego agente de implementación |
| Fase con subtareas independientes (ej. un patrón por operadora) | Un agente por subtarea                                                          |

## Cuándo desglosar una fase en varios agentes

Desglosar cuando:

- La fase tiene una **decisión de arquitectura** pendiente que cambia el scope
- Las subtareas son **independientes entre sí** (no se bloquean mutuamente)
- Hay **riesgo de bloquearse** con sistemas externos (portales con captcha, APIs de terceros)
- La fase es suficientemente grande para que el contexto del agente se vuelva pesado

Ejemplo — Fase 3 (patrones):

```
Agente: fase-3-patron-telcel
Agente: fase-3-patron-movistar   (independiente, puede correr en paralelo)
```

## Capas de garantía de calidad

| Capa                                       | Cuándo actúa               | Qué verifica                                                      |
| ------------------------------------------ | -------------------------- | ----------------------------------------------------------------- |
| `.cursor/rules/Convenciones-de-codigo.mdc` | Cada sesión de agente      | El agente sabe qué docs actualizar                                |
| `/post-implementation`                     | Al terminar implementación | Checklist de docs + calidad antes de commit                       |
| CI `docs-coherence` job                    | En cada PR                 | Schema sin DATA_MODEL.md → falla; .env.example sin ENV.md → falla |
| PR template                                | Antes del merge            | Revisión humana de documentación y calidad                        |

## Flujo OpenSpec detallado

### Proponer

```powershell
# En el agente, describir qué se quiere construir:
# El agente corre internamente:
openspec new change "nombre-kebab-case"
openspec status --change "nombre" --json
openspec instructions <artifact-id> --change "nombre" --json
```

Genera en `openspec/changes/<nombre>/`:

- `proposal.md` — qué y por qué
- `design.md` — cómo
- `tasks.md` — pasos de implementación con checkboxes

### Aplicar

El agente lee `tasks.md` y ejecuta cada tarea marcando `[x]` conforme avanza.

### Archivar

```powershell
openspec status --change "nombre"   # verificar que todo está done
# El agente mueve a openspec/changes/archive/YYYY-MM-DD-nombre/
```

Los changes **se commitean** — son la fuente de verdad de qué se diseñó y ejecutó.

## Variables de entorno para desarrollo

Ver `docs/ENV.md`. Los scripts `npm run db:push`, `npm run db:generate` y `npm run db:migrate` cargan **automáticamente** `.env.local` (`node --env-file=.env.local`). Si prefieres no usar `.env.local`:

```powershell
$env:DATABASE_URL="postgresql://..."; npx prisma db push
```

## Comandos de referencia rápida

```powershell
npm run dev          # desarrollo
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run format       # Prettier
npm run build        # build de producción
npm run db:push      # sync schema (dev)
npm run db:migrate   # migración formal
openspec --version   # verificar CLI
openspec status      # ver changes activos
```
