# dashboard-datetime-display

## Purpose

Presentación de fechas/horas en el dashboard: las marcas temporales almacenadas en UTC se muestran al usuario en su zona horaria local.

## Requirements

### Requirement: Las fechas de última revisión se muestran en la zona horaria local del usuario

El dashboard SHALL mostrar la fecha/hora de `lastReviewedAt` en la columna "Última revisión" (celda y tooltip `title`) convertida a la zona horaria del navegador del usuario. El valor SHALL provenir del ISO string UTC serializado por el servidor; el formateo a hora local MUST ejecutarse exclusivamente en el cliente, después del mount.

#### Scenario: Usuario en UTC-6 ve una revisión hecha a las 18:59 hora local

- **WHEN** una revisión se guardó a las 2026-07-18T00:59:00Z y el navegador del usuario está en America/Mexico_City (UTC-6)
- **THEN** la celda "Última revisión" muestra 17/7/2026 06:59 p.m. (formato `es-MX`)

#### Scenario: Tooltip con fecha completa en hora local

- **WHEN** el usuario pasa el cursor sobre la celda "Última revisión"
- **THEN** el atributo `title` muestra la fecha/hora completa en la zona horaria del navegador del usuario

### Requirement: El render del servidor no expone la hora del servidor

Durante SSR y antes del mount en el cliente, la celda "Última revisión" SHALL mostrar un placeholder neutro ("—") en lugar de una fecha formateada. El sistema MUST NOT renderizar fechas formateadas con la zona horaria del servidor, y la hidratación MUST NOT producir warnings ni errores de mismatch en consola.

#### Scenario: HTML inicial sin hora del servidor

- **WHEN** la página del dashboard se renderiza en el servidor (VPS en UTC)
- **THEN** el HTML inicial de la columna "Última revisión" contiene el placeholder "—" y no una fecha formateada

#### Scenario: Hidratación sin warnings

- **WHEN** el cliente hidrata la tabla y reemplaza el placeholder por la fecha local
- **THEN** la consola del navegador no muestra warnings ni errores de hydration mismatch

### Requirement: El almacenamiento de fechas permanece en UTC

El sistema SHALL seguir guardando `lastReviewedAt` como `DateTime` UTC en la base de datos y serializándolo al cliente como ISO string UTC (`toISOString()`). La conversión a zona horaria local SHALL ocurrir únicamente en la capa de presentación.

#### Scenario: Escritura de revisión no cambia

- **WHEN** una verificación (manual o automática) actualiza una `CompanyLink`
- **THEN** `lastReviewedAt` se persiste como timestamp UTC, igual que antes del cambio
