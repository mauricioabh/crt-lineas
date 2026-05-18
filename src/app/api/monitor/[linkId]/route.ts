import { NextResponse } from "next/server";
import { launchChromium } from "@/lib/playwright-launch";
import { requireUserId } from "@/lib/auth";
import { requireMonitorCredentials } from "@/lib/verification-profile";
import { prisma } from "@/lib/db";
import { authErrorResponse } from "@/lib/http";
import {
  formatUnknownMonitorError,
  MonitorRunError,
} from "@/lib/monitor-error-format";
import { executeAutomatedMonitorOnPage } from "@/lib/monitor-verify-link";
import { getPattern } from "@/monitoring";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  request: Request,
  context: { params: Promise<{ linkId: string }> },
) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  let credentials;
  try {
    credentials = await requireMonitorCredentials(userId);
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) {
      return res;
    }
    throw e;
  }

  const { linkId } = await context.params;
  const link = await prisma.companyLink.findUnique({
    where: { id: linkId },
    include: { company: true },
  });

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  if (!link.company.enabled) {
    return NextResponse.json({ error: "Company disabled" }, { status: 400 });
  }

  const bulkRun = new URL(request.url).searchParams.get("bulk") === "1";
  /** Verificación masiva (`?bulk=1`): siempre headless. En Vercel no hay modo headed. */
  const headed =
    process.env.PLAYWRIGHT_HEADED === "true" &&
    !bulkRun &&
    process.env.VERCEL !== "1";
  const manualWaitMs = Number(process.env.MONITOR_MANUAL_WAIT_MS ?? 120_000);
  const curp = credentials.curp;
  const phone = credentials.phone;

  const pattern = getPattern(link.company.name, link.url);
  if (!pattern.supportsAutomatedVerification) {
    return NextResponse.json(
      {
        error:
          "Este enlace no tiene un protocolo de verificación automatizado configurado. Use el desplegable «Líneas activas» y las acciones manuales, o espere a que se agregue soporte para este portal.",
        code: "NO_AUTOMATED_VERIFICATION_PROTOCOL",
        patternId: pattern.id,
      },
      { status: 422 },
    );
  }

  let browser;
  try {
    browser = await launchChromium({ headless: !headed });
  } catch (launchErr) {
    const { userMessage, technical } = formatUnknownMonitorError(launchErr);
    console.error(
      "[monitor] chromium.launch failed",
      { linkId, company: link.company.name },
      launchErr,
    );
    return NextResponse.json(
      { error: userMessage, errorDetail: technical },
      { status: 500 },
    );
  }

  try {
    const page = await browser.newPage();
    const { patternId, result, userResult } =
      await executeAutomatedMonitorOnPage(page, link, {
        userId,
        curp,
        phone,
        manualWaitMs: Number.isFinite(manualWaitMs) ? manualWaitMs : 120_000,
        batchId: null,
      });

    return NextResponse.json({
      ok: true,
      patternId,
      result,
      link: userResult,
    });
  } catch (err) {
    if (err instanceof MonitorRunError) {
      return NextResponse.json(
        { error: err.message, errorDetail: err.technicalDetail },
        { status: 500 },
      );
    }
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code)
        : "";
    if (code === "NO_AUTOMATED_VERIFICATION_PROTOCOL") {
      return NextResponse.json(
        {
          error:
            "Este enlace no tiene un protocolo de verificación automatizado configurado. Use el desplegable «Líneas activas» y las acciones manuales, o espere a que se agregue soporte para este portal.",
          code: "NO_AUTOMATED_VERIFICATION_PROTOCOL",
        },
        { status: 422 },
      );
    }
    const { userMessage, technical } = formatUnknownMonitorError(err);
    console.error(
      "[monitor] unexpected error",
      { linkId, company: link.company.name },
      err,
    );
    return NextResponse.json(
      { error: userMessage, errorDetail: technical },
      { status: 500 },
    );
  } finally {
    await browser.close();
  }
}
