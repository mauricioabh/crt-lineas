# Monitoring Patterns — crt-lineas

Los patrones de monitoreo definen cómo se verifica el estado de líneas en el portal de cada operadora.

## Arquitectura

```
src/monitoring/
  base-pattern.ts       — tipos: MonitorResult, MonitorRunContext, CompanyPattern
  index.ts              — registro de patrones, getPattern(companyName, url)
  patterns/
    freedompop-biometric-my-lines.ts — vinculatulinea.com/Chedrauimovil, …/Freedompop (hub), …/freedompop/welcome o …/my-lines
    abib-bienestar-consulta-linea.ts — abibinternetdelbienestar.mx/consultatulinea o …/vinculatulinea
    abib-mx-vinculatulinea.ts          — www.abib.mx/vinculatulinea
    abib-com-mx-consulta-lineas.ts   — abib.com.mx (cualquier URL del host; flujo SPA consulta líneas)
    allce-buscar-vinculacion.ts      — vinculacion.allce.mx (buscar vinculación)
    celfi-buscar-vinculacion.ts     — vinculacion.celfi.com.mx (buscar vinculación)
    dalefon-vinculatulinea.ts       — dalefon.mx o internetbienestarmex.com + /vinculatulinea (consulta por CURP)
    altan-rnu.ts        — rnu.altanredes.com/.../vinculatulinea (CURP + teléfono) y `/consulta` (solo CURP + términos + Buscar)
    diri-movil-registro-lineas.ts — diri.mx/registrolineas → clic «Consultar líneas registradas» → mismo flujo que Altán `/consulta`
    exis-vinculatulinea.ts   — exis.mx + `#/vinculatulinea` (SPA: ciudadano mexicano → número → continuar)
    infynit-vinculate.ts    — vinculate.infynit.mx (10 dígitos + Consultar)
    megamovil-consulta-vinculacion.ts — registro.megamovil.mx/vinculatulinea/ → consultavinculacion.megamovil.mx (CURP + checkbox + Consultar)
    generic.ts          — patrón genérico (fallback)
    telcel.ts           — patrón Telcel (actualmente alias de generic)
    movistar.ts         — patrón Movistar (actualmente alias de generic)
```

## Capturas de verificación (PNG)

Tras un `POST /api/monitor/:linkId` **exitoso con patrón automatizado** (`supportsAutomatedVerification: true`), el servidor intenta `page.screenshot()` y guarda la captura: si existe `UPLOADTHING_TOKEN`, sube un PNG **privado** con UploadThing y persiste el `fileKey` en `reviewScreenshotUtKey` (columna física `reviewScreenshotBlobUrl`); si no, escribe `data/review-screenshots/<linkId>.png`. También actualiza `reviewScreenshotAt`. El dashboard muestra miniatura y overlay al hacer clic. `GET /api/company-links/:linkId/screenshot` sirve el PNG (requiere sesión Clerk): firma una URL temporal si el archivo está en UploadThing y, si no, lee disco.

Tras un `POST /api/monitor/:linkId` **exitoso con patrón automatizado** (`supportsAutomatedVerification: true`), el servidor intenta `page.screenshot()` y guarda la captura: si existe `UPLOADTHING_TOKEN`, sube un PNG **privado** con UploadThing y persiste el `fileKey` en `reviewScreenshotUtKey` (columna física `reviewScreenshotBlobUrl`); si no, escribe `data/review-screenshots/<linkId>.png`. También actualiza `reviewScreenshotAt`. El dashboard muestra miniatura y overlay al hacer clic. `GET /api/company-links/:linkId/screenshot` sirve el PNG (requiere sesión Clerk): firma una URL temporal si el archivo está en UploadThing y, si no, lee disco.

Si el patrón elegido tiene `supportsAutomatedVerification: false`, el endpoint responde **422** con `code: "NO_AUTOMATED_VERIFICATION_PROTOCOL"` y **no** abre Playwright.

## Tipos base

```typescript
// MonitorResult — resultado de una verificación
type MonitorResult = {
  hasActiveLines: boolean | null;
  notes: string | null;
  isManualReview: boolean;
};

