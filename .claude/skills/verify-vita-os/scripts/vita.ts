#!/usr/bin/env bun
// vita: launch, drive, and prove a local Vita OS instance for verification.
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
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../../../..");
const VERIFY_DIR = join(ROOT, ".verify");
const API_DIR = join(ROOT, "apps/api");
const WEB_DIR = join(ROOT, "apps/web");

const HELP = `vita: launch, drive, and prove a local Vita OS instance.

Every command prints one JSON object on stdout: {"ok":true,...} or {"ok":false,"error":...,"hint":...}.
Instances are isolated by name (--instance <name> or VITA_INSTANCE, default "main"): own ports, own
local D1, own browser session. Evidence lives in .verify/evidence/<instance>/<run>/ and survives "down".

Commands:
  up [--web-port N] [--api-port N]   Migrate a private local D1, start the API (wrangler dev) and web (vite),
                                     wait for both, create the throwaway user. Idempotent: a healthy
                                     instance is reused.
  doctor                             Read-only health check of this instance. Run first when anything looks off.
  signin                             Sign in through the real /sign-in form, then confirm the session via the API.
  browser -- <agent-browser args>    Run agent-browser in this instance's session, e.g.
                                     vita browser -- snapshot -i
                                     vita browser -- find role button click --name "New note"
  open <path>                        Open a web path (e.g. / or /threads/x) and wait for the app shell.
  shot <label>                       Save <label>.png (screenshot) and <label>.aria.txt (snapshot) as evidence.
  d1 "<SELECT ...>"                  Read-only SQL against this instance's local D1 (SELECT only).
  env                                Print URLs, credentials, session name, and evidence dir.
  down [--dry-run] [--purge]         Stop only the processes this instance started, close its browser
                                     session. --purge also deletes its local D1. Evidence is kept.

Examples:
  bun run verify up && bun run verify signin
  bun run verify browser -- find role button click --name "New note"
  VITA_INSTANCE=b bun run verify up      # a second, fully isolated stack
`;

type State = {
  instance: string;
  runId: string;
  webPort: number;
  apiPort: number;
  inspectorPort: number;
  webUrl: string;
  apiUrl: string;
  persistDir: string;
  logsDir: string;
  evidenceDir: string;
  session: string;
  email: string;
  password: string;
  pids: { api?: number; web?: number };
  gitSha: string;
  startedAt: string;
};

class VitaError extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
  }
}

function out(value: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv: string[]) {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  let passthrough: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") {
      passthrough = argv.slice(i + 1);
      break;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (
        next !== undefined &&
        !next.startsWith("--") &&
        ["instance", "web-port", "api-port"].includes(key)
      ) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else positional.push(arg);
  }
  return { flags, positional, passthrough };
}

const instanceDir = (instance: string) =>
  join(VERIFY_DIR, "instances", instance);
const statePath = (instance: string) =>
  join(instanceDir(instance), "state.json");

function loadState(instance: string): State | undefined {
  const path = statePath(instance);
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as State)
    : undefined;
}

function requireState(instance: string): State {
  const state = loadState(instance);
  if (!state)
    throw new VitaError(
      `instance "${instance}" is not up`,
      `run: bun run verify up${instance === "main" ? "" : ` --instance ${instance}`}`,
    );
  return state;
}

function saveState(state: State): void {
  mkdirSync(instanceDir(state.instance), { recursive: true });
  writeFileSync(statePath(state.instance), JSON.stringify(state, null, 2));
}

function alive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
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
  init?: RequestInit,
): Promise<{ status: number; body: string } | undefined> {
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(5000),
    });
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
    await Bun.sleep(500);
  }
  throw new VitaError(
    `${what} not ready after ${timeoutMs / 1000}s`,
    `read the log: ${log}`,
  );
}

