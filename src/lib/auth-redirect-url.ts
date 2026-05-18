/** Post sign-in / sign-up destination (aligned with docs/ENV.md). */
export function getAfterAuthRedirectUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ??
    process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ??
    "/dashboard"
  );
}
