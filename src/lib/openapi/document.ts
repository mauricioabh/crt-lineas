import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "./common";
import {
  CompaniesResponseSchema,
  CompanySchema,
  ErrorResponseSchema,
  MonitorBulkBodySchema,
  MonitorSingleQuerySchema,
  MonitorSuccessResponseSchema,
  UpdateCompanyBodySchema,
  UpdateCompanyLinkBodySchema,
  UserCompanyLinkResultSchema,
} from "./schemas";

const registry = new OpenAPIRegistry();

const jsonError = {
  description: "Error response",
  content: { "application/json": { schema: ErrorResponseSchema } },
};

registry.registerPath({
  method: "get",
  path: "/api/companies",
  tags: ["Companies"],
  summary: "List companies and links",
  operationId: "listCompanies",
  responses: {
    200: {
      description:
        "Companies with nested links (admins see disabled companies).",
      content: { "application/json": { schema: CompaniesResponseSchema } },
    },
    401: jsonError,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/companies/{id}",
  tags: ["Companies"],
  summary: "Enable or disable a company (admin)",
  operationId: "updateCompany",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: UpdateCompanyBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Updated company.",
      content: { "application/json": { schema: CompanySchema } },
    },
    400: jsonError,
    401: jsonError,
    404: jsonError,
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/company-links/{linkId}",
  tags: ["Companies"],
  summary: "Update per-user link review state",
  operationId: "updateCompanyLink",
  request: {
    params: z.object({ linkId: z.string() }),
    body: {
      content: { "application/json": { schema: UpdateCompanyLinkBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "Upserted user link result.",
      content: { "application/json": { schema: UserCompanyLinkResultSchema } },
    },
    401: jsonError,
    404: jsonError,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/monitor/bulk",
  tags: ["Monitor"],
  summary: "Bulk automated monitor (SSE)",
  description:
    "Runs Playwright verification for many links. Response is `text/event-stream` with JSON payloads per event.",
  operationId: "monitorBulk",
  request: {
    body: {
      content: { "application/json": { schema: MonitorBulkBodySchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: "SSE stream of monitor progress events.",
      content: {
        "text/event-stream": {
          schema: {
            type: "string",
            description: "Newline-delimited SSE events.",
          },
        },
      },
    },
    400: jsonError,
    401: jsonError,
  },
});

registry.registerPath({
  method: "post",
  path: "/api/monitor/{linkId}",
  tags: ["Monitor"],
  summary: "Run automated monitor for one link",
  operationId: "monitorSingle",
  request: {
    params: z.object({ linkId: z.string() }),
    query: MonitorSingleQuerySchema,
  },
  responses: {
    200: {
      description: "Monitor completed.",
      content: { "application/json": { schema: MonitorSuccessResponseSchema } },
    },
    400: jsonError,
    401: jsonError,
    404: jsonError,
    422: jsonError,
    500: jsonError,
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openapiDocument = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "CRT Líneas API",
    version: "0.1.0",
    description: "Monitor and companies API routes for CRT line verification.",
  },
  servers: [{ url: "/", description: "Current host" }],
  tags: [
    {
      name: "Companies",
      description: "Company catalog and per-user link results.",
    },
    {
      name: "Monitor",
      description: "Playwright-based automated verification.",
    },
  ],
});
