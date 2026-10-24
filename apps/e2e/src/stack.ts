// Used by the verify CLI (Bun); node: APIs only, so it also loads under Node.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import {
  API_DIR,
  browserSession,
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

/** A pid recorded before a reboot may lead someone else's group: that counts as gone and is never signalled. */
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

function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

/** Pass only groups an `up` started: SIGTERM, then SIGKILL whatever is left after 10s. */
async function stopGroups(pids: (number | undefined)[]): Promise<void> {
  const live = pids.filter((pid) => groupAlive(pid));
  for (const pid of live) signalGroup(pid, "SIGTERM");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && live.some((pid) => groupAlive(pid)))
    await sleep(250);
  for (const pid of live) if (groupAlive(pid)) signalGroup(pid, "SIGKILL");
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

/**
 * A probed port stays free only until someone binds it, so every `up` on this machine, in any checkout, holds this
 * from choosing its ports until its processes have bound them.
 */
const PORT_LOCK = 9129;
/** Held for a moment while an `up` reads or takes an instance's owner file. */
const CLAIM_LOCK = 9128;
const LOCK_WAIT_MS = 300_000;

/** What `up` or `down` throws after SIGINT or SIGTERM; `up` first stops what it started, `down` only stops waiting. */
export class Interrupted extends VitaError {
  constructor(
    command: "up" | "down",
    readonly signal: NodeJS.Signals,
  ) {
    super(
      `${command} stopped by ${signal}`,
      command === "up"
        ? "it stopped the processes it had started; run up again"
        : "it stopped nothing; run down again",
    );
  }
}

/** A machine-wide lock as a listening socket on 127.0.0.1: the OS frees it if its holder dies. */
async function holdPort(
  port: number,
  heldFor: string,
  abort: AbortSignal,
): Promise<() => void> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    abort.throwIfAborted();
    const server = createServer();
    const held = await new Promise<boolean>((res, fail) => {
      server.once("error", (err: NodeJS.ErrnoException) =>
        err.code === "EADDRINUSE" ? res(false) : fail(err),
      );
      server.listen({ port, host: "127.0.0.1", exclusive: true }, () =>
        res(true),
      );
    });
    if (held) return () => server.close();
    if (Date.now() > deadline)
      throw new VitaError(
        `port ${port}, which up holds ${heldFor}, stayed taken for ${LOCK_WAIT_MS / 1000}s`,
        `see what holds it: lsof -nP -iTCP:${port} -sTCP:LISTEN`,
      );
    await sleep(500);
  }
}

/** The pid and start time, so a pid reused after a crash does not count as the same process. */
function processStamp(pid: number): string | undefined {
  // lstart is printed in the caller's time zone and locale, which differ between callers.
  const ps = run(["ps", "-p", String(pid), "-o", "lstart="], ROOT, {
    TZ: "UTC",
    LC_ALL: "C",
  });
  return ps.code === 0 ? `${pid} ${ps.stdout.trim()}` : undefined;
}

/**
 * One `up` or `down` per instance at a time: a second `up` waits and then reuses what the first started, two never
 * migrate one D1 at once, and `down` stops a stack only once its `up` has finished. `up`s of other instances run
 * alongside until they need the port lock.
 */
async function lockInstance(
  instance: string,
  abort: AbortSignal,
): Promise<() => void> {
  const { dir } = instancePaths(instance);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "up.pid");
  const owner = () =>
    existsSync(file) ? readFileSync(file, "utf8") : undefined;
  const mine = processStamp(process.pid)!;
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (true) {
    // Only read or written under CLAIM_LOCK, so two ups never both take it, not even from an owner that was killed.
    const releaseClaim = await holdPort(
      CLAIM_LOCK,
      "while it claims an instance",
      abort,
    );
    let holder: string | undefined;
    try {
      holder = owner();
      const pid = Number(holder?.split(" ")[0]);
      if (!holder || !pid || processStamp(pid) !== holder) {
        writeFileSync(file, mine);
        return () => {
          if (owner() === mine) rmSync(file, { force: true });
        };
      }
    } finally {
      releaseClaim();
    }
    const holderPid = holder.split(" ")[0];
    if (Date.now() > deadline)
      throw new VitaError(
        `instance "${instance}" is busy: verify (pid ${holderPid}) has held it for ${LOCK_WAIT_MS / 1000}s`,
        `wait for it to finish, or stop it with kill -INT ${holderPid}, then run this again`,
      );
    await sleep(500);
  }
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
  pid: number,
  timeoutMs: number,
  log: string,
  abort: AbortSignal,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    abort.throwIfAborted();
    if (!groupAlive(pid))
      throw new VitaError(
        `${what} exited while starting`,
        `read the log: ${log}`,
      );
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

/** Leads its own process group, so `down` can stop it and everything it spawned. */
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
    session: browserSession(state.instance),
    evidenceDir: state.evidenceDir,
    logsDir: state.logsDir,
    gitSha: state.gitSha,
  };
}

export type UpOptions = { webPort?: number; apiPort?: number };

