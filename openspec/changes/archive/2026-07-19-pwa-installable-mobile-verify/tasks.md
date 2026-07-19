## 1. PWA installability

- [x] 1.1 Add install icons under `public/icons/` (192px, 512px; prefer maskable-safe padding)
- [x] 1.2 Add web app manifest (`public/manifest.webmanifest` or Next Metadata `manifest`) with `name`/`short_name`, `start_url`, `display: standalone`, icons, and theme color
- [x] 1.3 Extend `rootLayoutMetadata` / root layout with `themeColor`, Apple web app metadata, and manifest link
- [x] 1.4 Confirm Clerk `proxy.ts` matcher still allows serving the manifest without auth interference

## 2. Mobile list + detail (verify individual)

- [x] 2.1 Split viewport: show list/cards below `md`, keep existing table at `md+` (prefer CSS visibility split; share filtered/sorted rows)
- [x] 2.2 Build compact mobile list row (company name + key status badges; tap opens detail)
- [x] 2.3 Add mobile detail sheet/drawer with context + primary **Verificar** wired to existing `runCheck` / `POST /api/monitor/:linkId` (same eligibility rules as desktop)
- [x] 2.4 Mobile toolbar: search + compact filters; hide or de-emphasize bulk multi-select verify below `md`
- [x] 2.5 Extract focused subcomponents from `companies-table.tsx` as needed to keep desktop behavior unchanged

## 3. Docs and verification

- [x] 3.1 Update `docs/TECH_STACK.md` (and README notes if useful) to document installable PWA without offline
- [x] 3.2 Run `npm run typecheck` and `npm run lint`
- [x] 3.3 Manual smoke: Chrome installability / standalone; mobile viewport search → detail → Verify on an eligible link; desktop table + bulk still work
- [x] 3.4 Run `openspec validate pwa-installable-mobile-verify --strict`