// MonitorRunContext — contexto de ejecución
type MonitorRunContext = {
  url: string;
  curp: string;
  manualWaitMs: number;
};

// CompanyPattern — interfaz que debe implementar cada patrón
type CompanyPattern = {
  id: string;
  matches: (companyName: string) => boolean;
  matchesUrl?: (url: string) => boolean; // opcional; si coincide, gana sobre matches(nombre)
  /** Si es false, el dashboard deshabilita «Verificar» y `POST /api/monitor` responde 422. */
  supportsAutomatedVerification: boolean;
  run: (page: Page, context: MonitorRunContext) => Promise<MonitorResult>;
};
```

## Patrón Altán RNU (`altan-rnu.ts`)

### `vinculatulinea` — vinculación por CURP + línea

**Cuándo aplica:** `getPattern` elige este patrón cuando la URL del link coincide con  
`https://rnu.altanredes.com/<slug>/vinculatulinea` (hostname `rnu.altanredes.com` y path que termina en `/vinculatulinea`).

**Variables:** además de `MONITOR_CURP`, hace falta **`MONITOR_PHONE`** (10 dígitos, sin +52).

**Flujo automatizado:**

1. Carga la URL y hace clic en **Continuar** (pantalla de instrucciones).
2. Espera el formulario, rellena **CURP**, marca **Términos y Condiciones** y **Aviso de Privacidad**, rellena el número celular y pulsa **Continuar**.
3. Si el cuerpo de la página contiene el mensaje de error del portal (p. ej. línea no existe / no pertenece a este operador) → `hasActiveLines: false`.
4. Si aparece texto típico de **validación de identidad** (selfie, prueba de vida, etc.) sin ese error → `hasActiveLines: true` con `isManualReview: true` (conviene confirmar a mano).
5. Si en ~25s no hay detección clara → `hasActiveLines: null`, `isManualReview: true`.

### `consulta` — consulta de líneas vinculadas (CURP)

**Patrón:** `altan-rnu-consulta` (`matchesUrl`: `https://rnu.altanredes.com/consulta`).

**Variable:** solo **`MONITOR_CURP`** (no usa `MONITOR_PHONE`).

**Flujo:** tarjetas **Persona física** (Residente) y **Ciudadano mexicano**, campo **CURP**, dos checkboxes (términos y aviso de privacidad), **Buscar**. El portal carga captcha (`cap.min.js`); el botón **Buscar** suele permanecer `disabled` hasta resolverlo. Con **`PLAYWRIGHT_HEADED=true`**, el código espera hasta que **Buscar** se habilite (hasta `MONITOR_MANUAL_WAIT_MS`, tope 180s) y entonces hace clic. En **headless**, la espera es corta; si el botón no se habilita → `null` + revisión manual con nota sobre captcha.

**Interpretación:** mensajes tipo «no cuentas con líneas…» / equivalentes → `hasActiveLines: false`. Patrones de listado con teléfono + «vinculad»/«línea» → `hasActiveLines: true` + manual. Resto → `null` + manual.

## Diri Móvil — registro de líneas (`diri-movil-registro-lineas.ts`)

**URL:** `https://diri.mx/registrolineas` (hostname `diri.mx`, path con `registrolineas`).

**Variable:** `MONITOR_CURP` (el flujo final es el de Altán `/consulta`).

**Flujo:** abre la página, pulsa **Consultar líneas registradas** (botón o enlace), espera navegación a `rnu.altanredes.com/consulta`, y ejecuta el mismo paso que **`altan-rnu-consulta`** (CURP, checkboxes, **Buscar** con la misma lógica de captcha/headed).

## EXiS — vincula tu línea (`exis-vinculatulinea.ts`)

**URL:** `https://www.exis.mx/#/vinculatulinea` (hostname `exis.mx` o `www.exis.mx`; path o hash con `vinculatulinea`).

**Variable:** `MONITOR_PHONE` (10 dígitos).

