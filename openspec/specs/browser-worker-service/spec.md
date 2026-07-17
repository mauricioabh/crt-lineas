# browser-worker-service Specification

## Purpose

TBD - created by archiving change extract-playwright-worker-hetzner. Update Purpose after archive.

## Requirements

### Requirement: Servicio worker de navegador independiente

El sistema SHALL proveer un servicio worker de navegador ejecutable como proceso Node persistente, desplegable en el VPS Hetzner de forma independiente del despliegue de Vercel, que ejecute Playwright/Chromium para el scraping del portal CRT y la verificación de líneas por CURP.

#### Scenario: El worker arranca y queda listo

- **WHEN** el worker se inicia con las variables de entorno requeridas (`DATABASE_URL`, claves de Inngest, `MONITOR_*`, `UPLOADTHING_TOKEN`)
- **THEN** el proceso queda escuchando trabajos y expone un endpoint de salud que responde `ok`

#### Scenario: Falta configuración requerida

- **WHEN** el worker arranca sin una variable de entorno obligatoria
- **THEN** el proceso falla de forma explícita en el arranque con un mensaje que nombra la variable faltante, en lugar de arrancar en estado degradado

### Requirement: Chromium nativo en el worker

El worker SHALL lanzar Chromium usando los navegadores instalados por Playwright (`playwright install`) y NO SHALL depender de `@sparticuz/chromium`, que es específico de entornos serverless.

#### Scenario: Lanzamiento de navegador en el worker

- **WHEN** una función del worker necesita un navegador
- **THEN** `launchChromium` lanza el Chromium nativo de Playwright en modo headless sin usar el binario de `@sparticuz/chromium`

### Requirement: Empaquetado y despliegue reproducible

El worker SHALL empaquetarse como imagen Docker (u equivalente reproducible) que incluya Chromium y sus dependencias del sistema, de modo que pueda desplegarse en Hetzner y reiniciarse sin intervención manual.

#### Scenario: Imagen incluye navegador y dependencias

- **WHEN** se construye la imagen del worker
- **THEN** la imagen contiene Chromium y las librerías del sistema necesarias, y un contenedor arranca ejecutando el worker

#### Scenario: Reinicio automático

- **WHEN** el proceso del worker termina de forma inesperada
- **THEN** el supervisor de despliegue (Docker restart policy, systemd o PM2) lo reinicia automáticamente

### Requirement: Reutilización de la lógica de patrones y verificación

El worker SHALL ejecutar la misma lógica de patrones de monitoreo (`src/monitoring/**`) y de verificación (`monitor-verify-link`, `monitor-bulk-verify-item`, `crt-ingest`) que la aplicación, evitando divergencia de comportamiento entre entornos.

#### Scenario: Un patrón nuevo queda disponible en el worker

- **WHEN** se agrega o modifica un patrón de monitoreo en la base de código compartida
- **THEN** el worker ejecuta ese patrón sin requerir una reimplementación separada
