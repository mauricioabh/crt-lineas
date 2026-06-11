/** True when Inngest keys are configured (production or local dev server). */
export function isInngestEnabled(): boolean {
  return (
    Boolean(process.env.INNGEST_EVENT_KEY?.trim()) &&
    Boolean(process.env.INNGEST_SIGNING_KEY?.trim())
  );
}