**Iframe:** el formulario **no** se renderiza en la página principal de `exis.mx`; carga en un `<iframe src="https://erebus.vadsa-mx.com/vinculatulinea">`. Todos los locators usan `page.frameLocator('iframe[src*="erebus.vadsa-mx.com"]')` y para el checkbox se accede al frame con `page.frames().find(erebus)`.

**Flujo:**

1. `goto("https://www.exis.mx/#/vinculatulinea")` → esperar iframe de `erebus.vadsa-mx.com`.
2. Click en `button` que contiene «Ciudadano mexicano» (dentro del iframe) → **Continuar**.
3. Paso 1 de 8: `input[type="tel"]` → `pressSequentially(MONITOR_PHONE)`.
4. Checkbox «Acepto el tratamiento…» es un **div visual puro** (sin `<input>`): activar con `frame.evaluate(() => label.querySelector("div > div").click())`.
5. **Continuar** (se habilita solo cuando phone + checkbox están activos).
6. _«El número no existe o no está activo»_ → `hasActiveLines: false`. Indicios de paso 2/8, CURP u OTP → `hasActiveLines: true` + manual. Sin señal → `null` + manual.

## Infynit — vincular línea (`infynit-vinculate.ts`)

**URL:** hostname **`vinculate.infynit.mx`** (cualquier ruta del enlace del CRT).

**Variable:** **`MONITOR_PHONE`** (10 dígitos). El paso 1 del portal pide **número de línea móvil**, no CURP; el texto del campo es «Número de línea (10 dígitos)» y el placeholder _Ingresa 10 dígitos_.

**Flujo:** `goto` → rellenar el campo → **Consultar**. Si aparece _«Error al consultar la línea»_ y _«Tu línea está equivocada o no pertenece al operador…»_ → `hasActiveLines: false`. Si no aparece ese bloque de error, el resultado se deja en revisión manual (`null`) por ser conservadores (el stepper siempre muestra los nombres de todos los pasos).

## Mega Móvil — consulta de líneas vinculadas (`megamovil-consulta-vinculacion.ts`)

**URLs:** `https://registro.megamovil.mx/vinculatulinea/` (enlace CRT de entrada) y `https://consultavinculacion.megamovil.mx/` (portal de consulta donde ocurre la verificación).

**Variable:** `MONITOR_CURP` en `.env.local`.

**Flujo:**

1. Navega directamente a `https://consultavinculacion.megamovil.mx/` (evita manejo de nueva pestaña).
2. Rellena el campo **CURP o RFC** (placeholder _Ingresa tu CURP o RFC_).
3. Marca el checkbox **«He leído y acepto el Aviso de Privacidad»** si no está activo.
4. Pulsa **CONSULTAR**.
5. _«La CURP ingresada no cuenta con líneas Mega móvil vinculadas»_ → `hasActiveLines: false`.
6. Indicios de líneas vinculadas (número enmascarado, tabla de resultados) → `hasActiveLines: true` + manual.
7. Sin señal clara → `null` + revisión manual.

## Allce — buscar vinculación (`allce-buscar-vinculacion.ts`)

**URL:** `https://vinculacion.allce.mx/...` (no la ruta final solo `/consulta`). Si el CRT guarda solo el origen (`/`), se normaliza a `/buscar`.

**Variable:** `MONITOR_PHONE` en `.env.local` (10 dígitos; se limpia el campo y se rellena antes de enviar).

**Flujo:** abre la URL, rellena «Número de Teléfono», pulsa **Buscar Vinculación**. _«No encontramos ningún proceso de vinculación pendiente…»_ → `hasActiveLines: false`. _«Verificación de seguridad fallida»_ → `hasActiveLines: null`, revisión manual. **No** se infiere éxito solo por la palabra «vinculación» (p. ej. el título de la página de búsqueda); `hasActiveLines: true` solo con mensajes claros de proceso/líneas (lista en código); en caso dudoso → `null` + manual.

## Celfi — buscar vinculación (`celfi-buscar-vinculacion.ts`)

