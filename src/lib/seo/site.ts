export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

const PRODUCTION_GIT_BRANCHES = new Set(["main", "master"]);

export function isPreviewDeployment(): boolean {
  if (process.env.VERCEL_ENV === "preview") return true;

  const branch = process.env.VERCEL_GIT_COMMIT_REF?.trim();
  if (branch && !PRODUCTION_GIT_BRANCHES.has(branch)) return true;

  return false;
}

/** Block indexing on preview deployments unless explicitly overridden. */
export function allowSearchIndexing(): boolean {
  if (process.env.OMNI_ALLOW_PREVIEW_INDEX === "true") return true;
  return !isPreviewDeployment();
}
