// Builds the main process and the preload, and copies the migrations main applies.
import { cp, rm } from "node:fs/promises";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const dist = join(root, "dist");

await Promise.all(
  ["main", "preload", "migrations"].map((dir) =>
    rm(join(dist, dir), { recursive: true, force: true }),
  ),
);

const builds = await Promise.all([
  Bun.build({
    entrypoints: [join(root, "src/main/main.ts")],
    outdir: join(dist, "main"),
    target: "node",
    format: "esm",
    // The native libsql binding loads at runtime, from node_modules.
    external: ["electron", "@libsql/client"],
    sourcemap: "linked",
  }),
  Bun.build({
    entrypoints: [join(root, "src/preload/preload.ts")],
    outdir: join(dist, "preload"),
    // A sandboxed preload must be CommonJS.
    target: "node",
    format: "cjs",
    external: ["electron"],
    naming: "[name].cjs",
  }),
]);

for (const build of builds) {
  if (!build.success) {
    for (const log of build.logs) console.error(log);
    process.exit(1);
  }
}

await cp(join(root, "../api/migrations"), join(dist, "migrations"), {
  recursive: true,
});
