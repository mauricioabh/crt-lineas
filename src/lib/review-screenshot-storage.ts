import fs from "node:fs/promises";
import path from "node:path";

import { UTApi, UTFile } from "uploadthing/server";

const SUBDIR = ["data", "review-screenshots"] as const;

function getUploadThingToken(): string | undefined {
  const t = process.env.UPLOADTHING_TOKEN?.trim();
  return t || undefined;
}

export function getReviewScreenshotDir(): string {
  return path.join(process.cwd(), ...SUBDIR);
}

export function getReviewScreenshotFilePath(linkId: string): string {
  if (!/^[a-z0-9]{20,36}$/i.test(linkId)) {
    throw new Error("Invalid linkId for screenshot path");
  }
  return path.join(getReviewScreenshotDir(), `${linkId}.png`);
}

export async function ensureReviewScreenshotDir(): Promise<void> {
  await fs.mkdir(getReviewScreenshotDir(), { recursive: true });
}

/**
 * Extrae la `ufsUrl` (URL pública CDN) del resultado de `uploadFiles`.
 * UploadThing en plan gratuito no soporta ACL private; se usan archivos públicos
 * y la ruta API actúa como proxy autenticado al descargarlos.
 */
function unwrapUtUploadUrl(result: unknown): { ufsUrl: string } {
  if (Array.isArray(result) && result.length > 0) {
    return unwrapUtUploadUrl(result[0]);
  }
  if (!result || typeof result !== "object") {
    throw new Error("UploadThing: resultado inválido");
  }
  const obj = result as Record<string, unknown>;

  const maybeData = obj.data;
  if (maybeData && typeof maybeData === "object") {
    const d = maybeData as Record<string, unknown>;
    if (
      typeof d.ufsUrl === "string" &&
      d.ufsUrl.length > 0 &&
      obj.error == null
    ) {
      return { ufsUrl: d.ufsUrl };
    }
  }

  const right = obj.right;
  if (
    obj._tag === "Right" &&
    right &&
    typeof right === "object" &&
    typeof (right as Record<string, unknown>).ufsUrl === "string"
  ) {
    const ufsUrl = (right as Record<string, unknown>).ufsUrl as string;
    if (ufsUrl.length > 0) {
      return { ufsUrl };
    }
  }

  if (obj.error != null) {
    const errMsg =
      typeof obj.error === "object" && obj.error !== null
        ? JSON.stringify(obj.error)
        : String(obj.error);
    throw new Error(`UploadThing: falló la subida — ${errMsg}`);
  }
  throw new Error("UploadThing: resultado sin ufsUrl reconocible");
}

/**
 * Persiste la captura:
 * - Con `UPLOADTHING_TOKEN`: sube a UploadThing (ACL `public-read`, plan gratuito compatible)
 *   y devuelve la URL pública CDN (`ufsUrl`) como `utFileKey`.
 * - Sin token: escribe en `data/review-screenshots/<linkId>.png` (solo dev local).
 */
export async function saveReviewScreenshotPng(
  linkId: string,
  png: Buffer,
): Promise<{ utFileKey: string | null }> {
  if (!/^[a-z0-9]{20,36}$/i.test(linkId)) {
    throw new Error("Invalid linkId for screenshot path");
  }

  const token = getUploadThingToken();
  if (token) {
    const utapi = new UTApi({ token });
    // No usar customId: UploadThing rechaza subidas posteriores si el customId ya existe,
    // lo que silenciaría la captura en cualquier re-verificación del mismo link.
    const file = new UTFile([new Uint8Array(png)], `review-${linkId}.png`, {
      type: "image/png",
    });
    const raw = await utapi.uploadFiles(file, { acl: "public-read" });
    const { ufsUrl } = unwrapUtUploadUrl(raw);
    return { utFileKey: ufsUrl };
  }

  await ensureReviewScreenshotDir();
  await fs.writeFile(getReviewScreenshotFilePath(linkId), png, { mode: 0o600 });
  return { utFileKey: null };
}

export async function reviewScreenshotFileExists(
  linkId: string,
): Promise<boolean> {
  try {
    await fs.access(getReviewScreenshotFilePath(linkId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Lee la captura desde UploadThing.
 * `utUrl` es la `ufsUrl` pública guardada en BD; no requiere token para descargar,
 * pero verificamos que el token exista para confirmar que viene de nuestro almacenamiento.
 */
export async function readReviewScreenshotFromUt(
  utUrl: string,
): Promise<Buffer | null> {
  try {
    const res = await fetch(utUrl);
    if (!res.ok) {
      return null;
    }
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function readReviewScreenshotFromDisk(
  linkId: string,
): Promise<Buffer | null> {
  try {
    return await fs.readFile(getReviewScreenshotFilePath(linkId));
  } catch {
    return null;
  }
}
