# Aviso de privacidad — CRT Líneas

> Versión: 2026-05-18  
> Nota: este documento es una base operativa para el producto. Debe revisarse con asesoría legal antes de uso público o comercial.

## Responsable

CRT Líneas es responsable del tratamiento de los datos personales ingresados en esta herramienta.

Antes de operar en producción, completar:

- Razón social del responsable.
- Domicilio.
- Correo de contacto para privacidad y derechos ARCO.
- Medio oficial para recibir solicitudes.

## Datos personales tratados

Para habilitar la verificación de líneas, la aplicación solicita:

- CURP.
- Número celular a 10 dígitos.
- Fecha y versión del aviso de privacidad aceptado.

La aplicación no debe solicitar documentos oficiales ni datos adicionales si no son necesarios para la verificación.

## Finalidades

Los datos se usan únicamente para:

- Consultar portales de operadoras telefónicas a petición del usuario.
- Determinar si existen líneas asociadas o procesos de vinculación relacionados con el CURP o celular proporcionado.
- Mostrar el estado de verificación dentro del dashboard.
- Registrar evidencia técnica del intento de verificación, sin guardar CURP ni celular en logs.

## Base de consentimiento

Antes de guardar CURP y celular, el usuario debe aceptar este aviso de privacidad desde `/dashboard/setup`.

La aceptación queda registrada con:

- `privacyNoticeVersion`.
- `privacyNoticeAcceptedAt`.

## Seguridad

CURP y celular se cifran en la aplicación antes de guardarse en Neon/PostgreSQL usando AES-256-GCM.

La clave de cifrado vive en el entorno del servidor (`VERIFICATION_CREDENTIALS_ENCRYPTION_KEY`) y no debe guardarse en el repositorio. La base de datos almacena únicamente `curpEnc` y `phoneEnc`.

El servidor descifra los datos solo temporalmente para ejecutar la verificación solicitada por el usuario autenticado.

## Transferencias

Los datos no se venden ni se comparten con fines publicitarios.

Durante una verificación, CURP o celular pueden enviarse al portal de la operadora correspondiente, porque ese envío es necesario para realizar la consulta solicitada por el usuario.

## Conservación

Los datos se conservan mientras la cuenta necesite usar la verificación de líneas.

Si el usuario solicita cancelación o eliminación, se debe borrar su `UserVerificationProfile`, salvo que exista una obligación legal de conservar algún registro.

La app incluye `DELETE /api/me/verification-profile` para que el usuario autenticado elimine su CURP y celular cifrados.

## Derechos ARCO

El titular puede solicitar:

- Acceso.
- Rectificación.
- Cancelación.
- Oposición.

El responsable debe definir y publicar el canal para recibir estas solicitudes.

## Cambios al aviso

Si cambia la finalidad, los datos tratados, las transferencias o medidas relevantes, debe actualizarse la versión del aviso y solicitar una nueva aceptación cuando corresponda.

## Límites operativos

El cifrado protege los datos ante filtraciones de base de datos. El administrador del servidor con acceso a la base y a la clave de cifrado podría descifrarlos técnicamente, por lo que el acceso a infraestructura debe limitarse a personal autorizado.
