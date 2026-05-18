# PRD — crt-lineas

> Fuente de verdad del producto. Última actualización: Mayo 2026.

## Problema

Las empresas que gestionan líneas de telefonía (Telcel, Movistar, AT&T, etc.) necesitan verificar periódicamente si sus números siguen activos en el portal de la CRT (Comisión de Regulación de Telecomunicaciones). Este proceso es manual, repetitivo y propenso a errores cuando se hace a escala.

## Usuarios objetivo

- Administradores internos que gestionan portafolios de líneas telefónicas
- Equipos operativos que necesitan saber el estado de activación de líneas por empresa

## MVP — Alcance actual

### Funcionalidades implementadas

1. **Autenticación** — Clerk con roles `admin` / `user`
2. **Dashboard** — tabla de empresas con sus URLs de verificación y estado
3. **Ingest CRT** — scraping del portal CRT con Playwright para poblar la DB con empresas y links (solo admin)
4. **Verificación de línea** — flujo Playwright por CURP para cada link de empresa
5. **Estado de revisión** — registro manual de si la línea tiene actividad, está en revisión manual, etc.
6. **Toggle de empresa** — admins pueden deshabilitar empresas para que no aparezcan a usuarios normales
7. **Sistema de patrones** — arquitectura extensible de `CompanyPattern` para operadoras específicas

### Stack

- Next.js 16 (App Router) + TypeScript
- Clerk (auth)
- Prisma 6 + Neon (PostgreSQL)
- Playwright (scraping + verificación)
- Tailwind v4 + shadcn/base-ui
- Vercel (deploy target)

## Criterios de éxito MVP

- Un admin puede sincronizar empresas desde CRT en < 5 minutos
- Un usuario puede verificar el estado de una línea para cualquier empresa habilitada
- El estado de revisión queda persistido y visible en el dashboard para todos los usuarios

## Riesgos y limitaciones conocidas

- **Playwright en producción**: Serverless/Edge no puede correr un browser. Ver `docs/PHASES.md` — Fase 2 para la estrategia de resolución.
- **Patrones específicos**: Telcel y Movistar usan el patrón genérico. Las operadoras con flujos diferentes (captchas, formularios especiales) requieren implementación dedicada.
- **Dependencia del portal CRT**: Si el portal cambia su estructura, el ingest y los patrones de verificación fallarán.

## Glosario

- **CRT**: Portal de verificación de líneas (México)
- **CompanyLink**: URL específica de una empresa dentro del portal CRT
- **Ingest**: Proceso de scraping del portal CRT para descubrir empresas y links
- **Pattern**: Implementación específica del flujo de verificación por operadora
- **CURP**: Clave Única de Registro de Población — usada para verificar titularidad de líneas
