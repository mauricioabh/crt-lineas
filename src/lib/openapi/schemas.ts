import { ErrorResponseSchema, OkResponseSchema, z } from "./common";

export const CompanyLinkSchema = z
  .object({
    id: z.string(),
    companyId: z.string(),
    url: z.string().url(),
    label: z.string(),
    hasVerificationProtocol: z.boolean(),
  })
  .passthrough()
  .openapi("CompanyLink");

export const CompanySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    links: z.array(CompanyLinkSchema).optional(),
  })
  .passthrough()
  .openapi("Company");

export const CompaniesResponseSchema = z
  .array(CompanySchema)
  .openapi("CompaniesResponse");

export const UpdateCompanyBodySchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict()
  .openapi("UpdateCompanyBody");

export const UpdateCompanyLinkBodySchema = z
  .object({
    hasActiveLines: z.boolean().nullable().optional(),
    isManualReview: z.boolean().optional(),
    isReviewed: z.boolean().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .openapi("UpdateCompanyLinkBody");

export const UserCompanyLinkResultSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    linkId: z.string(),
    hasActiveLines: z.boolean().nullable().optional(),
    isReviewed: z.boolean().optional(),
    isManualReview: z.boolean().optional(),
    reviewNotes: z.string().nullable().optional(),
    lastReviewedAt: z.string().datetime().optional(),
  })
  .passthrough()
  .openapi("UserCompanyLinkResult");

export const MonitorBulkBodySchema = z
  .object({
    linkIds: z.array(z.string().min(1)).min(1).max(150),
  })
  .strict()
  .openapi("MonitorBulkBody");

export const MonitorSingleQuerySchema = z
  .object({
    bulk: z.enum(["0", "1"]).optional(),
  })
  .openapi("MonitorSingleQuery");

export const MonitorSuccessResponseSchema = z
  .object({
    ok: z.literal(true),
    patternId: z.string(),
    result: z.unknown(),
    link: z.unknown(),
  })
  .openapi("MonitorSuccessResponse");

export { ErrorResponseSchema, OkResponseSchema };
