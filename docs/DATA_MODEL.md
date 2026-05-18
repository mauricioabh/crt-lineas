# Data Model — crt-lineas

## Entidades

### Company

Representa una empresa/operadora telefónica tal como aparece en el portal CRT.

| Campo       | Tipo            | Descripción                                     |
| ----------- | --------------- | ----------------------------------------------- |
| `id`        | `String` (cuid) | PK                                              |
| `name`      | `String`        | Nombre de la empresa (único)                    |
| `enabled`   | `Boolean`       | Si la empresa es visible para usuarios normales |
| `createdAt` | `DateTime`      | Fecha de creación                               |
| `updatedAt` | `DateTime`      | Fecha de última actualización                   |

**Relaciones**: 1 Company → N CompanyLinks (cascade delete)

### CompanyLink

Representa una URL específica dentro del portal CRT asociada a una empresa.

| Campo                     | Tipo            | Descripción                                                                    |
| ------------------------- | --------------- | ------------------------------------------------------------------------------ |
| `id`                      | `String` (cuid) | PK                                                                             |
| `companyId`               | `String`        | FK → Company.id                                                                |
| `url`                     | `String`        | URL de verificación en el portal CRT                                           |
| `label`                   | `String`        | Texto descriptivo del link                                                     |
| `hasVerificationProtocol` | `Boolean`       | Indica si existe flujo Playwright dedicado; se actualiza en `POST /api/ingest` |

**Índices**: `companyId`, `(companyId, url)` unique

### UserCompanyLinkResult

Resultado de verificación **por usuario × link**. Cada usuario tiene sus propios valores; lo que uno verifica no afecta a otros.

| Campo                     | Tipo            | Descripción                                                           |
| ------------------------- | --------------- | --------------------------------------------------------------------- |
| `id`                      | `String` (cuid) | PK                                                                    |
| `userId`                  | `String`        | ID de Clerk                                                           |
| `linkId`                  | `String`        | FK → CompanyLink                                                      |
| `hasActiveLines`          | `Boolean?`      | `true` = líneas activas, `false` = sin líneas, `null` = sin verificar |
| `isReviewed`              | `Boolean`       | Si fue revisado al menos una vez                                      |
| `isManualReview`          | `Boolean`       | Si el resultado fue marcado manualmente (captcha/ambiguo)             |
| `lastReviewedAt`          | `DateTime?`     | Timestamp de la última verificación                                   |
| `reviewNotes`             | `String?`       | Notas de la revisión                                                  |
| `reviewScreenshotAt`      | `DateTime?`     | Marca temporal cuando se guardó la captura PNG                        |
| `reviewScreenshotUtKey`   | `String?`       | URL CDN de UploadThing (pública) o `null` si solo en disco local      |
| `lastMonitorErrorAt`      | `DateTime?`     | Marca del último fallo de verificación automática                     |
| `lastMonitorErrorMessage` | `String?`       | Mensaje de error para el usuario                                      |
| `lastMonitorErrorDetail`  | `String?`       | Detalle técnico del fallo                                             |

**Índices**: `userId`, `linkId`, `(userId, linkId)` unique

### UserVerificationProfile

CURP y celular del usuario autenticado (Clerk `userId`), **cifrados en aplicación** (AES-256-GCM) antes de persistirse.

| Campo                     | Tipo            | Descripción                  |
| ------------------------- | --------------- | ---------------------------- |
| `id`                      | `String` (cuid) | PK                           |
| `userId`                  | `String`        | ID de Clerk (único)          |
| `curpEnc`                 | `String`        | CURP cifrada                 |
| `phoneEnc`                | `String`        | Celular (10 dígitos) cifrado |
| `privacyNoticeVersion`    | `String?`       | Versión del aviso aceptado   |
| `privacyNoticeAcceptedAt` | `DateTime?`     | Fecha/hora de aceptación     |
| `createdAt`               | `DateTime`      | Alta                         |
| `updatedAt`               | `DateTime`      | Última actualización         |

La API expone solo valores enmascarados (`XXXX********XXXX`). El descifrado ocurre solo en el servidor al ejecutar Playwright. Si la versión aceptada no coincide con la vigente, el usuario debe volver a aceptar el aviso en `/dashboard/setup`.

### MonitorVerificationLog

Historial de cada intento de verificación automática (`POST /api/monitor/:id` o ítem de `/api/monitor/bulk`).

| Campo               | Tipo            | Descripción                                                   |
| ------------------- | --------------- | ------------------------------------------------------------- |
| `id`                | `String` (cuid) | PK                                                            |
| `linkId`            | `String`        | FK → CompanyLink                                              |
| `userId`            | `String?`       | ID del usuario que corrió la verificación                     |
| `success`           | `Boolean`       | Si el patrón terminó sin lanzar excepción                     |
| `userFacingMessage` | `String`        | Resumen legible (error o notas de éxito)                      |
| `technicalDetail`   | `String?`       | Stack / mensaje técnico en fallos                             |
| `patternId`         | `String?`       | Id del patrón (`telcel`, `abib-com-mx-consulta-lineas`, etc.) |
| `batchId`           | `String?`       | Mismo UUID para todos los ítems de una corrida masiva         |
| `createdAt`         | `DateTime`      | Cuándo se registró el intento                                 |

## Relaciones

```
UserVerificationProfile (1 por usuario Clerk)
UserCompanyLinkResult   (1 por usuario × link)

Company
  └── CompanyLink[] (cascade delete)
        ├── MonitorVerificationLog[] (cascade delete)
        └── UserCompanyLinkResult[] (cascade delete)
```

## Estados de un UserCompanyLinkResult

```
hasActiveLines = null   → Sin verificar (estado inicial del usuario)
hasActiveLines = true   → Verificado: tiene líneas activas
hasActiveLines = false  → Verificado: sin líneas activas
isManualReview = true   → Requirió intervención manual (captcha, etc.)
```

## Fuente de datos

- **Companies + CompanyLinks** se crean vía el endpoint `/api/ingest` que scrapea el portal CRT. En cada upsert de link se recalcula `hasVerificationProtocol` según `linkSupportsAutomatedVerification(nombre, url)` en código.
- El ingest solo hace upsert: no borra compañías ni enlaces que ya no estén en el CRT. Para una base vacía antes de resincronizar (solo desarrollo), usar `npm run db:clear-companies`
- Tras `POST /api/monitor/:linkId`, si la captura se guarda bien, `reviewScreenshotAt` queda en la fila. Con `UPLOADTHING_TOKEN`, el PNG está en UploadThing y `reviewScreenshotUtKey` guarda el `fileKey`. Sin token, el archivo vive en `data/review-screenshots/` (ignorado por git). Las filas antiguas pueden tener solo marca temporal y archivo en disco.
- Si la verificación automática **falla**, se guardan `lastMonitorErrorAt` / `lastMonitorErrorMessage` / `lastMonitorErrorDetail` en el enlace y una fila en `MonitorVerificationLog` (`success: false`). Tras un run **exitoso**, esos campos del enlace se limpian y se añade un log con `success: true`.
- Los campos de revisión se actualizan vía `/api/monitor/:linkId` (automático) o `/api/company-links/:linkId` (manual), **siempre en la fila del usuario autenticado**

## Schema Prisma

Ver `prisma/schema.prisma` para la definición actualizada.
