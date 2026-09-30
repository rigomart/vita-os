#!/usr/bin/env bun
/**
 * Makes a checkout ready for `bun run dev`: installs dependencies, writes the
 * local env files, migrates the local D1, and seeds a dev user with sample
 * Areas, Threads and Notes. Safe to re-run: every step skips what is done.
 *
 *   bun run setup            set up this checkout
 *   bun run setup --reset    wipe the local D1, then migrate and reseed
 *   bun run setup --no-seed  everything except the sample data
 *
 * `.githooks/post-checkout` runs it in every new git worktree, so a worktree
 * opens ready to use. Run it once in the main checkout to turn that hook on.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join, relative, resolve } from "node:path";

// By path: the repo root does not depend on @vita-os/core, so the package
// name does not resolve from here.
import { newRecordId } from "../packages/core/src/record-id";
import { seedThreadNotes } from "./seed-thread-notes";

const ROOT = resolve(import.meta.dir, "..");
const API_DIR = join(ROOT, "apps/api");
const WEB_DIR = join(ROOT, "apps/web");

const DEV_EMAIL = "dev@vita.test";
const DEV_PASSWORD = "vita-dev-password";
// Only the seeding API sees this origin; it never has to match a real server.
const SEED_ORIGIN = "http://localhost:5173";

const flags = new Set(process.argv.slice(2));

function log(message: string): void {
  console.log(`vita setup: ${message}`);
}

function run(cmd: string[], cwd: string, env: Record<string, string> = {}) {
  const result = spawnSync(cmd[0], cmd.slice(1), {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    code: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

function mustRun(label: string, cmd: string[], cwd: string, env = {}) {
  const result = run(cmd, cwd, env);
  if (result.code !== 0) {
    console.error(result.output);
    throw new Error(`${label} failed`);
  }
}

/** The main checkout, which every worktree of this repo shares a .git with. */
function primaryCheckout(): string {
  const commonDir = run(
    ["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
    ROOT,
  ).output.trim();
  return dirname(commonDir);
}

function enableWorktreeHook(): void {
  const current = run(
    ["git", "config", "--get", "core.hooksPath"],
    ROOT,
  ).output.trim();
  if (current === ".githooks") return;
  if (current !== "") {
    log(
      `core.hooksPath is ${current}; leaving it, so new worktrees won't set up`,
    );
    return;
  }
  mustRun(
    "enabling the worktree hook",
    ["git", "config", "core.hooksPath", ".githooks"],
    ROOT,
  );
  log("new worktrees now set themselves up (core.hooksPath = .githooks)");
}

function envKeys(text: string): Map<string, string> {
  const keys = new Map<string, string>();
  for (const line of text.split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) keys.set(match[1], line.trim());
  }
  return keys;
}

/**
 * Copies the env file from the main checkout (it may hold real secrets) or,
 * failing that, from the example, then adds any key the example has and the
 * file lacks.
 */
function ensureEnvFile(target: string, example: string): void {
  const name = relative(ROOT, target);
  if (!existsSync(target)) {
    const fromPrimary = join(primaryCheckout(), relative(ROOT, target));
    const source =
      fromPrimary !== target && existsSync(fromPrimary) ? fromPrimary : example;
    copyFileSync(source, target);
    log(
      `wrote ${name} from ${source === example ? "the example" : "the main checkout"}`,
    );
  }

  const present = envKeys(readFileSync(target, "utf8"));
  const missing = [...envKeys(readFileSync(example, "utf8"))].filter(
    ([key]) => !present.has(key),
  );
  if (missing.length === 0) return;
  appendFileSync(
    target,
    `\n# Added by bun run setup from ${relative(ROOT, example)}\n${missing
      .map(([, line]) => line)
      .join("\n")}\n`,
  );
  log(`added ${missing.map(([key]) => key).join(", ")} to ${name}`);
}

