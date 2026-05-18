import type { Prisma, UserCompanyLinkResult } from "@prisma/client";
import type { Page } from "playwright";
import { prisma } from "@/lib/db";
import {
  formatMonitorRunError,
  MonitorRunError,
  sanitizeEnvFromUserFacingText,
} from "@/lib/monitor-error-format";
import { saveReviewScreenshotPng } from "@/lib/review-screenshot-storage";
import { getPattern } from "@/monitoring";
import type { MonitorResult } from "@/monitoring/base-pattern";

export type LinkWithCompany = Prisma.CompanyLinkGetPayload<{
  include: { company: true };
}>;

export type ExecuteMonitorOptions = {
  userId: string;
  curp: string | null;
  phone: string | null;
  manualWaitMs: number;
  /** Presente en corridas masivas para agrupar filas en `MonitorVerificationLog`. */
  batchId?: string | null;
  /**
   * Tiempo máximo (ms) por ítem en verificación masiva. Si `pattern.run` tarda más,
   * se cancela y se persiste como error. `null` o `undefined` = sin límite.
   */
  itemTimeoutMs?: number | null;
};

/**
 * Intenta persistir el fallo en Neon. Si la migración aún no se ha aplicado (tablas/columnas
 * inexistentes), el error se registra en consola pero NO propaga — no debe bloquear el flujo
 * principal del monitor.
 */
async function tryPersistFailure(
  linkId: string,
  userId: string,
  opts: {
    userFacingMessage: string;
    technicalDetail: string;
    patternId?: string | null;
    batchId?: string | null;
  },
): Promise<void> {
  try {
    const userFacing = sanitizeEnvFromUserFacingText(
      opts.userFacingMessage,
    ).slice(0, 4000);
    const technical = sanitizeEnvFromUserFacingText(opts.technicalDetail).slice(
      0,
      50_000,
    );
    const now = new Date();
    await prisma.$transaction([
      prisma.monitorVerificationLog.create({
        data: {
          linkId,
          userId,
          success: false,
          userFacingMessage: userFacing,
          technicalDetail: technical,
          patternId: opts.patternId ?? null,
          batchId: opts.batchId ?? null,
        },
      }),
      prisma.userCompanyLinkResult.upsert({
        where: { userId_linkId: { userId, linkId } },
        create: {
          userId,
          linkId,
          lastMonitorErrorAt: now,
          lastMonitorErrorMessage: userFacing,
          lastMonitorErrorDetail: technical,
        },
        update: {
          lastMonitorErrorAt: now,
          lastMonitorErrorMessage: userFacing,
          lastMonitorErrorDetail: technical,
        },
      }),
    ]);
  } catch (persistErr) {
    console.error(
      "[monitor] tryPersistFailure: could not write to Neon",
      { linkId, userId, patternId: opts.patternId },
      persistErr,
    );
  }
}

/**
 * Intenta registrar un run exitoso en el log y limpiar los campos de error.
 * Si la migración no se ha aplicado, solo actualiza los campos legacy (sin el log ni los campos
 * de error, que pueden no existir todavía).
 */
async function tryPersistSuccess(
  linkId: string,
  userId: string,
  opts: {
    userSummary: string;
    hasActiveLines: boolean | null;
    isManualReview: boolean;
    reviewNotes: string | null;
    reviewScreenshotAt: Date | null;
    reviewScreenshotUtKey: string | null;
    patternId: string;
    batchId?: string | null;
  },
): Promise<UserCompanyLinkResult> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.monitorVerificationLog.create({
      data: {
        linkId,
        userId,
        success: true,
        userFacingMessage: opts.userSummary.slice(0, 4000),
        technicalDetail: null,
        patternId: opts.patternId,
        batchId: opts.batchId ?? null,
      },
    });
    return tx.userCompanyLinkResult.upsert({
      where: { userId_linkId: { userId, linkId } },
      create: {
        userId,
        linkId,
        hasActiveLines: opts.hasActiveLines,
        isReviewed: true,
        isManualReview: opts.isManualReview,
        lastReviewedAt: now,
        reviewNotes: opts.reviewNotes,
        reviewScreenshotAt: opts.reviewScreenshotAt,
        reviewScreenshotUtKey: opts.reviewScreenshotUtKey,
        lastMonitorErrorAt: null,
        lastMonitorErrorMessage: null,
        lastMonitorErrorDetail: null,
      },
      update: {
        hasActiveLines: opts.hasActiveLines,
        isReviewed: true,
        isManualReview: opts.isManualReview,
        lastReviewedAt: now,
        reviewNotes: opts.reviewNotes,
        reviewScreenshotAt: opts.reviewScreenshotAt,
        reviewScreenshotUtKey: opts.reviewScreenshotUtKey,
        lastMonitorErrorAt: null,
        lastMonitorErrorMessage: null,
        lastMonitorErrorDetail: null,
      },
    });
  });
}

