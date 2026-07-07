#!/usr/bin/env node
/** Calls GET /api/debug/sentry — run while dev server is up (default http://localhost:3000). */
const baseUrl = process.env.BASE_URL ?? "http://localhost:3000";

const res = await fetch(`${baseUrl}/api/debug/sentry`);
const body = await res.json().catch(() => ({}));

if (!res.ok || body.ok !== true) {
  console.error(`FAIL ${res.status}`, body);
  process.exit(1);
}

console.log(`OK ${baseUrl}/api/debug/sentry`, body.message ?? body);
