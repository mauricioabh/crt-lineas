---
name: /post-implementation
description: Checklist de cierre después de implementar cualquier cambio
category: workflow
---

# /post-implementation — Checklist de cierre

Correr este command al terminar cualquier implementación, antes de commitear.

## 1. Verificar documentación

Revisar qué archivos cambiaron con `git diff --name-only` y aplicar la tabla:

| Si cambió...                  | Actualizar...                                      |
| ----------------------------- | -------------------------------------------------- |
| `prisma/schema.prisma`        | `docs/DATA_MODEL.md`                               |
| Cualquier `src/app/api/`      | `README.md` tabla de rutas (si cambió el contrato) |
| `.env.example`                | `docs/ENV.md`                                      |
| `src/monitoring/patterns/`    | `docs/MONITORING_PATTERNS.md`                      |
| Tarea en `openspec/changes/`  | `docs/PHASES.md` — marcar checkboxes completados   |
| `package.json` dependencias   | `docs/TECH_STACK.md` si es dep significativa       |
| Nuevo `.cursor/commands/*.md` | `docs/CONTRIBUTING.md` sección de commands         |

## 2. Verificar calidad

```powershell
npm run typecheck
npm run lint
```

Corregir cualquier error antes de continuar.

## 3. Verificar build (si hubo cambios en rutas, layouts o config)

```powershell
npm run build
```

## 4. Revisar que no hay residuos

- Sin `console.log` de debug
- Sin comentarios `TODO` sin ticket
- Sin secretos hardcodeados
- Sin imports no usados

## 5. Commitear y PR

Correr `/ship` para hacer el commit con mensaje Conventional y abrir PR.

## 6. Archivar OpenSpec (si aplica)

Si la implementación completó un change de OpenSpec:

```
openspec status --change "<nombre>"
```

Confirmar que todas las tareas están done, luego `/opsx-archive`.
