import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getAfterAuthRedirectUrl } from "@/lib/auth-redirect-url";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/inngest",
  "/api/debug/sentry",
]);

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();

  if (userId && request.nextUrl.pathname === "/") {
    return NextResponse.redirect(
      new URL(getAfterAuthRedirectUrl(), request.url),
    );
  }

  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

/** Next.js 16+: archivo `proxy.ts` (antes `middleware.ts`); ver https://nextjs.org/docs/app/api-reference/file-conventions/proxy */
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
