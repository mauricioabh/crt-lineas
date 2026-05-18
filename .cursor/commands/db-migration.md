---
name: /db-migration
description: Aplica cambios de schema Prisma de manera segura
category: database
---

# /db-migration — Cambio de schema Prisma

## Antes de empezar

1. Leer `prisma/schema.prisma` — entender el estado actual
2. Leer `docs/DATA_MODEL.md` — entender el modelo de datos
3. Describir el cambio y **pedir aprobación** si es destructivo (renombrar columnas, eliminar campos, cambiar relaciones)

## Flujo de desarrollo (sin historial)

```powershell
# Editar prisma/schema.prisma
# Luego sync:
$env:DATABASE_URL="postgresql://..."; npx prisma db push

# Regenerar cliente
npx prisma generate
```

## Flujo formal (con historial de migración)

```powershell
$env:DATABASE_URL="postgresql://..."; npx prisma migrate dev --name <nombre-descriptivo>
```

El nombre debe ser descriptivo: `add-review-notes`, `add-company-slug`, etc.

## Verificar

Después de cualquier cambio de schema:

1. Verificar que el Prisma Client compila: `npx tsc --noEmit`
2. Probar las rutas API afectadas manualmente
3. Actualizar `docs/DATA_MODEL.md` si el modelo cambió

## Commitear

```powershell
git add prisma/ docs/DATA_MODEL.md
git commit -m "db: <descripción del cambio>"
```

## Reglas

- **Nunca** correr `prisma migrate reset` en producción
- **Nunca** eliminar campos sin verificar que no hay referencias en el código
- Los cambios de schema siempre van en rama `db/<nombre>`
