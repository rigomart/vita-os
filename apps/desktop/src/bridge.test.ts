import type { ApplicationClient } from "@vita-os/contracts";

import { describeApplicationClient } from "@vita-os/contracts/testing";
import {
  createLocalApplicationClient,
  openLocalDatabase,
  type LocalDatabase,
} from "@vita-os/local";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { VitaBridge } from "./bridge.ts";

import { callApplication } from "./main/application-calls.ts";
import { createBridgeClient } from "./renderer/bridge-client.ts";

const MIGRATIONS = fileURLToPath(
  new URL("../../api/migrations", import.meta.url),
);

let directory: string;
const opened: LocalDatabase[] = [];

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "vita desktop bridge "));
});

afterAll(async () => {
  for (const local of opened) local.close();
  await rm(directory, { recursive: true, force: true });
});

async function localClient(): Promise<ApplicationClient> {
  const local = await openLocalDatabase({
    databasePath: join(await mkdtemp(join(directory, "db-")), "vita.db"),
    migrationsDirectory: MIGRATIONS,
  });
  opened.push(local);
  return createLocalApplicationClient({ db: local.database });
}

/** What IPC does: a structured clone each way, with main answering. */
function overIpc(client: ApplicationClient): Pick<VitaBridge, "call"> {
  return {
    call: async (method, input) =>
      structuredClone(
        await callApplication(client, method, structuredClone(input)),
      ),
  };
}

describeApplicationClient("The desktop bridge", async () =>
  createBridgeClient(overIpc(await localClient())),
);

describe("the desktop bridge", () => {
  it("refuses a name the local client doesn't have, and the renderer sees it fail", async () => {
    const client = await localClient();
    for (const name of ["constructor", "__proto__", "toString", "nope", 1]) {
      await expect(callApplication(client, name, undefined)).rejects.toThrow(
        "Vita OS has no method named",
      );
    }

    const onFailure = vi.fn();
    const refusing: Pick<VitaBridge, "call"> = {
      call: (method) => callApplication(client, `${method}Elsewhere`, {}),
    };
    await expect(
      createBridgeClient(refusing, onFailure).listAreas(),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "unexpected",
        message: "Vita OS couldn't reach its data.",
        retryable: false,
      },
    });
    expect(onFailure).toHaveBeenCalledWith("listAreas", expect.any(Error));
  });
});
