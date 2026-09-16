#!/usr/bin/env node
// Checks a deployed origin serves the shell, its hashed assets, and the SPA
// fallback — the ways a static-asset deploy fails while still returning 200.
// Sign-in needs a trusted origin, so it is not covered.
//
//   node scripts/smoke-deployment.mjs <origin>

const origin = process.argv[2]?.replace(/\/$/, "");

if (!origin) {
  console.error("✗ Usage: smoke-deployment.mjs <origin>");
  process.exit(1);
}

const failures = [];
const notes = [];

async function get(path) {
  const url = `${origin}${path}`;
  const response = await fetch(url, { redirect: "follow" });
  return { url, response, body: await response.text() };
}

try {
  const root = await get("/");

  if (!root.response.ok) {
    failures.push(`GET / returned ${root.response.status}`);
  }
  if (!root.body.includes('<div id="root"')) {
    failures.push("GET / did not return the application shell");
  }

  const assets = [
    ...root.body.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g),
  ].map((match) => match[1]);

  if (assets.length === 0) {
    failures.push("Served HTML references no hashed assets");
  }

  for (const asset of assets.slice(0, 4)) {
    const { response } = await get(asset);
    if (!response.ok) {
      failures.push(`Asset ${asset} returned ${response.status}`);
    } else {
      notes.push(`asset ${asset} → ${response.status}`);
    }
  }

  const deepLink = await get("/areas");
  if (!deepLink.response.ok) {
    failures.push(
      `SPA fallback GET /areas returned ${deepLink.response.status}`,
    );
  } else if (!deepLink.body.includes('<div id="root"')) {
    failures.push("SPA fallback did not return the application shell");
  } else {
    notes.push("SPA fallback /areas → 200");
  }
} catch (error) {
  failures.push(`Request failed: ${error.message}`);
}

console.log(`Smoke test: ${origin}`);
for (const note of notes) console.log(`  ✓ ${note}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

console.log("✓ Deployment serves the application.");
