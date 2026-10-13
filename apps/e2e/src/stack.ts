// The isolated local stack behind a verify instance: a private local D1, the API on `wrangler dev`, and the web app on
// Vite. No browser. Used by the `bun run verify` CLI and by Playwright's global setup, so it runs on Bun and on Node.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, openSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  API_DIR,
  instancePaths,
  loadState,
  requireState,
  ROOT,
  saveState,
  type State,
  VERIFY_DIR,
  verifyCommand,
  VitaError,
  WEB_DIR,
} from "./instance.ts";

/**
 * Whether the group led by `pid` still runs one of our processes (wrangler, workerd, vite). Every recorded pid leads its
 * own group; after a reboot the same pid may lead someone else's group, which counts as gone and is never signalled.
 */
function groupAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  const ps = run(["ps", "-A", "-o", "pgid=,command="], ROOT);
  if (ps.code !== 0)
    throw new VitaError(
      `ps failed: ${ps.stderr.trim()}`,
      "check that ps is on PATH",
    );
  return ps.stdout.split("\n").some((line) => {
    const [, pgid, command] = /^\s*(\d+)\s+(.*)$/.exec(line) ?? [];
    return Number(pgid) === pid && /wrangler|workerd|vite/.test(command!);
  });
}

/** Signals the process group led by `pid`, never a bare pid. A group that is already gone is fine. */
function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

function portFree(port: number): Promise<boolean> {
  const tryHost = (host: string) =>
    new Promise<boolean>((res) => {
      const server = createServer();
      server.once("error", (err: NodeJS.ErrnoException) =>
        res(err.code === "EADDRNOTAVAIL"),
      );
      server.listen({ port, host, exclusive: true }, () =>
        server.close(() => res(true)),
      );
    });
  return Promise.all([tryHost("127.0.0.1"), tryHost("::1")]).then((r) =>
    r.every(Boolean),
  );
}

async function freePort(
  preferred: number,
  taken: number[] = [],
): Promise<number> {
  for (let port = preferred; port < preferred + 200; port++) {
    if (!taken.includes(port) && (await portFree(port))) return port;
  }
  throw new VitaError(
    `no free port near ${preferred}`,
    "stop other dev servers or pass --web-port/--api-port",
  );
}

async function httpStatus(
  url: string,
): Promise<{ status: number; body: string } | undefined> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { status: res.status, body: await res.text() };
  } catch {
    return undefined;
  }
}

async function waitFor(
  what: string,
  check: () => Promise<boolean>,
  timeoutMs: number,
  log: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(500);
  }
  throw new VitaError(
    `${what} not ready after ${timeoutMs / 1000}s`,
    `read the log: ${log}`,
  );
}

