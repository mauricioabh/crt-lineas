---
linear_story_id: "WAY-74"
linear_story_identifier: "WAY-74"
linear_story_title: "[CRT] Última revisión muestra hora del servidor en vez de hora local del usuario"
linear_story_url: "https://linear.app/wayool/issue/WAY-74/crt-ultima-revision-muestra-hora-del-servidor-en-vez-de-hora-local-del"
linear_story_state: "Todo"
linear_team: "Wayool"
linear_project: "crt-lineas"
---

## Why

La columna "Última revisión" del dashboard muestra la fecha/hora en la zona horaria del servidor (VPS Hetzner, UTC) en lugar de la hora local del usuario. El HTML se genera en SSR con la TZ del servidor y el `suppressHydrationWarning` existente hace que React conserve ese texto tras la hidratación, por lo que el usuario ve una hora incorrecta (p. ej. "18/7 12:59 a.m." para una revisión hecha el 17/7 a las 18:59 UTC-6).

Detalles de negocio: ver [WAY-74](https://linear.app/wayool/issue/WAY-74/crt-ultima-revision-muestra-hora-del-servidor-en-vez-de-hora-local-del).

## What Changes

- Las fechas de "Última revisión" (celda y tooltip `title`) se formatean únicamente en el cliente, después del mount, usando la zona horaria del navegador del usuario.
- Durante SSR y antes del mount se muestra un placeholder neutro ("—"), nunca la hora del servidor.
- El almacenamiento no cambia: `lastReviewedAt` sigue guardándose en UTC (Prisma `DateTime`) y serializándose con `toISOString()`.

## Capabilities

### New Capabilities

- `dashboard-datetime-display`: presentación de fechas/horas en el dashboard — las marcas temporales almacenadas en UTC se muestran al usuario en su zona horaria local.

### Modified Capabilities

<!-- Ninguna: remote-job-orchestration y browser-worker-service no cubren la presentación del dashboard. -->

## Impact

- `src/components/companies-table.tsx`: función `formatReviewedAt`, celda "Última revisión" y su `title` (únicas ocurrencias de `toLocaleString` en el código).
- Sin cambios de schema, API, ni variables de entorno.
- Documentación: no aplica ninguna tabla de docs (no hay cambio de schema, env, rutas ni patrones); no se requiere actualización.
