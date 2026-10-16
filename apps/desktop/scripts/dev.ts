// Builds main and the preload, serves the renderer from Vite (hot reload), and runs Electron on it.
// Main and preload changes need a restart. Data goes to apps/desktop/.dev-user-data unless
// VITA_DESKTOP_USER_DATA names another folder, so dev never touches the installed app's data.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createServer } from "vite";

const root = join(import.meta.dir, "..");

const built = Bun.spawnSync(["bun", "scripts/build-main.ts"], {
  cwd: root,
  stdio: ["inherit", "inherit", "inherit"],
});
if (built.exitCode !== 0) process.exit(built.exitCode ?? 1);

const server = await createServer({
  root,
  configFile: join(root, "vite.config.ts"),
});
await server.listen();
const rendererUrl = server.resolvedUrls?.local[0];
if (!rendererUrl) throw new Error("Vite did not report a local URL.");
server.printUrls();

// A host shell (like an Electron-based editor) may set this, which turns Electron into Node.
const { ELECTRON_RUN_AS_NODE: _, ...env } = process.env;
const electron = spawn(
  createRequire(import.meta.url)("electron") as string,
  [root],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...env,
      VITA_DESKTOP_RENDERER_URL: rendererUrl,
      VITA_DESKTOP_USER_DATA:
        env.VITA_DESKTOP_USER_DATA ?? join(root, ".dev-user-data"),
    },
  },
);
electron.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