function run(cmd: string[], cwd: string, env: Record<string, string> = {}) {
  const res = spawnSync(cmd[0]!, cmd.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    code: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

/** Starts `cmd` as the leader of its own process group, so `down` can stop it and everything it spawned. */
function startDetached(
  cmd: string[],
  cwd: string,
  logFile: string,
  env: Record<string, string>,
): number {
  const fd = openSync(logFile, "a");
  const child = spawn(cmd[0]!, cmd.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  if (!child.pid)
    throw new VitaError(
      `failed to start ${cmd.join(" ")}`,
      `read the log: ${logFile}`,
    );
  return child.pid;
}

async function apiHealthy(state: Pick<State, "apiUrl">): Promise<boolean> {
  const ok = await httpStatus(`${state.apiUrl}/api/auth/ok`);
  return ok?.status === 200;
}

async function webHealthy(state: Pick<State, "webUrl">): Promise<boolean> {
  const root = await httpStatus(`${state.webUrl}/`);
  return root?.status === 200 && root.body.includes('<div id="root"');
}

function currentBranch() {
  return run(["git", "rev-parse", "--abbrev-ref", "HEAD"], ROOT).stdout.trim();
}

/** Applies the migrations the instance's local D1 lacks (none on a current one), logging to migrate.log. */
function migrate(state: Pick<State, "persistDir" | "logsDir">): void {
  const res = run(
    [
      "bunx",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "vita-os-local",
      "--local",
      "--persist-to",
      state.persistDir,
    ],
    API_DIR,
    { CI: "1" },
  );
  const log = join(state.logsDir, "migrate.log");
  writeFileSync(log, res.stdout + res.stderr);
  if (res.code !== 0)
    throw new VitaError("local D1 migration failed", `read the log: ${log}`);
}

export function publicEnv(state: State) {
  return {
    instance: state.instance,
    webUrl: state.webUrl,
    apiUrl: state.apiUrl,
    evidenceDir: state.evidenceDir,
    logsDir: state.logsDir,
    gitSha: state.gitSha,
  };
}

export type UpOptions = { webPort?: number; apiPort?: number };

/** Starts the instance, or reuses it when it is already up and healthy, with any new migrations applied. */
export async function up(instance: string, opts: UpOptions = {}) {
  const existing = loadState(instance);
  // Vite and wrangler serve the working tree, so a commit changes nothing; another branch may need other migrations.
  if (existing && existing.branch !== currentBranch())
    throw new VitaError(
      `instance "${instance}" was started on branch ${existing.branch}, and its local D1 may not fit ${currentBranch()}`,
      `run: ${verifyCommand(instance, "down --purge")} && ${verifyCommand(instance, "up")}`,
    );
  if (
    existing &&
    groupAlive(existing.pids.api) &&
    groupAlive(existing.pids.web) &&
    (await apiHealthy(existing)) &&
    (await webHealthy(existing))
  ) {
    migrate(existing);
    return { ok: true, reused: true, ...publicEnv(existing) };
  }
  if (existing) await down(instance, { dryRun: false, purge: false });

  // Above the ports `bun run dev` (5173, 8787) and the design lab (5174) use, so neither collides with an instance.
  const apiPort = opts.apiPort ?? (await freePort(8790));
  const webPort = opts.webPort ?? (await freePort(5180, [apiPort]));
  const inspectorPort = await freePort(9230, [apiPort, webPort]);
  for (const [name, port] of [
    ["api", apiPort],
    ["web", webPort],
  ] as const) {
    if (!(await portFree(port)))
      throw new VitaError(
        `${name} port ${port} is in use`,
        "pick another with --api-port/--web-port, or omit it to auto-pick",
      );
  }

  const paths = instancePaths(instance);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const state: State = {
    instance,
    runId,
    webPort,
    apiPort,
    inspectorPort,
    webUrl: `http://localhost:${webPort}`,
    apiUrl: `http://localhost:${apiPort}`,
    persistDir: paths.persistDir,
    logsDir: paths.logsDir,
    evidenceDir: join(VERIFY_DIR, "evidence", instance, runId),
    pids: {},
    gitSha: run(["git", "rev-parse", "--short", "HEAD"], ROOT).stdout.trim(),
    branch: currentBranch(),
    startedAt: new Date().toISOString(),
  };
  for (const d of [state.persistDir, state.logsDir, state.evidenceDir])
    mkdirSync(d, { recursive: true });

  migrate(state);

  const apiLog = join(state.logsDir, "api.log");
  state.pids.api = startDetached(
    [
      "bunx",
      "wrangler",
      "dev",
      "--port",
      String(apiPort),
      "--inspector-port",
      String(inspectorPort),
      "--persist-to",
      state.persistDir,
      "--var",
      `BETTER_AUTH_SECRET:${randomBytes(24).toString("hex")}`,
      "--var",
      `BETTER_AUTH_URL:${state.apiUrl}`,
      "--var",
      `BROWSER_ORIGIN:${state.webUrl}`,
    ],
    API_DIR,
    apiLog,
    { CI: "1" },
  );
  saveState(state);
  await waitFor("API", () => apiHealthy(state), 90_000, apiLog);

  const webLog = join(state.logsDir, "web.log");
  state.pids.web = startDetached(
    ["bunx", "vite", "--port", String(webPort), "--strictPort"],
    WEB_DIR,
    webLog,
    { VITE_API_BASE_URL: state.apiUrl },
  );
  saveState(state);
  await waitFor("web", () => webHealthy(state), 90_000, webLog);

  return { ok: true, reused: false, ...publicEnv(state) };
}

export async function doctor(instance: string) {
  const state = requireState(instance);
  const anon = await httpStatus(`${state.apiUrl}/v1/areas`);
  const checks = {
    apiProcess: groupAlive(state.pids.api),
    webProcess: groupAlive(state.pids.web),
    apiAuthOk: await apiHealthy(state),
    apiRejectsAnonymous: anon?.status === 401,
    webServesShell: await webHealthy(state),
    branchMatches: currentBranch() === state.branch,
  };
  const healthy = Object.values(checks).every(Boolean);
  return {
    ok: healthy,
    checks,
    ...(healthy
      ? {}
      : {
          error: "instance unhealthy",
          hint: checks.branchMatches
            ? `read ${state.logsDir}/*.log, then run: ${verifyCommand(instance, "down")} && ${verifyCommand(instance, "up")}`
            : `you switched branches since up, and the other branch may need other migrations: run ${verifyCommand(instance, "down --purge")} && ${verifyCommand(instance, "up")}`,
        }),
    ...publicEnv(state),
  };
}

/** Stops the process groups this instance started. `purge` also deletes its local D1. Evidence is kept. */
export async function down(
  instance: string,
  opts: { dryRun: boolean; purge: boolean },
) {
  const state = loadState(instance);
  if (!state) {
    if (opts.purge && !opts.dryRun)
      rmSync(instancePaths(instance).persistDir, {
        recursive: true,
        force: true,
      });
    return { ok: true, instance, stopped: false, note: "instance was not up" };
  }
  const groups = Object.entries(state.pids).filter(([, pid]) =>
    groupAlive(pid),
  );
  const plan = {
    signalGroups: groups.map(([name, pid]) => `${name}:-${pid}`),
    closeLegacyBrowserSession: state.session ?? null,
    deleteD1: opts.purge ? instancePaths(instance).persistDir : null,
    keepEvidence: dirname(state.evidenceDir),
  };
  if (opts.dryRun) return { ok: true, dryRun: true, plan };

  for (const [, pid] of groups) signalGroup(pid, "SIGTERM");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && groups.some(([, pid]) => groupAlive(pid)))
    await sleep(250);
  for (const [, pid] of groups)
    if (groupAlive(pid)) signalGroup(pid, "SIGKILL");

  // Only for instances started by the old agent-browser CLI, which kept a browser per instance; delete after the transition.
  if (state.session)
    spawnSync("agent-browser", ["--session", state.session, "close"], {
      stdio: "ignore",
      timeout: 15_000,
    });

  rmSync(instancePaths(instance).state, { force: true });
  if (opts.purge)
    rmSync(instancePaths(instance).persistDir, {
      recursive: true,
      force: true,
    });
  return { ok: true, stopped: true, plan };
}