function freePort(from: number): Promise<number> {
  return new Promise((resolvePort) => {
    const server = createServer();
    server.once("error", () => resolvePort(freePort(from + 1)));
    server.listen(from, "localhost", () => {
      server.close(() => resolvePort(from));
    });
  });
}

async function waitForApi(url: string, logs: string[]): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/api/auth/ok`)).ok) return;
    } catch {
      // Not listening yet.
    }
    await Bun.sleep(250);
  }
  console.error(logs.join(""));
  throw new Error("the API did not start within 90s");
}

async function seed(): Promise<void> {
  const port = await freePort(8800);
  const inspectorPort = await freePort(9300);
  const apiUrl = `http://localhost:${port}`;
  const logs: string[] = [];
  const api = spawn(
    "bunx",
    [
      "wrangler",
      "dev",
      "--port",
      String(port),
      "--inspector-port",
      String(inspectorPort),
      "--var",
      `BETTER_AUTH_URL:${apiUrl}`,
      "--var",
      `BROWSER_ORIGIN:${SEED_ORIGIN}`,
    ],
    { cwd: API_DIR, env: { ...process.env, CI: "1" }, detached: true },
  );
  api.stdout.on("data", (chunk) => logs.push(String(chunk)));
  api.stderr.on("data", (chunk) => logs.push(String(chunk)));

  try {
    await waitForApi(apiUrl, logs);

    let auth = await fetch(`${apiUrl}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: SEED_ORIGIN },
      body: JSON.stringify({
        name: "Dev",
        email: DEV_EMAIL,
        password: DEV_PASSWORD,
      }),
    });
    const existingUser =
      auth.status === 422 && /exist/i.test(await auth.clone().text());
    if (existingUser) {
      auth = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: SEED_ORIGIN },
        body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD }),
      });
    }
    if (!auth.ok) {
      throw new Error(
        `${existingUser ? "sign-in" : "sign-up"} failed: ${auth.status} ${await auth.text()}`,
      );
    }
    const cookie = auth.headers
      .getSetCookie()
      .map((header) => header.split(";")[0])
      .join("; ");

    async function call<T>(
      method: string,
      path: string,
      body?: unknown,
    ): Promise<T> {
      const res = await fetch(`${apiUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          origin: SEED_ORIGIN,
          cookie,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
      }
      return (await res.json()) as T;
    }

    if (existingUser) {
      const added = await seedThreadNotes(call);
      log(
        `existing dev account preserved; added ${added} sample Thread Notes to empty sample Threads`,
      );
      return;
    }

    const areaIds = new Map<string, string>();
    for (const area of SEED.areas) {
      const created = await call<{ _id: string }>("POST", "/v1/areas", area);
      areaIds.set(area.name, created._id);
    }

    for (const spec of SEED.threads) {
      type Thread = { _id: string; revision: number };
      let thread = await call<Thread>("POST", "/v1/threads", {
        title: spec.title,
        ...(spec.summary ? { summary: spec.summary } : {}),
        ...(spec.area ? { areaId: areaIds.get(spec.area) } : {}),
      });
      const moveIds: string[] = [];
      for (const text of spec.moves ?? []) {
        const moveId = newRecordId();
        moveIds.push(moveId);
        thread = await call<Thread>("POST", `/v1/threads/${thread._id}/moves`, {
          moveId,
          text,
          expectedRevision: thread.revision,
        });
      }
      if (spec.focus !== undefined) {
        thread = await call<Thread>("PUT", `/v1/threads/${thread._id}/focus`, {
          moveId: moveIds[spec.focus],
          expectedRevision: thread.revision,
        });
      }
      if (spec.followUpInDays !== undefined) {
        thread = await call<Thread>("PATCH", `/v1/threads/${thread._id}`, {
          followUp: dayFromToday(spec.followUpInDays),
        });
      }
      if (spec.resolution !== undefined) {
        await call("PATCH", `/v1/threads/${thread._id}`, {
          state: "resolved",
          resolutionNote: spec.resolution,
        });
      }
    }

    for (const note of SEED.notes) {
      await call("POST", "/v1/notes", {
        body: note.body,
        ...(note.inDays === undefined
          ? {}
          : { attentionDate: dayFromToday(note.inDays) }),
      });
    }

    const threadNotes = await seedThreadNotes(call);
    log(
      `seeded ${SEED.areas.length} Areas, ${SEED.threads.length} Threads, ${SEED.notes.length} standalone Notes and ${threadNotes} Thread Notes`,
    );
  } finally {
    // wrangler starts workerd as a child; stop the whole group.
    if (api.pid !== undefined) {
      try {
        process.kill(-api.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }
}

/** Local midnight, `days` from today: what the date pickers store. */
function dayFromToday(days: number): number {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

interface SeedThread {
  title: string;
  summary?: string;
  area?: string;
  moves?: string[];
  /** Index into `moves` of the Focused Move. */
  focus?: number;
  followUpInDays?: number;
  resolution?: string;
}

/** Enough to fill every Dashboard lane and No date group. */
const SEED: {
  areas: { name: string; icon: string }[];
  threads: SeedThread[];
  notes: { body: string; inDays?: number }[];
} = {
  areas: [
    { name: "Health", icon: "HeartPulse" },
    { name: "Home", icon: "Home" },
    { name: "Work", icon: "BriefcaseBusiness" },
    { name: "Money", icon: "WalletCards" },
  ],
  threads: [
    {
      title: "Dentist follow-up",
      area: "Health",
      summary: "Crown on the lower left molar still feels high.",
      moves: ["Call the clinic to reschedule", "Ask about a night guard"],
      focus: 0,
      followUpInDays: -3,
    },
    {
      title: "File quarterly taxes",
      area: "Money",
      moves: ["Gather Q3 receipts", "Send the summary to the accountant"],
      focus: 0,
      followUpInDays: 0,
    },
    {
      title: "Quarterly review prep",
      area: "Work",
      moves: ["Draft the wins list", "Book a 1:1 with my manager"],
      followUpInDays: 3,
    },
    {
      title: "Fix the leaking kitchen tap",
      area: "Home",
      moves: ["Buy a replacement cartridge"],
      followUpInDays: 5,
    },
    {
      title: "Plan the Lisbon trip",
      moves: ["Compare flight dates"],
      followUpInDays: 20,
    },
    {
      title: "Marathon training block",
      area: "Health",
      moves: ["Pick a 16-week plan"],
    },
    { title: "Build an emergency fund", area: "Money" },
    { title: "Learn to bake sourdough" },
    {
      title: "Replace the car tyres",
      area: "Home",
      resolution: "Done at the garage on the high street.",
    },
  ],
  notes: [
    { body: "Ask Sam about the spare moving boxes", inDays: 1 },
    { body: "Book club picks: The Overstory, Piranesi" },
    { body: "Guest wifi password is on the fridge" },
  ],
};

async function main(): Promise<void> {
  enableWorktreeHook();

  mustRun("bun install", ["bun", "install"], ROOT);
  log("dependencies installed");

  ensureEnvFile(join(API_DIR, ".dev.vars"), join(API_DIR, ".dev.vars.example"));
  ensureEnvFile(join(WEB_DIR, ".env.local"), join(WEB_DIR, ".env.example"));

  if (flags.has("--reset")) {
    rmSync(join(API_DIR, ".wrangler/state/v3/d1"), {
      recursive: true,
      force: true,
    });
    log("wiped the local D1");
  }
  mustRun(
    "migrating the local D1",
    [
      "bunx",
      "wrangler",
      "d1",
      "migrations",
      "apply",
      "vita-os-local",
      "--local",
    ],
    API_DIR,
    { CI: "1" },
  );
  log("local D1 migrated");

  if (!flags.has("--no-seed")) await seed();

  log(`ready: bun run dev, then sign in as ${DEV_EMAIL} / ${DEV_PASSWORD}`);
}

main().catch((error: unknown) => {
  console.error(
    `vita setup: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
