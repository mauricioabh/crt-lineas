import type { ZodType } from "zod";

function formatZodError(error: { issues: { message: string }[] }): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

export function parseJsonBody<T>(
  schema: ZodType<T>,
  body: unknown,
): { data: T } | { error: string } {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    return { error: formatZodError(result.error) };
  }
  return { data: result.data };
}

export function parseSearchParams<T>(
  schema: ZodType<T>,
  params: URLSearchParams,
): { data: T } | { error: string } {
  const raw = Object.fromEntries(params.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return { error: formatZodError(result.error) };
  }
  return { data: result.data };
}
