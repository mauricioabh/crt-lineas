## Context

`lastReviewedAt` se guarda correctamente en UTC (Prisma `DateTime`) y llega al cliente como ISO string vía `toISOString()` en `src/app/(dashboard)/dashboard/page.tsx`. El problema está en la presentación: `companies-table.tsx` (client component) formatea con `toLocaleString("es-MX")` sin `timeZone`, por lo que el SSR produce la fecha con la TZ del VPS (UTC). El `<span suppressHydrationWarning>` que envuelve la celda hace que React conserve el texto del servidor tras la hidratación, así que la hora del servidor queda visible de forma permanente.

Se eligió la opción "formatear solo en cliente" (hora local de cada usuario) frente a fijar `timeZone: "America/Mexico_City"`, según decisión del usuario en WAY-74.

## Goals / Non-Goals

**Goals:**

- Mostrar "Última revisión" (celda y tooltip) en la zona horaria del navegador del usuario.
- Eliminar la dependencia de la TZ del servidor en el HTML renderizado.
- Sin warnings de hydration.

**Non-Goals:**

- Cambiar cómo se guardan o serializan las fechas (siguen en UTC).
- Preferencias de zona horaria por usuario.
- Tocar otras fechas de la app (no existen otros `toLocaleString` en `src/`).

## Decisions

1. **Formateo client-only tras el mount** — introducir un flag `mounted` (`useState(false)` + `useEffect(() => setMounted(true), [])`) o un componente pequeño `LocalDateTime` dentro de `companies-table.tsx`. Antes del mount se renderiza "—"; después, `formatReviewedAt` con la TZ del navegador.
   - _Alternativa descartada:_ `timeZone` fijo en el formateador — determinista y sin parpadeo, pero no muestra la hora local real de cada usuario (requisito elegido).
   - _Alternativa descartada:_ cambiar la TZ del VPS — frágil y no resuelve usuarios en otras zonas.
2. **Quitar `suppressHydrationWarning`** — deja de ser necesario porque servidor y cliente renderizan el mismo placeholder "—" en el primer paint; mantenerlo ocultaría regresiones.
3. **Aplicar el mismo tratamiento al `title` del tooltip** (línea ~2129), que tiene el mismo `toLocaleString` sin zona.
4. **Mantener `formatReviewedAt` como única función de formato** para no duplicar opciones de `Intl`.

## Risks / Trade-offs

- [Parpadeo "—" → fecha en el primer render del cliente] → aceptable; es el patrón estándar para timestamps locales en Next.js y dura un frame tras la hidratación.
- [El sort por `reviewedAt` usa `getTime()` sobre el ISO UTC] → no se ve afectado; el orden es independiente de la TZ de presentación.
- [Regresión si alguien reintroduce formateo en SSR] → el requirement "HTML inicial sin hora del servidor" queda especificado y es verificable.
