import { spawnSync } from "node:child_process";

import { ROOT } from "./instance.ts";

/** Desktop specs drive the built app, so build it first (cached when nothing changed). */
export default function desktopSetup() {
  const result = spawnSync(
    "bunx",
    [
      "turbo",
      "run",
      "build",
      "--filter=@vita-os/desktop",
      "--output-logs=errors-only",
    ],
    { cwd: ROOT, stdio: "inherit" },
  );
  if (result.status !== 0)
    throw new Error(
      `building the desktop app failed (exit ${result.status}); run: bunx turbo run build --filter=@vita-os/desktop`,
    );
}
