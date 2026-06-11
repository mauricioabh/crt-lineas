import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/** Dev-only probe — throws a test error visible in Sentry when SENTRY_DSN is set. */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  Sentry.captureException(new Error("CRT Líneas Sentry test error"));
  return NextResponse.json({ ok: true, message: "Test error sent to Sentry" });
}
