# remote-job-orchestration Specification

## Purpose

TBD - created by archiving change extract-playwright-worker-hetzner. Update Purpose after archive.

## Requirements

### Requirement: Despacho de trabajo de navegador vía Inngest

La aplicación de Vercel SHALL delegar todo el trabajo de navegador (scraping de ingest, verificación single y verificación bulk) despachando eventos de Inngest, y NO SHALL lanzar Chromium dentro de funciones serverless de Vercel.

#### Scenario: Ingest se despacha, no se ejecuta en Vercel

- **WHEN** un admin invoca `POST /api/ingest`
- **THEN** la ruta encola un evento de scraping en Inngest y responde con un identificador de trabajo, sin lanzar Chromium en Vercel

#### Scenario: Verificación single se despacha

- **WHEN** un usuario invoca `POST /api/monitor/[linkId]`
- **THEN** la ruta encola un evento de verificación para ese link y expone el resultado cuando el worker lo completa, sin lanzar Chromium en Vercel

#### Scenario: Verificación bulk se despacha

- **WHEN** un usuario invoca `POST /api/monitor/bulk` con una lista de links
- **THEN** la ruta crea el `MonitorBulkJob`, encola el fan-out en Inngest y transmite el progreso desde la base de datos, sin lanzar Chromium en Vercel

### Requirement: El worker Hetzner consume las funciones de navegador

El worker SHALL registrarse ante Inngest como la app que sirve las funciones de navegador (scraping y verificación), de modo que los eventos despachados por Vercel se ejecuten en Hetzner.

#### Scenario: Evento consumido por el worker

- **WHEN** Vercel despacha un evento de navegador y el worker está en línea y registrado
- **THEN** Inngest entrega el evento al worker Hetzner, que ejecuta la función correspondiente con Playwright

#### Scenario: Worker fuera de línea

- **WHEN** Vercel despacha un evento de navegador pero el worker no está disponible
- **THEN** Inngest retiene/reintenta el trabajo según su política y el estado del job permanece pendiente sin ejecutarse en Vercel

### Requirement: Estado y resultado persistidos y observables

El resultado de cada trabajo de navegador SHALL persistirse en la base de datos (por ejemplo `MonitorBulkJob`/items y el estado del link) y la UI SHALL poder observar progreso y resultado mediante streaming SSE o polling contra esa persistencia.

#### Scenario: Progreso de bulk visible en la UI

- **WHEN** el worker completa cada item de un `MonitorBulkJob`
- **THEN** la actualización se persiste y el stream SSE de la ruta bulk emite el progreso al cliente

#### Scenario: Reconexión del cliente

- **WHEN** el cliente pierde la conexión SSE y vuelve a consultar el estado del job
- **THEN** obtiene el estado actual desde la base de datos sin perder resultados ya completados por el worker

### Requirement: Autenticación entre Vercel e Inngest/worker

El despacho y la ejecución de trabajos SHALL autenticarse mediante las claves de Inngest (`INNGEST_EVENT_KEY` para envío y `INNGEST_SIGNING_KEY` para el registro/serve del worker), compartidas entre Vercel y el worker.

#### Scenario: Firma inválida

- **WHEN** una petición al endpoint serve del worker no está correctamente firmada por Inngest
- **THEN** el worker la rechaza y no ejecuta ningún trabajo de navegador
