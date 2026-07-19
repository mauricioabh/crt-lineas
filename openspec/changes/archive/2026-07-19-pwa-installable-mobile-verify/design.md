## Context

crt-lineas es una herramienta interna (Clerk + Next.js 16 App Router) cuyo dashboard principal es `companies-table.tsx`: una tabla densa con muchas columnas, bulk verify, filtros y toggle de columnas. No hay manifest, service worker ni iconos PWA. El proxy de Clerk ya excluye `.webmanifest` del matcher.

El flujo de verificación individual ya existe (`POST /api/monitor/:linkId` desde el botón «Verificar»). El problema en móvil es de presentación, no de backend.

Stakeholders: operadores que necesitan verificar en el teléfono; admins que siguen trabajando en desktop.

## Goals / Non-Goals

**Goals:**

- App instalable (Add to Home Screen / Install) en Android/Chrome y usable como atajo en iOS Safari.
- En viewport `< md`, lista usable + detalle con verificación individual.
- Desktop sin regresiones en tabla, bulk ni admin.

**Non-Goals:**

- Service worker, cache offline, background sync o colas offline.
- Bulk verify / ingest rediseñados para móvil.
- Cambios de API, schema Prisma o auth.
- Dependencias tipo `next-pwa` / Serwist en v1.

## Decisions

### 1. PWA lite sin service worker

- **Choice:** Manifest estático (o Metadata `manifest` de Next) + iconos 192/512 (idealmente maskable) + `display: "standalone"` + `themeColor` / `appleWebApp`.
- **Why:** Chrome/Edge ya no exigen SW para instalabilidad; el producto no aporta valor offline (Clerk + APIs + jobs remotas).
- **Alternatives:** Serwist/`next-pwa` con SW mínimo → más complejidad y superficie de bugs de cache auth sin beneficio claro en v1.

### 2. Responsive dual UI, no “tabla con scroll” como UX primaria móvil

- **Choice:** Breakpoint Tailwind `md`: debajo → lista de filas compactas; encima → tabla actual.
- **Why:** Ya acordado en discovery; el toggle de columnas no salva un spreadsheet en 360px.
- **Alternatives:** Solo ocultar columnas por defecto en móvil → más barato, peor UX. Master–detail por compañía → más navegación de la necesaria para v1.

### 3. Detalle en sheet/drawer reutilizando la lógica de `runCheck`

- **Choice:** Al tocar una fila móvil, abrir panel (sheet) con compañía, badges de estado, URL/sitio, error si hay, y CTA **Verificar** llamando la misma función/`fetch` que la tabla.
- **Why:** Un solo camino de verificación; menos duplicación de reglas (`enabled`, `verificationStatus === "yes"`).
- **Alternatives:** Navegar a ruta `/dashboard/links/[id]` → más routing y estado SSR; sobrekill para v1.

### 4. Compartir data/filtros; ocultar bulk en móvil

- **Choice:** Misma fuente de filas filtradas/ordenadas; toolbar móvil con búsqueda + filtros compactos; selección masiva y botón bulk ocultos o no prominentes bajo `md`.
- **Why:** Verificación individual es el MVP móvil; bulk es workflow desktop.
- **Alternatives:** Portar bulk completo a móvil → scope creep.

### 5. Estructura de código

- **Choice:** Extraer subcomponentes (lista móvil, sheet de detalle, quizá toolbar) desde `companies-table.tsx` sin reescribir el data layer; evitar un segundo fetch.
- **Why:** El archivo ya es grande; extracción enfocada mantiene un solo estado de filtros/check.
- **Alternatives:** Página móvil separada → divergencia de estado y bugs de “dos verdades”.

## Risks / Trade-offs

- **[iOS install UX]** → Documentar “Añadir a pantalla de inicio”; no hay prompt nativo como Android.
- **[Hydration / breakpoint]** → Usar CSS (`md:hidden` / `hidden md:block`) o `matchMedia` con cuidado para no flash incorrecto; preferir CSS split cuando baste.
- **[Tabla 2k+ líneas]** → Extracción incremental; riesgo de regresiones desktop → checklist manual + typecheck/lint.
- **[Iconos de calidad]** → Placeholder aceptable para v1; maskable puede necesitar padding; no bloquear por branding perfecto.
- **[Auth en standalone]** → Clerk en PWA instalada debe seguir funcionando; probar sign-in redirect en standalone (smoke manual).

## Migration Plan

1. Merge a `dev` vía PR; deploy Vercel (HTTPS ya cubierto).
2. Verificar instalabilidad en Chrome DevTools → Application → Manifest / Installability.
3. Smoke móvil: buscar → abrir → Verificar en un link `auto=yes`.
4. Rollback: revertir PR; sin migraciones DB.

## Open Questions

- ¿Usar componente Sheet de shadcn/base-ui ya en el repo o un drawer mínimo custom? (resolver en implement si no hay Sheet listo).
- ¿Iconos: generar desde un logo existente o SVG simple “CRT”? (default: iconos simples generados en `public/icons/`).
