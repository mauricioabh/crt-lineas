---
name: /fix
description: Diagnostica y corrige un bug de manera sistemática
category: workflow
---

# /fix — Corregir un bug

## 1. Entender el problema

- Leer el error completo o descripción del bug
- Identificar en qué capa ocurre: UI, API route, lib, monitoring pattern, DB

## 2. Reproducir

- Si es un error de runtime: leer los logs del servidor (`npm run dev`)
- Si es un error de tipado: correr `npx tsc --noEmit`
- Si es un error de lint: correr `npx eslint src/`

## 3. Localizar

- Buscar el archivo y línea exacta
- Leer el contexto completo antes de editar
- Verificar tipos Prisma si el error involucra la DB

## 4. Corregir

- Hacer el cambio mínimo necesario
- No refactorizar sin necesidad
- Verificar que no se rompen otros módulos que dependen del mismo código

## 5. Verificar

```powershell
npx tsc --noEmit
npx eslint src/
```

## 6. Commitear

```powershell
git add <archivo(s)>
git commit -m "fix(scope): descripción del bug corregido"
```
