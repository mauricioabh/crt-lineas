## 1. Formateo client-only en companies-table

- [x] 1.1 Agregar flag `mounted` (o componente `LocalDateTime`) en `src/components/companies-table.tsx` que renderice "—" hasta que el cliente monte
- [x] 1.2 Usar `formatReviewedAt` solo después del mount para la celda "Última revisión" (hora local del navegador)
- [x] 1.3 Aplicar el mismo tratamiento al `title` del tooltip de la celda (omitirlo o poblarlo solo tras el mount)
- [x] 1.4 Quitar `suppressHydrationWarning` del span de la celda

## 2. Verificación

- [x] 2.1 Correr `npm run build` (o `npx tsc --noEmit` + lint) sin errores
- [x] 2.2 Verificar en el navegador que la fecha mostrada corresponde a la TZ local y que no hay warnings de hydration en consola
- [x] 2.3 Verificar que el ordenamiento por "Última revisión" sigue funcionando
- [x] 2.4 Correr `openspec validate fix-reviewed-at-local-timezone --strict`
