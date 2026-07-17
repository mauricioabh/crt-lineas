import type { CompanyPattern } from "./base-pattern";
import { abibBienestarConsultaLineaPattern } from "./patterns/abib-bienestar-consulta-linea";
import { abibComMxConsultaLineasPattern } from "./patterns/abib-com-mx-consulta-lineas";
import { abibMxVinculatulineaPattern } from "./patterns/abib-mx-vinculatulinea";
import { allceBuscarVinculacionPattern } from "./patterns/allce-buscar-vinculacion";
import { celfiBuscarVinculacionPattern } from "./patterns/celfi-buscar-vinculacion";
import { dalefonVinculatulineaPattern } from "./patterns/dalefon-vinculatulinea";
import { altanRnuConsultaPattern, altanRnuPattern } from "./patterns/altan-rnu";
import { diriMovilRegistroLineasPattern } from "./patterns/diri-movil-registro-lineas";
import { exisVinculatulineaPattern } from "./patterns/exis-vinculatulinea";
import { infynitVinculatePattern } from "./patterns/infynit-vinculate";
import { megamovilConsultaVinculacionPattern } from "./patterns/megamovil-consulta-vinculacion";
import {
  ahorrocelBiometricMyLinesPattern,
  freedompopBiometricMyLinesPattern,
  ouiBiometricMyLinesPattern,
  oxxoCelBiometricMyLinesPattern,
  wimotelecomBiometricMyLinesPattern,
  yobiTelecomBiometricMyLinesPattern,
} from "./patterns/freedompop-biometric-my-lines";
import { genericPattern } from "./patterns/generic";
import { movistarPattern } from "./patterns/movistar";
import { telcelPattern } from "./patterns/telcel";
import { mosiBuscarVinculacionPattern } from "./patterns/mosi-buscar-vinculacion";
import { redphoneBuscarVinculacionPattern } from "./patterns/redphone-buscar-vinculacion";
import { pillofonRegistroLineasPattern } from "./patterns/pillofon-registro-lineas";
import { viasatConsultaVinculacionPattern } from "./patterns/viasat-consulta-vinculacion";
import { virginMobileConsultaLineaPattern } from "./patterns/virgin-mobile-consulta-linea";
import { uberCelPattern } from "./patterns/uber-cel";

/**
 * "yes"       — dedicated Playwright flow exists and is active.
 * "in-review" — protocol written and under validation testing.
 * "pending"   — Lista explícita de operadoras cuyo portal aún no tiene un flujo
 *               automatizable definido en la app (CRT Persona).
 * "no"        — specific pattern exists but automated verification is disabled,
 *               or no dedicated pattern (generic) when not on any list.
 */
export type VerificationStatus = "yes" | "in-review" | "pending" | "no";

function companyNameMatchKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Compañías que deben mostrarse como «Pendiente» en la columna Auto (solo estas;
 * el resto sin patrón dedicado sigue en «No»).
 */
const PENDING_VERIFICATION_COMPANY_KEYS = new Set(
  [
    "AT&T, Unefon y WIM marca digital AT&T",
    "AhorroCel",
    "Alestra móvil",
    "Bait",
    "Beneleit Móvil",
    "Bestel",
    "Cablecom",
    "Dialo",
    "Dua",
    "Fedego!",
    "Flash Mobile",
    "Grupo Bitelit",
    "IENTC Movil",
    "Inxel",
    "Izzi",
    "Link Móvil",
    "MMXC MOVIL",
    // Nuevas (portal identificado, flujo aún no automatizable)
    "Mirlo",
    "MoBig",
    "Movired",
    "Newww",
    "Nextor Movil",
    "Oxio",
    "Red Aguila",
    "Red Potencia",
    "Sistcomp",
    "Sky",
    "Sorcel",
    "Telcel",
    "Teléfonica Movistar",
    "Tokamóvil",
    "Viral Cel",
    "Weex",
    "Yo Mobile",
  ].map(companyNameMatchKey),
);

export function companyPendingVerificationUi(companyName: string): boolean {
  return PENDING_VERIFICATION_COMPANY_KEYS.has(
    companyNameMatchKey(companyName),
  );
}

/**
 * Compañías cuyo protocolo de verificación ha sido escrito y está en revisión/pruebas.
 * Muestran «En revisión» en la columna Auto.
 */
const IN_REVIEW_VERIFICATION_COMPANY_KEYS = new Set(
  [
    "Mosi",
    "OUI",
    "OXXO CEL",
    "Pillofon",
    "Redphone",
    "Uber Cel",
    "Viasat",
    "Virgin Mobile",
    "Wimotelecom",
    "Yobi Telecom",
  ].map(companyNameMatchKey),
);

export function companyInReviewVerificationUi(companyName: string): boolean {
  return IN_REVIEW_VERIFICATION_COMPANY_KEYS.has(
    companyNameMatchKey(companyName),
  );
}

const patterns: CompanyPattern[] = [
  ahorrocelBiometricMyLinesPattern,
  freedompopBiometricMyLinesPattern,
  ouiBiometricMyLinesPattern,
  oxxoCelBiometricMyLinesPattern,
  wimotelecomBiometricMyLinesPattern,
  yobiTelecomBiometricMyLinesPattern,
  abibBienestarConsultaLineaPattern,
  abibMxVinculatulineaPattern,
  abibComMxConsultaLineasPattern,
  allceBuscarVinculacionPattern,
  celfiBuscarVinculacionPattern,
  mosiBuscarVinculacionPattern,
  redphoneBuscarVinculacionPattern,
  dalefonVinculatulineaPattern,
  altanRnuPattern,
  altanRnuConsultaPattern,
  diriMovilRegistroLineasPattern,
  pillofonRegistroLineasPattern,
  exisVinculatulineaPattern,
  infynitVinculatePattern,
  megamovilConsultaVinculacionPattern,
  viasatConsultaVinculacionPattern,
  virginMobileConsultaLineaPattern,
  uberCelPattern,
  telcelPattern,
  movistarPattern,
  genericPattern,
];
export type {
  CompanyPattern,
  MonitorResult,
  MonitorRunContext,
} from "./base-pattern";

export function getPattern(companyName: string, url: string): CompanyPattern {
  const byUrl = patterns.find(
    (p) =>
      p !== genericPattern &&
      typeof p.matchesUrl === "function" &&
      p.matchesUrl(url),
  );
  if (byUrl) {
    return byUrl;
  }
  const match = patterns.find(
    (p) => p !== genericPattern && p.matches(companyName),
  );
  return match ?? genericPattern;
}

/** True when this company link has a dedicated Playwright flow (not heuristic-only). */
export function linkSupportsAutomatedVerification(
  companyName: string,
  url: string,
): boolean {
  return getPattern(companyName, url).supportsAutomatedVerification;
}

/**
 * Returns the four-state verification status for a company link.
 * «En revisión» > «Pendiente» > patrón dedicado > «No».
 */
export function getLinkVerificationStatus(
  companyName: string,
  url: string,
): VerificationStatus {
  if (companyInReviewVerificationUi(companyName)) return "in-review";
  if (companyPendingVerificationUi(companyName)) return "pending";
  const pattern = getPattern(companyName, url);
  return pattern.supportsAutomatedVerification ? "yes" : "no";
}