**URL:** `https://vinculacion.celfi.com.mx/buscar` (u origen del mismo host; si el CRT guarda solo `/`, se normaliza a `/buscar`). No aplica a la ruta solo `/consulta` (misma convención que Allce).

**Variable:** `MONITOR_PHONE` en `.env.local` (10 dígitos).

**Flujo:** formulario «Buscar Mi Vinculación».

- En **headed** (`PLAYWRIGHT_HEADED=true`), el patrón Celfi entra en **asistido real**: rellena teléfono y **espera que el operador pulse manualmente** «Buscar Vinculación» (y resuelva captcha si aparece), observando cambios por `MONITOR_MANUAL_WAIT_MS` (tope 180s).
- En **headless**, sí hace click automático en «Buscar Vinculación».
- Si aparece _«No encontramos ningún proceso de vinculación pendiente…»_ → `hasActiveLines: false` (sin líneas / sin proceso pendiente para ese número).
- Si persiste _«Verificación de seguridad fallida»_ tras la ventana asistida → `null` + revisión manual.
- Señales claras de proceso o líneas vinculadas → `hasActiveLines: true` + manual.

## Dalefon / Internet Bienestar Mex — consulta líneas vinculadas (`dalefon-vinculatulinea.ts`)

**URLs:** `https://www.dalefon.mx/vinculatulinea/` y **`https://www.internetbienestarmex.com/vinculatulinea/`** (mismo patrón `dalefon-vinculatulinea`; host `dalefon.mx` o `internetbienestarmex.com`, path con `vinculatulinea`).

**Variable:** `MONITOR_CURP` en `.env.local`.

**Flujo:**

- **Dalefon:** columna «Consulta líneas vinculadas», radio **Mexicanos (CURP)**, campo **CURP** (`input[name="curp"]` o placeholder _CURP_ a **nivel de página** — no acotar con un `div`/`section` por el título de la columna: el primer bloque que coincide con ese texto a veces **no** envuelve el input y el `fill` hace timeout). Segundo **«Continuar»** (el primero es vinculación).
- **Internet Bienestar Mex:** radio **Persona física**, campo con placeholder _CURP o Pasaporte_, único **«Continuar»**.  
  Mensaje _«No cuentas con líneas asociadas…»_ (puede partirse en varias líneas o decir «…asociadas al CURP») → `hasActiveLines: false`. Otras señales de líneas vinculadas → `hasActiveLines: true` + manual.

## ABIB Móvil — consulta líneas SPA (`abib-com-mx-consulta-lineas.ts`)

**URL:** hostname `abib.com.mx` o `www.abib.com.mx` (origen, `#/consultatuslineas` o `#/vinculatulinea` en el CRT).

**Variable:** `MONITOR_PHONE`.

**Flujo:** si la URL incluye solo `#/vinculatulinea` (hub del sitio), se pulsa **CONSULTAR** en la tarjeta «Consultar mis líneas» y luego el paso 1 de número. Si el enlace ya apunta a `#/consultatuslineas` o es el origen `abib.com.mx`, se abre directamente la consulta de líneas. Mensaje _«no es una línea ABIB»_ (variantes) → `hasActiveLines: false`. Indicios de paso 2 (CURP/RFC) → `hasActiveLines: true` + manual.

## ABIB Internet del Bienestar — consulta línea (`abib-bienestar-consulta-linea.ts`)

**URL:** `https://www.abibinternetdelbienestar.mx/consultatulinea` **o** `…/vinculatulinea` (hostname `abibinternetdelbienestar.mx`).

**Variable:** `MONITOR_PHONE`.

**Flujo:** si el enlace es el **hub** `…/vinculatulinea`, en la tarjeta «Consultar líneas» se pulsa **«Ir a consulta →»** (navega a `/consultatulinea`). Si ya es `…/consultatulinea`, se omite ese paso. Luego se rellena el campo con placeholder **«Ingresa número»** (u otros equivalentes) y se pulsa **Verificar línea** / **Verificar** (click reforzado + fallback). Mensajes _«no es una línea ABIB»_ / _«no pertenece a la red ABIB»_ → `hasActiveLines: false`. Indicio claro de **paso 2** → `hasActiveLines: true` + manual (sin usar la palabra «CURP» suelta del pie de página como señal positiva).

