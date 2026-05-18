---
name: /ship
description: Verifica, commitea y abre PR con los cambios actuales
category: workflow
---

# /ship — Verificar y publicar cambios

Sigue estos pasos en orden:

## 1. Verificar estado

```powershell
git status
git diff
```

Revisar qué archivos cambiaron. Si hay cambios no relacionados al objetivo, pregunta al usuario si deben incluirse.

## 2. Typecheck y lint

```powershell
npx tsc --noEmit
npx eslint src/
```

Corregir cualquier error antes de continuar.

## 3. Crear rama si no existe

```powershell
git checkout -b feat/<nombre-descriptivo>
```

Usar el tipo correcto: `feat/`, `fix/`, `db/`, `docs/`, `ci/`.

## 4. Stage y commit

```powershell
git add .
git commit -m "tipo(scope): descripción concisa"
```

Seguir Conventional Commits (ver `.cursor/rules/Convenciones-de-Git.mdc`).

## 5. Push y PR

```powershell
git push -u origin HEAD
```

Luego usar el MCP de GitHub para crear el PR hacia `dev`:

- Título: igual que el commit message
- Body: qué cambia y cómo probar
- Base: `dev`

## Notas

- No usar `&&` en PowerShell — usar `;`
- CI debe pasar antes del merge
- Si hay conflictos, resolverlos antes del push
