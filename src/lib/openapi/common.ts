import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export { z };

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string().optional(),
    errorDetail: z.string().optional(),
  })
  .openapi("ErrorResponse");

export const OkResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .openapi("OkResponse");