/** Runs `body` holding the instance lock; SIGINT or SIGTERM aborts the signal it gets with Interrupted. */
async function withInstanceLock<T>(
  instance: string,
  command: "up" | "down",
  body: (abort: AbortSignal) => Promise<T>,
): Promise<T> {
  const abort = new AbortController();
  const onSignal = (signal: NodeJS.Signals) =>
    abort.abort(new Interrupted(command, signal));
  process.on("SIGINT", onSignal).on("SIGTERM", onSignal);
  try {
    const unlock = await lockInstance(instance, abort.signal);
    try {
      return await body(abort.signal);
    } finally {
      unlock();
    }
  } finally {
    process.off("SIGINT", onSignal).off("SIGTERM", onSignal);
  }
}

/** Reuses a healthy instance, applying any new migrations. On SIGINT/SIGTERM it stops what it started and throws Interrupted. */
export function up(instance: string, opts: UpOptions = {}) {
  return withInstanceLock(instance, "up", (abort) =>
    upLocked(instance, opts, abort),
  );
}

async function upLocked(instance: string, opts: UpOptions, abort: AbortSignal) {
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
  if (existing) await downLocked(instance, { dryRun: false, purge: false });

  const paths = instancePaths(instance);
  for (const d of [paths.persistDir, paths.logsDir])
    mkdirSync(d, { recursive: true });
  abort.throwIfAborted();
  migrate(paths);

  const unlock = await holdPort(
    PORT_LOCK,
    "while it starts an instance",
    abort,
  );
  try {
    return await start(instance, opts, abort);
  } finally {
    unlock();
  }
}

/**
 * Returns once the API and web are healthy, which is after every port they bind is bound. If it fails, it first stops
 * what it started: a child still starting could otherwise bind a port the next `up` picks once the lock is free.
 */
async function start(instance: string, opts: UpOptions, abort: AbortSignal) {
  // Above the ports `bun run dev` (5173, 8787) and the design lab (5174) use, so neither collides with an instance.
  const apiPort = opts.apiPort ?? (await freePort(8790));
  const webPort = opts.webPort ?? (await freePort(5180, [apiPort]));
  // Below 9229, where the vite plugin scans up from for the web worker's inspector.
  const inspectorPort = await freePort(9130, [apiPort, webPort]);
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
  mkdirSync(state.evidenceDir, { recursive: true });

  try {
    await startProcesses(state, abort);
  } catch (error) {
    await stopGroups(Object.values(state.pids));
    rmSync(paths.state, { force: true });
    throw error;
  }
  return { ok: true, reused: false, ...publicEnv(state) };
}

async function startProcesses(state: State, abort: AbortSignal) {
  abort.throwIfAborted();
  const apiLog = join(state.logsDir, "api.log");
  state.pids.api = startDetached(
    [
      "bunx",
      "wrangler",
      "dev",
      "--port",
      String(state.apiPort),
      "--inspector-port",
      String(state.inspectorPort),
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
  await waitFor(
    "API",
    () => apiHealthy(state),
    state.pids.api,
    90_000,
    apiLog,
    abort,
  );

  abort.throwIfAborted();
  const webLog = join(state.logsDir, "web.log");
  state.pids.web = startDetached(
    ["bunx", "vite", "--port", String(state.webPort), "--strictPort"],
    WEB_DIR,
    webLog,
    { VITE_API_BASE_URL: state.apiUrl },
  );
  saveState(state);
  await waitFor(
    "web",
    () => webHealthy(state),
    state.pids.web,
    90_000,
    webLog,
    abort,
  );
  if (!groupAlive(state.pids.api) || !(await apiHealthy(state)))
    throw new VitaError(
      "API stopped while web was starting",
      `read the log: ${apiLog}`,
    );
  // A signal that came in during the last checks still undoes the start.
  abort.throwIfAborted();
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

/** `close` on a session that is not running starts one first, so close only a listed session. */
function closeBrowser(session: string): void {
  const list = spawnSync("agent-browser", ["session", "list", "--json"], {
    encoding: "utf8",
    timeout: 15_000,
  });
  if (list.status !== 0) return;
  const { data } = JSON.parse(list.stdout) as {
    data?: { sessions?: string[] };
  };
  if (!data?.sessions?.includes(session)) return;
  spawnSync("agent-browser", ["--session", session, "close"], {
    stdio: "ignore",
    timeout: 15_000,
  });
}

type DownOptions = { dryRun: boolean; purge: boolean };

/** `purge` also deletes the local D1. Evidence is kept. Waits for an `up` of the instance in progress, except for a dry run. */
export function down(instance: string, opts: DownOptions) {
  if (opts.dryRun) return downLocked(instance, opts);
  return withInstanceLock(instance, "down", () => downLocked(instance, opts));
}

async function downLocked(instance: string, opts: DownOptions) {
  const state = loadState(instance);
  if (!state) {
    if (!opts.dryRun) closeBrowser(browserSession(instance));
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
    closeBrowserSessions: [browserSession(instance), state.session].filter(
      (session): session is string => session !== undefined,
    ),
    deleteD1: opts.purge ? instancePaths(instance).persistDir : null,
    keepEvidence: dirname(state.evidenceDir),
  };
  if (opts.dryRun) return { ok: true, dryRun: true, plan };

  await stopGroups(groups.map(([, pid]) => pid));

  for (const session of plan.closeBrowserSessions) closeBrowser(session);

  rmSync(instancePaths(instance).state, { force: true });
  if (opts.purge)
    rmSync(instancePaths(instance).persistDir, {
      recursive: true,
      force: true,
    });
  return { ok: true, stopped: true, plan };
}
