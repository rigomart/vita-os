#!/usr/bin/env node
// Checks which Worker a build is about to replace. dist/wrangler.json — not
// wrangler.jsonc — decides that, so it is what gets asserted.
//
//   node scripts/assert-deploy-target.mjs <expected-worker-name> [distDir]
//
// EXPECT_CUSTOM_DOMAIN names the hostname production must serve. Unset means
// the build must carry none: a staging build that inherited vita.rigos.dev
// would take over production on deploy.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const [expectedName, distArg] = process.argv.slice(2);
const distDir = resolve(distArg ?? "dist");
const configPath = join(distDir, "wrangler.json");
const expectedDomain = process.env.EXPECT_CUSTOM_DOMAIN?.trim();

if (!expectedName) {
  console.error("✗ Usage: assert-deploy-target.mjs <expected-worker-name>");
  process.exit(1);
}

let config;
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch (error) {
  console.error(
    `✗ Could not read ${configPath}. Run \`vite build\` with CLOUDFLARE_ENV set before deploying.`,
  );
  console.error(`  ${error.message}`);
  process.exit(1);
}

const failures = [];

if (config.name !== expectedName) {
  failures.push(
    `Worker name is "${config.name}", expected "${expectedName}". ` +
      "Check that CLOUDFLARE_ENV matched the intended environment at build time.",
  );
}

const customDomains = (config.routes ?? [])
  .filter((route) => route?.custom_domain)
  .map((route) => route.pattern);

if (expectedDomain) {
  if (!customDomains.includes(expectedDomain)) {
    failures.push(
      `Expected custom domain "${expectedDomain}", found ${
        customDomains.length ? customDomains.join(", ") : "none"
      }.`,
    );
  }
} else if (customDomains.length > 0) {
  failures.push(
    `Build carries custom domain(s) ${customDomains.join(", ")} but this ` +
      "environment must not serve one. Deploying would move a production hostname.",
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log(
  `✓ Deploy target is "${config.name}" with ${
    expectedDomain ? `custom domain ${expectedDomain}` : "no custom domain"
  }.`,
);