function run(cmd: string[], cwd: string, env: Record<string, string> = {}) {
  const res = spawnSync(cmd[0], cmd.slice(1), {
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

function startDetached(
  cmd: string[],
  cwd: string,
  logFile: string,
  env: Record<string, string>,
): number {
  const fd = openSync(logFile, "a");
  const child = spawn(cmd[0], cmd.slice(1), {
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

function killGroup(pid: number | undefined): void {
  if (!alive(pid)) return;
  try {
    process.kill(-pid!, "SIGTERM");
  } catch {
    process.kill(pid!, "SIGTERM");
  }
}

const BROWSER_TIMEOUT_MS = 60_000;

// Chrome stops producing frames while a Mac's display sleeps, which hangs screenshots.
// This flag keeps frames coming without vsync. Launch args apply when a session starts.
const CHROME_ARGS = "--disable-frame-rate-limit";

function browserEnv(): NodeJS.ProcessEnv {
  const existing = process.env.AGENT_BROWSER_ARGS;
  const args = existing?.includes(CHROME_ARGS)
    ? existing
    : [existing, CHROME_ARGS].filter(Boolean).join(",");
  return { ...process.env, AGENT_BROWSER_ARGS: args };
}

function agentBrowser(
  state: State,
  args: string[],
  opts: { inherit?: boolean } = {},
) {
  const full = ["--session", state.session, ...args];
  if (opts.inherit)
    return (
      spawnSync("agent-browser", full, {
        stdio: "inherit",
        env: browserEnv(),
        timeout: BROWSER_TIMEOUT_MS * 3,
      }).status ?? 1
    );
  const res = spawnSync("agent-browser", full, {
    encoding: "utf8",
    env: browserEnv(),
    timeout: BROWSER_TIMEOUT_MS,
  });
  if (res.error && (res.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
    throw new VitaError(
      `agent-browser ${args[0]} did not finish within ${BROWSER_TIMEOUT_MS / 1000}s`,
      `run: bun run verify down && bun run verify up to relaunch the browser with ${CHROME_ARGS}; see Gotchas in the skill`,
    );
  }
  if (res.status !== 0) {
    throw new VitaError(
      `agent-browser ${args.join(" ")} failed: ${(res.stderr || res.stdout).trim().slice(0, 500)}`,
      "run: bun run verify doctor, then retry",
    );
  }
  return res.stdout.trim();
}

async function apiHealthy(state: Pick<State, "apiUrl">): Promise<boolean> {
  const ok = await httpStatus(`${state.apiUrl}/api/auth/ok`);
  return ok?.status === 200;
}

async function webHealthy(state: Pick<State, "webUrl">): Promise<boolean> {
  const root = await httpStatus(`${state.webUrl}/`);
  return root?.status === 200 && root.body.includes('<div id="root"');
}

async function ensureUser(state: State): Promise<"created" | "exists"> {
  const res = await httpStatus(`${state.apiUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: state.webUrl },
    body: JSON.stringify({
      name: "Verify Bot",
      email: state.email,
      password: state.password,
    }),
  });
  if (res?.status === 200) return "created";
  if (res && res.status === 422 && /exist/i.test(res.body)) return "exists";
  throw new VitaError(
    `sign-up failed: ${res ? `${res.status} ${res.body.slice(0, 300)}` : "no response"}`,
    "run: bun run verify doctor",
  );
}

async function up(instance: string, flags: Record<string, string | true>) {
  const existing = loadState(instance);
  if (
    existing &&
    alive(existing.pids.api) &&
    alive(existing.pids.web) &&
    (await apiHealthy(existing)) &&
    (await webHealthy(existing))
  ) {
    return { ok: true, reused: true, ...publicEnv(existing) };
  }
  if (existing)
    await down(instance, { dryRun: false, purge: false, quiet: true });

  const apiPort = flags["api-port"]
    ? Number(flags["api-port"])
    : await freePort(8787);
  const webPort = flags["web-port"]
    ? Number(flags["web-port"])
    : await freePort(5173, [apiPort]);
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

  const dir = instanceDir(instance);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const state: State = {
    instance,
    runId,
    webPort,
    apiPort,
    inspectorPort,
    webUrl: `http://localhost:${webPort}`,
    apiUrl: `http://localhost:${apiPort}`,
    persistDir: join(dir, "d1"),
    logsDir: join(dir, "logs"),
    evidenceDir: join(VERIFY_DIR, "evidence", instance, runId),
    session: `${run(["agent-browser", "session", "id", "--scope", "worktree", "--prefix", "vita"], ROOT).stdout.trim() || "vita"}-${instance}`,
    email: `verify-${instance}-${randomBytes(3).toString("hex")}@vita.test`,
    password: randomBytes(12).toString("base64url"),
    pids: {},
    gitSha: run(["git", "rev-parse", "--short", "HEAD"], ROOT).stdout.trim(),
    startedAt: new Date().toISOString(),
  };
  for (const d of [state.persistDir, state.logsDir, state.evidenceDir])
    mkdirSync(d, { recursive: true });

  const migrate = run(
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
  writeFileSync(
    join(state.logsDir, "migrate.log"),
    migrate.stdout + migrate.stderr,
  );
  if (migrate.code !== 0)
    throw new VitaError(
      "local D1 migration failed",
      `read the log: ${join(state.logsDir, "migrate.log")}`,
    );

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

  const user = await ensureUser(state);
  saveState(state);
  return { ok: true, reused: false, user, ...publicEnv(state) };
}

function publicEnv(state: State) {
  return {
    instance: state.instance,
    webUrl: state.webUrl,
    apiUrl: state.apiUrl,
    session: state.session,
    email: state.email,
    password: state.password,
    evidenceDir: state.evidenceDir,
    logsDir: state.logsDir,
    gitSha: state.gitSha,
  };
}

async function doctor(instance: string) {
  const state = requireState(instance);
  const anon = await httpStatus(`${state.apiUrl}/v1/areas`);
  const checks = {
    apiProcess: alive(state.pids.api),
    webProcess: alive(state.pids.web),
    apiAuthOk: await apiHealthy(state),
    apiRejectsAnonymous: anon?.status === 401,
    webServesShell: await webHealthy(state),
    buildMatchesHead:
      run(["git", "rev-parse", "--short", "HEAD"], ROOT).stdout.trim() ===
      state.gitSha,
  };
  const healthy = Object.values(checks).every(Boolean);
  return {
    ok: healthy,
    checks,
    ...(healthy
      ? {}
      : {
          error: "instance unhealthy",
          hint: `read ${state.logsDir}/*.log, then run: bun run verify down && bun run verify up`,
        }),
    ...publicEnv(state),
  };
}

async function signin(instance: string) {
  const state = requireState(instance);
  // Pin a desktop viewport above the 1280px thread-pane breakpoint so runs don't depend on the browser default.
  agentBrowser(state, ["set", "viewport", "1440", "900"]);
  agentBrowser(state, ["open", `${state.webUrl}/sign-in`]);
  agentBrowser(state, [
    "wait",
    "--text",
    "Sign in to your account to continue",
  ]);
  agentBrowser(state, ["find", "label", "Email", "fill", state.email]);
  agentBrowser(state, ["find", "label", "Password", "fill", state.password]);
  agentBrowser(state, [
    "find",
    "role",
    "button",
    "click",
    "--name",
    "Sign In",
    "--exact",
  ]);
  agentBrowser(state, ["wait", 'nav[aria-label="Primary"]']);
  const raw = agentBrowser(state, [
    "eval",
    `fetch(${JSON.stringify(`${state.apiUrl}/api/auth/get-session`)}, { credentials: "include" }).then(r => r.json()).then(s => s?.user?.email ?? null)`,
  ]);
  const sessionEmail = raw.replace(/^"|"$/g, "");
  if (sessionEmail !== state.email) {
    throw new VitaError(
      `signed-in session is "${sessionEmail}", expected ${state.email}`,
      "run: bun run verify shot signin-failed and inspect it",
    );
  }
  return {
    ok: true,
    signedInAs: sessionEmail,
    url: agentBrowser(state, ["get", "url"]),
  };
}

async function open(instance: string, path: string | undefined) {
  if (!path) throw new VitaError("missing path", 'usage: vita open "/"');
  const state = requireState(instance);
  agentBrowser(state, [
    "open",
    `${state.webUrl}${path.startsWith("/") ? path : `/${path}`}`,
  ]);
  agentBrowser(state, ["wait", 'nav[aria-label="Primary"]']);
  return { ok: true, url: agentBrowser(state, ["get", "url"]) };
}

async function shot(instance: string, label: string | undefined) {
  if (!label || !/^[\w.-]+$/.test(label))
    throw new VitaError(
      "missing or invalid label",
      "usage: vita shot <label> (letters, digits, . _ -)",
    );
  const state = requireState(instance);
  mkdirSync(state.evidenceDir, { recursive: true });
  const png = join(state.evidenceDir, `${label}.png`);
  const aria = join(state.evidenceDir, `${label}.aria.txt`);
  writeFileSync(aria, agentBrowser(state, ["snapshot", "-c"]));
  const url = agentBrowser(state, ["get", "url"]);
  agentBrowser(state, ["screenshot", png]);
  return { ok: true, screenshot: png, snapshot: aria, url };
}

async function d1(instance: string, sql: string | undefined) {
  if (!sql || !/^\s*select\b/i.test(sql) || /;\s*\S/.test(sql))
    throw new VitaError(
      "d1 accepts a single SELECT statement",
      'usage: vita d1 "SELECT body FROM notes"',
    );
  const state = requireState(instance);
  const res = run(
    [
      "bunx",
      "wrangler",
      "d1",
      "execute",
      "vita-os-local",
      "--local",
      "--persist-to",
      state.persistDir,
      "--json",
      "--command",
      sql,
    ],
    API_DIR,
    { CI: "1" },
  );
  if (res.code !== 0)
    throw new VitaError(
      `query failed: ${(res.stderr || res.stdout).trim().slice(0, 500)}`,
      "check the table and column names in apps/api/migrations",
    );
  const parsed = JSON.parse(res.stdout) as { results: unknown[] }[];
  return { ok: true, rows: parsed[0]?.results ?? [] };
}

async function down(
  instance: string,
  opts: { dryRun: boolean; purge: boolean; quiet?: boolean },
) {
  const state = loadState(instance);
  if (!state)
    return { ok: true, instance, stopped: false, note: "instance was not up" };
  const plan = {
    kill: Object.entries(state.pids)
      .filter(([, pid]) => alive(pid))
      .map(([name, pid]) => `${name}:${pid}`),
    closeSession: state.session,
    deleteD1: opts.purge ? state.persistDir : null,
    keepEvidence: dirname(state.evidenceDir),
  };
  if (opts.dryRun) return { ok: true, dryRun: true, plan };
  killGroup(state.pids.web);
  killGroup(state.pids.api);
  const deadline = Date.now() + 10_000;
  while (
    Date.now() < deadline &&
    (alive(state.pids.api) || alive(state.pids.web))
  )
    await Bun.sleep(250);
  for (const pid of [state.pids.api, state.pids.web])
    if (alive(pid)) process.kill(-pid!, "SIGKILL");
  spawnSync("agent-browser", ["--session", state.session, "close"], {
    stdio: "ignore",
  });
  rmSync(statePath(instance), { force: true });
  if (opts.purge) rmSync(state.persistDir, { recursive: true, force: true });
  return { ok: true, stopped: true, plan };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { flags, positional, passthrough } = parseArgs(rest);
  const instance = String(
    flags.instance ?? process.env.VITA_INSTANCE ?? "main",
  );
  if (!/^[a-z0-9-]+$/.test(instance))
    throw new VitaError(
      `invalid instance name "${instance}"`,
      "use lowercase letters, digits, and dashes",
    );
  switch (command) {
    case "up":
      return out(await up(instance, flags));
    case "doctor":
      return out(await doctor(instance));
    case "signin":
      return out(await signin(instance));
    case "open":
      return out(await open(instance, positional[0]));
    case "shot":
      return out(await shot(instance, positional[0]));
    case "d1":
      return out(await d1(instance, positional[0]));
    case "env":
      return out({ ok: true, ...publicEnv(requireState(instance)) });
    case "down":
      return out(
        await down(instance, {
          dryRun: flags["dry-run"] === true,
          purge: flags.purge === true,
        }),
      );
    case "browser": {
      if (passthrough.length === 0)
        throw new VitaError(
          "nothing to run",
          "usage: vita browser -- snapshot -i",
        );
      process.exit(
        agentBrowser(requireState(instance), passthrough, {
          inherit: true,
        }) as number,
      );
    }
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(HELP);
      return;
    default:
      throw new VitaError(
        `unknown command "${command}"`,
        "run: bun run verify --help",
      );
  }
}

main().catch((err: unknown) => {
  if (err instanceof VitaError)
    out({ ok: false, error: err.message, hint: err.hint });
  else
    out({
      ok: false,
      error: String(err instanceof Error ? err.stack : err),
      hint: "unexpected failure; read .verify/instances/<instance>/logs",
    });
  process.exit(1);
});
