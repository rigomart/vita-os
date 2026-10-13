// Playwright's `test`, extended for Vita OS. Every spec file gets its own throwaway user (and every repeat of a file,
// with --repeat-each, another one), so no spec sees another's data. Every test starts signed in as that user with a
// session of its own, so signing out in one test leaves the next one signed in.
//
//   import { expect, sent, settled, test } from "../src/fixtures.ts";
//   test("…", async ({ page, account, stamp, d1, shot }) => { … });
//
// To start signed out (to drive /sign-in with `account.email` and `account.password`):
//   test.use({ storageState: { cookies: [], origins: [] } });
import {
  type APIRequestContext,
  test as base,
  expect,
  type Locator,
  type Page,
  type PlaywrightWorkerArgs,
  type TestInfo,
} from "@playwright/test";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";

import { d1, instanceName, requireState, type State } from "./instance.ts";

export { expect };

/** The throwaway user a spec file runs as. `id` is `user.id`, the `user_id` of every row the user owns. */
export type Account = { id: string; email: string; password: string };

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

/** Read-only SQL (one SELECT) against the instance's local D1; the `d1` fixture. */
export type D1 = <Row = Record<string, unknown>>(sql: string) => Promise<Row[]>;

type Fixtures = {
  /** This spec file's throwaway user. */
  account: Account;
  /** Unique text for this test, so repeated runs never match each other's rows. */
  stamp: string;
  /** Read-only SQL (one SELECT) against the instance's local D1. Scope it with `WHERE user_id = '${account.id}'`. */
  d1: D1;
  /** Saves `<label>.png` of the page to the instance's evidence dir, attaches it to the test, returns its path. */
  shot: (label: string) => Promise<string>;
};

type WorkerFixtures = {
  /** The running verify instance (VITA_INSTANCE, default main): URLs, ports, evidence and logs dirs. */
  instance: State;
};

// One user per spec file and repeat, for as long as this worker lives.
const accounts = new Map<string, Promise<Account>>();

async function apiContext(
  playwright: PlaywrightWorkerArgs["playwright"],
  instance: State,
) {
  return playwright.request.newContext({
    baseURL: instance.apiUrl,
    extraHTTPHeaders: { origin: instance.webUrl },
  });
}

async function signUp(
  playwright: PlaywrightWorkerArgs["playwright"],
  instance: State,
  testInfo: TestInfo,
): Promise<Account> {
  const slug = basename(testInfo.file)
    .replace(/\.spec\.ts$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  const email = `e2e-${slug}-${randomBytes(3).toString("hex")}@vita.test`;
  const password = randomBytes(12).toString("base64url");
  const api = await apiContext(playwright, instance);
  try {
    const res = await api.post("/api/auth/sign-up/email", {
      data: { name: "E2E Bot", email, password },
    });
    if (!res.ok())
      throw new Error(
        `sign-up of ${email} failed: ${res.status()} ${(await res.text()).slice(0, 300)}`,
      );
    const { user } = (await res.json()) as { user: { id: string } };
    return { id: user.id, email, password };
  } finally {
    await api.dispose();
  }
}

async function signIn(
  playwright: PlaywrightWorkerArgs["playwright"],
  instance: State,
  account: Account,
): Promise<StorageState> {
  const api = await apiContext(playwright, instance);
  try {
    const res = await api.post("/api/auth/sign-in/email", {
      data: { email: account.email, password: account.password },
    });
    if (!res.ok())
      throw new Error(
        `sign-in of ${account.email} failed: ${res.status()} ${(await res.text()).slice(0, 300)}`,
      );
    return await api.storageState();
  } finally {
    await api.dispose();
  }
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  instance: [
    // oxlint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern
    async ({}, use) => use(requireState(instanceName())),
    { scope: "worker" },
  ],
  baseURL: async ({ instance }, use) => use(instance.webUrl),
  account: async ({ playwright, instance }, use, testInfo) => {
    const key = `${testInfo.file}#${testInfo.repeatEachIndex}`;
    if (!accounts.has(key))
      accounts.set(key, signUp(playwright, instance, testInfo));
    await use(await accounts.get(key)!);
  },
  storageState: async ({ playwright, instance, account }, use) =>
    use(await signIn(playwright, instance, account)),
  // oxlint-disable-next-line no-empty-pattern -- Playwright requires the destructuring pattern
  stamp: async ({}, use) =>
    use(`${Date.now().toString(36)}${randomBytes(2).toString("hex")}`),
  d1: async ({ instance }, use) => use((sql) => d1(sql, instance.instance)),
  shot: async ({ page, instance }, use, testInfo) => {
    const dir = join(
      instance.evidenceDir,
      basename(testInfo.file).replace(/\.spec\.ts$/, ""),
    );
    await use(async (label) => {
      if (!/^[\w.-]+$/.test(label))
        throw new Error(`shot label "${label}": use letters, digits, . _ -`);
      mkdirSync(dir, { recursive: true });
      const path = join(dir, `${label}.png`);
      await page.screenshot({ path, animations: "disabled" });
      await testInfo.attach(label, { path, contentType: "image/png" });
      return path;
    });
  },
});

/** Waits until a pane, drawer, or picker has stopped sliding. Click inside it only after this. */
export async function settled(element: Locator) {
  await expect
    .poll(() => element.evaluate((el) => el.getAnimations().length))
    .toBe(0);
}

/**
 * Runs `action` and waits until the API answers the write it sends (a non-GET request whose path matches `path`),
 * and checks that the answer is a success. The reload that proves a mutation has to come after this.
 */
export async function sent(
  page: Page,
  path: RegExp,
  action: () => Promise<unknown>,
) {
  const response = page.waitForResponse(
    (r) =>
      !["GET", "OPTIONS"].includes(r.request().method()) &&
      path.test(new URL(r.url()).pathname),
  );
  await action();
  expect((await response).ok()).toBe(true);
}
