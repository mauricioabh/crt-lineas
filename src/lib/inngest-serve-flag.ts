/**
 * Flag de coexistencia (post-cutover).
 *
 * El worker Hetzner es el ejecutor único de las funciones de navegador, así que
 * por defecto `/api/inngest` en Vercel **no** las sirve (`false`). Vercel ya no
 * puede ejecutar Chromium (se retiró `@sparticuz/chromium` y su config).
 *
 * Rollback: poner `INNGEST_SERVE_BROWSER_ON_VERCEL=1` reactiva el serve en
 * Vercel, pero requiere restaurar `@sparticuz/chromium` y su config en
 * `next.config.ts`/`vercel.json`.
 */
export function shouldServeBrowserFunctionsOnVercel(): boolean {
  const raw = process.env.INNGEST_SERVE_BROWSER_ON_VERCEL?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
