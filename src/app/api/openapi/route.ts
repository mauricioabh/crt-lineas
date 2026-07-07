import { openapiDocument } from "@/lib/openapi/document";

export const dynamic = "force-static";

export async function GET() {
  return Response.json(openapiDocument);
}
