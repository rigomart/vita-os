#!/usr/bin/env node
// Checks the resolved Wrangler config for one environment before it deploys:
// the Worker it replaces, the hostname it claims, the D1 database it binds,
// and the origins Better Auth trusts. A placeholder database ID would bind the
// Worker to nothing; a mismatched hostname would break sign-in.
//
//   node scripts/assert-deploy-target.mjs <env> <expected-worker-name> <expected-domain>

import { unstable_readConfig } from "wrangler";

const [environment, expectedName, expectedDomain] = process.argv.slice(2);

if (!environment || !expectedName || !expectedDomain) {
  console.error(
    "✗ Usage: assert-deploy-target.mjs <env> <expected-worker-name> <expected-domain>",
  );
  process.exit(1);
}

const config = unstable_readConfig({
  config: "wrangler.jsonc",
  env: environment,
});
const failures = [];

if (config.name !== expectedName) {
  failures.push(`Worker name is "${config.name}", expected "${expectedName}".`);
}

const customDomains = (config.routes ?? [])
  .filter((route) => route?.custom_domain)
  .map((route) => route.pattern);
if (customDomains.length !== 1 || customDomains[0] !== expectedDomain) {
  failures.push(
    `Expected only custom domain "${expectedDomain}", found ${
      customDomains.length ? customDomains.join(", ") : "none"
    }.`,
  );
}

const database = (config.d1_databases ?? []).find(
  (binding) => binding.binding === "DB",
);
if (!database) {
  failures.push("No D1 database is bound to DB.");
} else if (!database.database_id || /^[0-]+$/.test(database.database_id)) {
  failures.push(
    `D1 database "${database.database_name}" has a placeholder ID. Run ` +
      `\`wrangler d1 create ${database.database_name}\` and commit its ID.`,
  );
}

const authUrl = config.vars?.BETTER_AUTH_URL;
if (authUrl !== `https://${expectedDomain}`) {
  failures.push(
    `BETTER_AUTH_URL is "${authUrl}", expected "https://${expectedDomain}".`,
  );
}

const browserOrigin = config.vars?.BROWSER_ORIGIN;
if (
  typeof browserOrigin !== "string" ||
  !browserOrigin.startsWith("https://")
) {
  failures.push(
    `BROWSER_ORIGIN must be an https origin, got "${browserOrigin}".`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  process.exit(1);
}

console.log(
  `✓ Deploy target is "${config.name}" at ${expectedDomain}, bound to D1 ` +
    `"${database.database_name}", trusting ${browserOrigin}.`,
);