## ABIB Móvil — `abib.mx` vinculación (`abib-mx-vinculatulinea.ts`)

**URL:** `https://www.abib.mx/vinculatulinea` (hostname `abib.mx` o `www.abib.mx`, path con `vinculatulinea`).

**Variable:** `MONITOR_PHONE`.

**Flujo:** mismo enfoque que Bienestar (número + verificar); mensajes de red ABIB iguales. Resultado ambiguo → revisión manual.

## FreedomPop / Ahorrocel — Biometric «My Lines» (`freedompop-biometric-my-lines.ts`)

**URLs:** `https://vinculatulinea.com/Chedrauimovil` (enlace CRT de **Chedraui Móvil**, redirige a FreedomPop), **`https://vinculatulinea.com/Freedompop`** (o `/freedompop`, hub sin sub-ruta; el patrón navega a `/freedompop/welcome` y sigue como welcome), `…/freedompop/welcome`, `…/freedompop/my-lines`, y **`https://vinculatulinea.com/ahorrocel/…`** (patrón `ahorrocel-biometric-my-lines`, mismo `run`).

**Variable:** `MONITOR_CURP` (o pasaporte si el portal lo acepta en el mismo campo).

**Flujo:**

1. Abre la URL del enlace; si es solo el hub `…/Freedompop`, carga `…/freedompop/welcome`. Espera redirección SPA a `welcome` o `my-lines`; si la vista es bienvenida, pulsa **My Lines** (o fallback a URL `…/my-lines`).
2. En **My Lines**: **Fiscal Regime** = Individual (`select` con valor `FISICA` o etiqueta «Individual»).
3. Rellena **CURP or Passport** (placeholder _Enter your CURP or Passport Number_), pulsa **Continue** (click reforzado + fallback).
4. _«The information you entered has no associated lines»_ (y variantes en inglés/español) o credencial inválida → `hasActiveLines: false`.
5. _«Error Retrieving Lines»_ / _«try again later»_ → `hasActiveLines: null`, revisión manual (fallo transitorio del portal).
6. Indicios de OTP / prueba de vida / dashboard → `hasActiveLines: true` + manual.

## Patrón genérico (`generic.ts`)

**Comportamiento actual:**

1. Navega a la URL del link (`page.goto(url)`)
2. Intenta llenar el CURP usando varios selectores comunes
3. Espera `manualWaitMs` para que el operador complete captchas/pasos manuales
4. Lee el `innerText` del body y llama a `inferFromBodyText()`
5. Si `inferFromBodyText` retorna `null` → `isManualReview: true`

**Selectores CURP intentados** (en orden):

- `input[placeholder*="CURP" i]`
- `input[name*="curp" i]`
- `input[id*="curp" i]`

## Agregar un nuevo patrón

1. Crear `src/monitoring/patterns/<operadora>.ts`
2. Implementar `CompanyPattern`:

```typescript
import type { CompanyPattern } from "../base-pattern";

export const miOperadoraPattern: CompanyPattern = {
  id: "mi-operadora",

  matches: (name: string) => /mi.?operadora/i.test(name),
  supportsAutomatedVerification: true,

  run: async (page, { url, curp, manualWaitMs }) => {
    await page.goto(url);

    // Selectores específicos de la operadora
    await page.fill("#campo-curp", curp);
    await page.click("#btn-verificar");

    // Esperar resultado
    await page.waitForSelector(".resultado", { timeout: 30_000 });

    const texto = await page.locator(".resultado").innerText();

    return {
      hasActiveLines: texto.includes("activa"),
      notes: texto,
      isManualReview: false,
    };
  },
};
```

3. Registrar en `src/monitoring/index.ts` **antes** de `genericPattern`. Si el patrón depende de la **URL** (no del nombre de compañía), define `matchesUrl` y colócalo antes que otros que también puedan coincidir:

```typescript
import { altanRnuPattern } from "./patterns/altan-rnu";
import { miOperadoraPattern } from "./patterns/mi-operadora";

const patterns: CompanyPattern[] = [
  altanRnuPattern,
  telcelPattern,
  movistarPattern,
  miOperadoraPattern,
  genericPattern, // siempre al final
];
```

4. Documentar en esta página:
   - URL del portal de la operadora
   - Selectores utilizados
   - Comportamiento especial (captchas, delays, etc.)

## Estado actual de patrones

| Patrón                           | Estado              | Notas                                                                                                                           |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `freedompop-biometric-my-lines`  | ✅ URL              | `vinculatulinea.com/Chedrauimovil`, `…/Freedompop` (hub), `…/freedompop/welcome` o `…/my-lines`; `MONITOR_CURP`                 |
| `ahorrocel-biometric-my-lines`   | ✅ URL              | `vinculatulinea.com/ahorrocel/my-lines` o `/welcome`; mismo flujo que FreedomPop; `MONITOR_CURP`                                |
| `abib-bienestar-consulta-linea`  | ✅ URL              | `abibinternetdelbienestar.mx` + `consultatulinea` o `vinculatulinea`; `MONITOR_PHONE`                                           |
| `abib-mx-vinculatulinea`         | ✅ URL              | `abib.mx` + `vinculatulinea`; `MONITOR_PHONE`                                                                                   |
| `abib-com-mx-consulta-lineas`    | ✅ URL              | `abib.com.mx` / `www.abib.com.mx`; `MONITOR_PHONE`                                                                              |
| `allce-buscar-vinculacion`       | ✅ URL              | `vinculacion.allce.mx` (excl. solo `/consulta`); `MONITOR_PHONE`                                                                |
| `celfi-buscar-vinculacion`       | ✅ URL              | `vinculacion.celfi.com.mx` (excl. solo `/consulta`); `MONITOR_PHONE`                                                            |
| `dalefon-vinculatulinea`         | ✅ URL              | `dalefon.mx/.../vinculatulinea` o `internetbienestarmex.com/.../vinculatulinea`; `MONITOR_CURP`                                 |
| `altan-rnu`                      | ✅ Flujo guiado     | URLs `rnu.altanredes.com/.../vinculatulinea`; `MONITOR_CURP` + `MONITOR_PHONE`                                                  |
| `altan-rnu-consulta`             | ✅ URL              | `rnu.altanredes.com/consulta`; `MONITOR_CURP`; captcha — usar headed + tiempo                                                   |
| `diri-movil-registro-lineas`     | ✅ URL              | `diri.mx/.../registrolineas`; `MONITOR_CURP`; redirige a Altán `/consulta`                                                      |
| `exis-vinculatulinea`            | ✅ URL              | `exis.mx` + `#/vinculatulinea`; `MONITOR_PHONE`                                                                                 |
| `infynit-vinculate`              | ✅ URL              | `vinculate.infynit.mx`; `MONITOR_PHONE` (número de línea, paso 1)                                                               |
| `megamovil-consulta-vinculacion` | ✅ URL              | `registro.megamovil.mx/vinculatulinea` o `consultavinculacion.megamovil.mx`; `MONITOR_CURP`; checkbox de privacidad + Consultar |
| `generic`                        | Heurístico          | `supportsAutomatedVerification: false` — no se ejecuta vía «Verificar»                                                          |
| `telcel`                         | ⚠️ Alias de generic | `supportsAutomatedVerification: false` hasta tener selectores reales                                                            |
| `movistar`                       | ⚠️ Alias de generic | `supportsAutomatedVerification: false` hasta tener selectores reales                                                            |

## Debugging de patrones

Correr con `PLAYWRIGHT_HEADED=true` para ver el browser en acción:

```powershell
$env:PLAYWRIGHT_HEADED="true"
$env:MONITOR_CURP="TU_CURP_AQUI"
$env:MONITOR_PHONE="5512345678"
npm run dev
# Luego usar el botón "Verificar" en el dashboard
```
