#!/usr/bin/env node
// Guards route splitting: the sign-in page must not download the authenticated
// app. Run after `vite build`, from apps/web (or pass a dist path).
//
//   node scripts/check-chunks.mjs [distDir]
//
// The check walks the static import graph of the built chunks — everything the
// browser fetches before it can run the sign-in route — and fails if any chunk
// carrying the authenticated shell ends up inside it.

import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const distDir = resolve(process.argv[2] ?? "dist");
const assetsDir = join(distDir, "assets");

// Copy that only exists in the authenticated shell. If a marker stops matching
// anything at all the check fails too, so renamed copy cannot silently pass.
const AUTHENTICATED_MARKERS = [
  "Vita OS home",
  "Jump to an area, thread, or action",
  "What's on your mind?",
];

const STATIC_IMPORT =
  /(?:^|[\s,;}])(?:import|from)\s*["'](\.\/[^"']+\.js)["']/g;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function readChunks() {
  const chunks = new Map();
  for (const name of readdirSync(assetsDir)) {
    if (!name.endsWith(".js")) continue;
    chunks.set(name, readFileSync(join(assetsDir, name), "utf8"));
  }
  return chunks;
}

function staticImportsOf(source) {
  const imports = new Set();
  for (const [, specifier] of source.matchAll(STATIC_IMPORT)) {
    imports.add(basename(specifier));
  }
  return imports;
}

function closure(chunks, roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.pop();
    if (name === undefined || seen.has(name)) continue;
    const source = chunks.get(name);
    if (source === undefined) continue;
    seen.add(name);
    queue.push(...staticImportsOf(source));
  }
  return seen;
}

const chunks = readChunks();
if (chunks.size === 0) {
  fail(`no JavaScript chunks in ${assetsDir} — run \`vite build\` first`);
  process.exit(1);
}

const html = readFileSync(join(distDir, "index.html"), "utf8");
const entry = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
if (entry === undefined) {
  fail("could not find the entry script in dist/index.html");
  process.exit(1);
}

const signInChunks = [...chunks.keys()].filter((name) =>
  name.startsWith("sign-in-"),
);
if (signInChunks.length === 0) {
  fail("no sign-in chunk — the sign-in route is no longer code split");
  process.exit(1);
}

// Everything the browser has loaded once the sign-in route is on screen.
const signInGraph = closure(chunks, [entry, ...signInChunks]);

for (const marker of AUTHENTICATED_MARKERS) {
  const carriers = [...chunks].filter(([, source]) => source.includes(marker));
  if (carriers.length === 0) {
    fail(
      `marker ${JSON.stringify(marker)} matched no chunk — update this script`,
    );
    continue;
  }
  const leaked = carriers.filter(([name]) => signInGraph.has(name));
  if (leaked.length > 0) {
    fail(
      `sign-in loads the authenticated app: ${JSON.stringify(marker)} is in ` +
        leaked.map(([name]) => name).join(", "),
    );
  }
}

if (process.exitCode === 1) {
  console.error("\nsign-in graph:", [...signInGraph].sort().join("\n  "));
  process.exit(1);
}

console.log(
  `✓ sign-in stays split: ${signInGraph.size} chunk(s) reachable, ` +
    `${chunks.size - signInGraph.size} chunk(s) deferred`,
);