/**
 * Ejecuta el patrón Playwright, guarda captura y persiste el resultado.
 * El caller debe abrir/cerrar el `page` según convenga (una pestaña por verificación en bulk).
 */
export async function executeAutomatedMonitorOnPage(
  page: Page,
  link: LinkWithCompany,
  options: ExecuteMonitorOptions,
): Promise<{
  patternId: string;
  result: MonitorResult;
  userResult: UserCompanyLinkResult;
}> {
  const pattern = getPattern(link.company.name, link.url);
  if (!pattern.supportsAutomatedVerification) {
    const err = new Error(
      "Este enlace no tiene un protocolo de verificación automatizado configurado.",
    );
    Reflect.set(err, "code", "NO_AUTOMATED_VERIFICATION_PROTOCOL");
    throw err;
  }

  const batchId = options.batchId ?? null;

  let result: MonitorResult;
  try {
    const runPromise = pattern.run(page, {
      url: link.url,
      curp: options.curp,
      phone: options.phone,
      manualWaitMs: options.manualWaitMs,
    });

    const itemTimeoutMs = options.itemTimeoutMs;
    if (itemTimeoutMs && itemTimeoutMs > 0) {
      const seconds = Math.round(itemTimeoutMs / 1000);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new MonitorRunError(
                `La verificación superó el límite de tiempo de ${seconds} s. Se canceló automáticamente.`,
                `Item timeout after ${seconds}s (limit ${itemTimeoutMs}ms)`,
              ),
            ),
          itemTimeoutMs,
        );
      });
      // Si el timeout gana la carrera, runPromise sigue corriendo hasta que la página se
      // cierra (el caller la cierra en su bloque finally). El .catch() previene el
      // "unhandled rejection" que ocurriría cuando Playwright detecta que la página cerró.
      runPromise.catch(() => {});
      try {
        result = await Promise.race([runPromise, timeoutPromise]);
      } finally {
        clearTimeout(timer);
      }
    } else {
      result = await runPromise;
    }
  } catch (runErr) {
    const { userMessage, technical } = formatMonitorRunError(runErr);
    console.error(
      "[monitor] pattern.run failed",
      {
        linkId: link.id,
        company: link.company.name,
        patternId: pattern.id,
        batchId,
      },
      runErr,
    );
    // tryPersistFailure nunca propaga — el error real (MonitorRunError) siempre se lanza
    await tryPersistFailure(link.id, options.userId, {
      userFacingMessage: userMessage,
      technicalDetail: technical,
      patternId: pattern.id,
      batchId,
    });
    throw new MonitorRunError(userMessage, technical);
  }

  let reviewScreenshotAt: Date | null = null;
  let reviewScreenshotUtKey: string | null = null;
  try {
    const png = await page.screenshot({ type: "png", fullPage: true });
    const { utFileKey } = await saveReviewScreenshotPng(
      link.id,
      Buffer.from(png),
    );
    reviewScreenshotAt = new Date();
    reviewScreenshotUtKey = utFileKey;
  } catch (err) {
    console.error(
      "[monitor] review screenshot failed",
      { linkId: link.id, patternId: pattern.id },
      err instanceof Error ? err.message : err,
    );
  }

  const rawNotes = result.notes?.trim() || null;
  const userSummary =
    (rawNotes ? sanitizeEnvFromUserFacingText(rawNotes) : null) ||
    "Verificación automática completada sin notas adicionales.";

  const updated = await tryPersistSuccess(link.id, options.userId, {
    userSummary,
    hasActiveLines: result.hasActiveLines,
    isManualReview: result.isManualReview,
    reviewNotes: rawNotes ? sanitizeEnvFromUserFacingText(rawNotes) : null,
    reviewScreenshotAt,
    reviewScreenshotUtKey,
    patternId: pattern.id,
    batchId,
  });

  return { patternId: pattern.id, result, userResult: updated };
}
