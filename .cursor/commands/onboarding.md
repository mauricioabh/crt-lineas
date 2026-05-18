---
name: /onboarding
description: Setup inicial del proyecto para un nuevo desarrollador
category: setup
---

# /onboarding — Setup inicial

## 1. Clonar y dependencias

```powershell
git clone https://github.com/mauricioabh/crt-lineas.git
Set-Location crt-lineas
npm install
```

## 2. Variables de entorno

```powershell
Copy-Item .env.example .env.local
```

Completar en `.env.local`:

- `DATABASE_URL` — obtener de Neon dashboard
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY` — obtener de Clerk dashboard
- `MONITOR_CURP` — CURP para pruebas de verificación (opcional)

Ver `docs/ENV.md` para descripción completa de cada variable.

## 3. Base de datos

```powershell
$env:DATABASE_URL="postgresql://..."; npx prisma db push
npx prisma generate
```

## 4. Configurar rol admin en Clerk

1. Ir a [dashboard.clerk.com](https://dashboard.clerk.com)
2. Seleccionar el proyecto
3. Ir a Users → seleccionar tu usuario
4. Editar Public Metadata: `{ "role": "admin" }`

Sin esto, el botón "Sincronizar desde CRT" no aparece en el dashboard.

## 5. Correr en desarrollo

```powershell
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000) — redirige a sign-in.

## 6. Primera sincronización

Una vez autenticado como admin:

- Ir al dashboard
- Click en "Sincronizar desde CRT" — esto corre el ingest con Playwright
- El browser de Playwright se abrirá (si `PLAYWRIGHT_HEADED=true`)

## Referencias

- `docs/PRD.md` — Producto y objetivo
- `docs/TECH_STACK.md` — Stack tecnológico
- `docs/CONTRIBUTING.md` — Flujo de contribución
- `docs/ENV.md` — Variables de entorno
