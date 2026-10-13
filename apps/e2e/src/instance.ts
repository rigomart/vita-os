// A verify instance: its name, its state file, and read-only SQL against its private local D1. Shared by the stack CLI
// (Bun) and the Playwright fixtures (Node), so it uses only node: APIs and has no side effects on import.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../../..");
export const VERIFY_DIR = join(ROOT, ".verify");
export const API_DIR = join(ROOT, "apps/api");
export const WEB_DIR = join(ROOT, "apps/web");

/** What `up` records about a running instance, in `.verify/instances/<name>/state.json`. */
export type State = {
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
  pids: { api?: number; web?: number };
  gitSha: string;
  branch: string;
  startedAt: string;
  /**
   * Only in state files written by the old agent-browser CLI: its browser session, closed by `down`. It exists only for
   * instances started by that CLI; delete it after the transition.
   */
  session?: string;
};

/** A failure with the next step to take; the CLI prints both as JSON. */
export class VitaError extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
  }
}

/** The instance to use: an explicit `--instance`, else VITA_INSTANCE, else "main". */
export function instanceName(flag?: string): string {
  const name = flag ?? process.env.VITA_INSTANCE ?? "main";
  if (!/^[a-z0-9-]+$/.test(name))
    throw new VitaError(
      `invalid instance name "${name}"`,
      "use lowercase letters, digits, and dashes",
    );
  return name;
}

export function instancePaths(name: string) {
  const dir = join(VERIFY_DIR, "instances", name);
  return {
    dir,
    state: join(dir, "state.json"),
    persistDir: join(dir, "d1"),
    logsDir: join(dir, "logs"),
    playwrightDir: join(dir, "playwright"),
  };
}

export function loadState(name: string): State | undefined {
  const path = instancePaths(name).state;
  return existsSync(path)
    ? (JSON.parse(readFileSync(path, "utf8")) as State)
    : undefined;
}

export function requireState(name: string): State {
  const state = loadState(name);
  if (!state)
    throw new VitaError(
      `instance "${name}" is not up`,
      `run: ${verifyCommand(name, "up")}`,
    );
  return state;
}

/** The `bun run verify <args>` command line for instance `name`; `main` needs no `--instance`. */
export function verifyCommand(name: string, args: string): string {
  return `bun run verify ${args}${name === "main" ? "" : ` --instance ${name}`}`;
}

export function saveState(state: State): void {
  const paths = instancePaths(state.instance);
  mkdirSync(paths.dir, { recursive: true });
  writeFileSync(paths.state, JSON.stringify(state, null, 2));
}

const D1_TIMEOUT_MS = 30_000;

/**
 * Read-only SQL against the instance's local D1: one SELECT statement. Use it only for what the screen cannot show.
 * Two queries against one instance at the same moment fail with "internal error", so run them one at a time.
 */
export async function d1<Row = Record<string, unknown>>(
  sql: string,
  name: string = instanceName(),
): Promise<Row[]> {
  if (!/^\s*select\b/i.test(sql) || /;\s*\S/.test(sql))
    throw new VitaError(
      `d1 accepts a single SELECT statement: ${sql}`,
      "pass one SELECT, e.g. SELECT title FROM threads WHERE user_id = ...",
    );
  const { persistDir } = requireState(name);
  const hint =
    "check the table and column names in apps/api/migrations; run one query at a time per instance";
  const stdout = await new Promise<string>((done, fail) => {
    // Its own process group: on a timeout the whole group goes (bunx, wrangler, workerd), so nothing keeps the D1 open.
    const child = spawn(
      "bunx",
      [
        "wrangler",
        "d1",
        "execute",
        "vita-os-local",
        "--local",
        "--persist-to",
        persistDir,
        "--json",
        "--command",
        sql,
      ],
      {
        cwd: API_DIR,
        env: { ...process.env, CI: "1" },
        detached: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => {
      out += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      err += chunk;
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH")
          fail(
            new VitaError(
              `d1 query timed out and could not be stopped: ${sql}\n${String(error)}`,
              `stop the wrangler processes under ${API_DIR} by hand`,
            ),
          );
      }
    }, D1_TIMEOUT_MS);
    child.on("error", (error) => {
      clearTimeout(timer);
      fail(new VitaError(`d1 query failed: ${sql}\n${error.message}`, hint));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && !timedOut) return done(out);
      fail(
        new VitaError(
          timedOut
            ? `d1 query did not finish within ${D1_TIMEOUT_MS / 1000}s: ${sql}`
            : `d1 query failed: ${sql}\n${(err || out || `exit code ${code}`).trim().slice(0, 1000)}`,
          hint,
        ),
      );
    });
  });
  const parsed = JSON.parse(stdout) as { results: Row[] }[];
  return parsed[0]?.results ?? [];
}
