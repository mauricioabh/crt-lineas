# Fases de desarrollo — crt-lineas

## Fase 0 — Infraestructura ✅ (Completada)

- [x] Setup Next.js 16 + TypeScript + Tailwind v4
- [x] Clerk: autenticación, roles, middleware
- [x] Prisma + Neon: schema `Company` + `CompanyLink`, DB push
- [x] Dashboard: tabla con empresas y links, role-based visibility
- [x] API `/ingest`: scraping CRT con Playwright
- [x] API `/monitor/:linkId`: verificación por CURP
- [x] API `/companies` y `/company-links`: CRUD básico
- [x] Sistema de patrones: `base-pattern.ts` + registro en `index.ts`
- [x] Patrones: `generic`, `telcel` (alias generic), `movistar` (alias generic)
- [x] Repo en GitHub + CI/CD + guardrails de AI
- [x] NeonDB schema aplicado

## Fase 1 — Verificación y flujo completo (Actual)

**Objetivo**: Confirmar que el flujo end-to-end funciona en desarrollo.

- [ ] Correr `npm run dev` y verificar que el app levanta sin errores
- [ ] Autenticarse con Clerk y verificar redirección al dashboard
- [ ] Configurar `publicMetadata.role = "admin"` en Clerk dashboard para el usuario principal
- [ ] Correr ingest desde el dashboard (requiere `MONITOR_CURP` y Playwright headed)
- [ ] Verificar que los datos de CRT aparecen en la tabla
- [ ] Probar el botón "Verificar" en al menos un link
- [ ] Confirmar que el estado se persiste en la DB

## Fase 2 — Deployment en producción

**Objetivo**: Hacer el app accesible en producción con Playwright funcional.

**Estrategia elegida: Opción B — Vercel + worker externo (Hetzner) vía Inngest** (ver `openspec/changes/extract-playwright-worker-hetzner`).

### Opción A: Railway / Render / Fly.io

- Desplegar la app completa en un servidor Node persistente
- Playwright corre sin restricciones (no serverless)
- Costo: ~$5-20/mes según el proveedor

### ✅ Opción B: Vercel + worker externo (ELEGIDA)

- App en Vercel (UI/auth/API ligera); el worker Playwright/Chromium corre en el VPS Hetzner.
- **Inngest** es el transporte único: Vercel encola eventos (`ingest/scrape.requested`, `monitor/bulk.started`) y el worker los consume vía **Inngest Connect** (no webhooks HTTP ad-hoc).
- Código compartido en `worker/` (importa `src/` con alias `@/`), sin divergencia de patrones.
- Cutover pendiente: retirar `@sparticuz/chromium` + config de `vercel.json`/`next.config.ts` y poner `INNGEST_SERVE_BROWSER_ON_VERCEL=0` tras desplegar el worker.

### Opción C: `@sparticuz/chromium`

- Chromium pre-empaquetado para Lambda/Edge
- Permite seguir en Vercel serverless
- Limitaciones en headed mode y extensiones

**Tareas de esta fase:**

- [ ] Elegir estrategia de deployment
- [ ] Configurar variables de entorno en producción
- [ ] Setup de Clerk production instance
- [ ] Crear Neon proyecto production (o usar branch)
- [ ] Pipeline de CI/CD hacia producción
- [ ] Verificar que `PLAYWRIGHT_HEADED=false` funciona en headless mode

## Fase 3 — Patrones específicos de operadora

**Objetivo**: Implementar flujos de verificación reales para cada operadora.

- [ ] Mapear el flujo de verificación de Telcel (selectores, formularios, captchas)
- [ ] Implementar `telcel.ts` con selectores reales
- [ ] Mapear el flujo de Movistar
- [ ] Implementar `movistar.ts` con selectores reales
- [ ] Para operadoras con captcha: integrar servicio de resolución (2captcha, etc.) o estrategia manual
- [ ] Agregar más patrones según las empresas que aparezcan en el ingest
- [ ] Documentar cada patrón en `docs/MONITORING_PATTERNS.md`

## Fase 4 — Tests automatizados

**Objetivo**: Cobertura básica para evitar regresiones.

- [ ] Setup Vitest para tests unitarios
- [ ] Test unitario de `inferFromBodyText` en `generic.ts`
- [ ] Tests de las funciones en `src/lib/auth.ts`
- [ ] Setup Playwright spec para E2E:
  - [ ] Redirige a `/sign-in` sin autenticación
  - [ ] Dashboard carga después de login
  - [ ] El toggle de empresa funciona (admin)
- [ ] Agregar job `e2e` a `.github/workflows/`
- [ ] Coverage mínimo: 70% en `src/lib/` y `src/monitoring/`

## Fase 5 — Automatización y notificaciones

**Objetivo**: Reducir trabajo manual con checks periódicos.

- [ ] Cron job para re-verificar links automáticamente (cada 24-48h)
- [ ] Sistema de notificaciones cuando cambia el estado de una línea
  - Email via Resend, o
  - Webhook a Slack/Teams
- [ ] Dashboard de historial: ver cómo ha cambiado el estado a lo largo del tiempo
- [ ] Tabla `ReviewHistory` para auditoría de cambios
- [ ] Bulk actions: verificar todos los links de una empresa de una vez

## Fase 6 — Multi-usuario y organización

**Objetivo**: Soporte para múltiples empresas clientes.

- [ ] Clerk Organizations para multi-tenant
- [ ] Cada organización tiene su propio conjunto de empresas/links
- [ ] Roles por organización (admin de org vs admin global)
- [ ] Billing por organización (Stripe)
