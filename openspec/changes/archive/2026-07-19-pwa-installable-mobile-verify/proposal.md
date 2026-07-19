---
linear_story_id: WAY-75
linear_story_identifier: WAY-75
linear_story_title: "[CRT] PWA instalable y verificación individual en móvil"
linear_story_url: https://linear.app/wayool/issue/WAY-75/crt-pwa-instalable-y-verificacion-individual-en-movil
linear_story_state: Todo
linear_team: Wayool
linear_project: crt-lineas
---

## Why

El dashboard es usable en desktop, pero en móvil la tabla ancha dificulta el flujo operativo más crítico (verificar un enlace). Además, no hay forma de instalar la app en el teléfono. Necesitamos una PWA instalable (sin offline) y una UX móvil centrada en verificación individual.

## What Changes

- Hacer la web app **instalable** como PWA: web app manifest, iconos (192/512 + maskable), metadata (`themeColor`, `appleWebApp`, etc.).
- **No** agregar service worker ni comportamiento offline en v1.
- En viewports móviles (`< md`): reemplazar la tabla densa por una **lista/cards** con búsqueda/filtros compactos.
- Al tocar una fila: abrir un **sheet/detalle** con estado del enlace y acción primaria **Verificar** (mismo `POST /api/monitor/:linkId`).
- En desktop (`≥ md`): conservar la tabla actual (bulk, columnas, admin).
- En móvil: ocultar o degradar bulk verify / controles densos de admin que no quepan bien (sin rediseñar ingest).

## Capabilities

### New Capabilities

- `pwa-installability`: Criterios para que la app sea instalable (manifest, iconos, display standalone) sin offline.
- `mobile-dashboard-verify`: Vista móvil del dashboard (lista + detalle) con verificación individual como flujo principal.

### Modified Capabilities

- (ninguna — no hay specs canónicos previos de dashboard UI / PWA)

## Impact

- `src/app/layout.tsx` / `src/lib/seo/metadata.ts` — metadata PWA
- `public/` — iconos y posiblemente `manifest.webmanifest`
- `src/components/companies-table.tsx` (y/o extracción de subcomponentes) — layout responsive lista/sheet vs tabla
- Docs: `docs/TECH_STACK.md` (PWA), `README.md` si hay notas de uso móvil; sin cambios de API contract
- Dependencias: ninguna obligatoria (manifest nativo de Next / estático); sin `next-pwa` / Serwist en v1
- Linear: [WAY-75](https://linear.app/wayool/issue/WAY-75/crt-pwa-instalable-y-verificacion-individual-en-movil)
