#!/usr/bin/env bun
import { d1, instanceName, requireState, VitaError } from "./instance.ts";
import { doctor, down, publicEnv, up } from "./stack.ts";

const HELP = `verify: start, check, and stop an isolated local Vita OS stack. It never drives the app.

Every command prints one JSON object on stdout: {"ok":true,...} or {"ok":false,"error":...,"hint":...}.
Instances are isolated by name (--instance <name> or VITA_INSTANCE, default "main"): own ports, own
local D1 under .verify/instances/<name>/, own logs, own agent-browser session (vita-<name>). Evidence
lives in .verify/evidence/<instance>/<run>/ and survives "down".

Commands:
  up [--web-port N] [--api-port N]   Migrate a private local D1, start the API (wrangler dev) and web (vite),
                                     wait for both. Idempotent: a healthy instance is reused.
  doctor                             Read-only health check of this instance. Run first when anything looks off.
  env                                Print URLs, the agent-browser session, the evidence dir, and the logs dir.
  d1 "<SELECT ...>"                  Read-only SQL against this instance's local D1 (one SELECT).
  down [--dry-run] [--purge]         Stop only the processes this instance started and close its agent-browser
                                     session. --purge also deletes its local D1. Evidence and logs are kept.

Drive the app with agent-browser on the instance's session, per .claude/skills/verify-vita-os/SKILL.md:
  agent-browser --session vita-main open "$(bun run verify env | jq -r .webUrl)/sign-up"

Examples:
  bun run verify up && bun run verify doctor
  bun run verify d1 "SELECT title FROM threads WHERE user_id = (SELECT id FROM user WHERE email = '...')"
  bun run verify up --instance b      # a second, fully isolated stack
`;

const VALUE_FLAGS = ["instance", "web-port", "api-port"];

function parseArgs(argv: string[]) {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (
      VALUE_FLAGS.includes(key) &&
      next !== undefined &&
      !next.startsWith("--")
    ) {
      flags[key] = next;
      i++;
    } else flags[key] = true;
  }
  return { flags, positional };
}

function port(value: string | true | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0)
    throw new VitaError(`invalid port "${value}"`, "pass a port number");
  return n;
}

function out(value: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main(): Promise<boolean> {
  const [command, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseArgs(rest);
  const instance = instanceName(
    typeof flags.instance === "string" ? flags.instance : undefined,
  );
  let result: Record<string, unknown>;
  switch (command) {
    case "up":
      result = await up(instance, {
        webPort: port(flags["web-port"]),
        apiPort: port(flags["api-port"]),
      });
      break;
    case "doctor":
      result = await doctor(instance);
      break;
    case "env":
      result = { ok: true, ...publicEnv(requireState(instance)) };
      break;
    case "d1": {
      const sql = positional[0];
      if (!sql)
        throw new VitaError(
          "missing query",
          'usage: bun run verify d1 "SELECT title FROM threads"',
        );
      result = { ok: true, rows: await d1(sql, instance) };
      break;
    }
    case "down":
      result = await down(instance, {
        dryRun: flags["dry-run"] === true,
        purge: flags.purge === true,
      });
      break;
    case undefined:
    case "help":
    case "--help":
    case "-h":
      process.stdout.write(HELP);
      return true;
    default:
      throw new VitaError(
        `unknown command "${command}"`,
        "run: bun run verify --help",
      );
  }
  out(result);
  return result.ok === true;
}

main().then(
  (ok) => process.exit(ok ? 0 : 1),
  (err: unknown) => {
    if (err instanceof VitaError)
      out({ ok: false, error: err.message, hint: err.hint });
    else
      out({
        ok: false,
        error: String(err instanceof Error ? err.stack : err),
        hint: "unexpected failure; read .verify/instances/<instance>/logs",
      });
    process.exit(1);
  },
);
