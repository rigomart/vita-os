#!/usr/bin/env node
// Checks a deployed API without signing in: Better Auth answers, protected
// operations refuse anonymous callers, and only the trusted browser origin may
// make credentialed requests. Signed-in behavior belongs to the rehearsal
// smoke suite, which needs a migrated account.
//
//   node scripts/smoke-deployment.mjs <api-origin> <browser-origin>

const apiOrigin = process.argv[2]?.replace(/\/$/, "");
const browserOrigin = process.argv[3]?.replace(/\/$/, "");
const foreignOrigin = "https://smoke-test.invalid";

if (!apiOrigin || !browserOrigin) {
  console.error("✗ Usage: smoke-deployment.mjs <api-origin> <browser-origin>");
  process.exit(1);
}

const failures = [];
const notes = [];

function check(condition, success, failure) {
  if (condition) notes.push(success);
  else failures.push(failure);
}

try {
  const ok = await fetch(`${apiOrigin}/api/auth/ok`);
  check(
    ok.ok,
    "GET /api/auth/ok → 200",
    `GET /api/auth/ok returned ${ok.status}`,
  );

  const anonymous = await fetch(`${apiOrigin}/v1/areas`);
  const anonymousBody = await anonymous.json().catch(() => undefined);
  check(
    anonymous.status === 401 && anonymousBody?.error?.code === "unauthorized",
    "anonymous GET /v1/areas → 401 unauthorized",
    `anonymous GET /v1/areas returned ${anonymous.status}`,
  );

  const preflight = await fetch(`${apiOrigin}/v1/areas`, {
    method: "OPTIONS",
    headers: {
      origin: browserOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  check(
    preflight.headers.get("access-control-allow-origin") === browserOrigin &&
      preflight.headers.get("access-control-allow-credentials") === "true",
    `preflight from ${browserOrigin} allows credentials`,
    `preflight from ${browserOrigin} was not allowed with credentials`,
  );

  const foreignPreflight = await fetch(`${apiOrigin}/v1/areas`, {
    method: "OPTIONS",
    headers: {
      origin: foreignOrigin,
      "access-control-request-method": "POST",
    },
  });
  check(
    foreignPreflight.headers.get("access-control-allow-origin") !==
      foreignOrigin,
    "preflight from a foreign origin is not allowed",
    "preflight from a foreign origin was allowed",
  );

  const foreignWrite = await fetch(`${apiOrigin}/v1/areas`, {
    method: "POST",
    headers: { origin: foreignOrigin, "content-type": "application/json" },
    body: "{}",
  });
  check(
    foreignWrite.status === 403,
    "write from a foreign origin → 403",
    `write from a foreign origin returned ${foreignWrite.status}`,
  );
} catch (error) {
  failures.push(`Request failed: ${error.message}`);
}

console.log(`API smoke test: ${apiOrigin}`);
for (const note of notes) console.log(`  ✓ ${note}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log("✓ API answers and enforces its browser origin.");
