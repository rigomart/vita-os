// One throwaway user per spec file (and per --repeat-each repeat); each test signs in with a session of its own.
// To start signed out: test.use({ storageState: { cookies: [], origins: [] } });
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

/** `id` is the `user_id` of every row the user owns. */
export type Account = { id: string; email: string; password: string };

type StorageState = Awaited<ReturnType<APIRequestContext["storageState"]>>;

export type D1 = <Row = Record<string, unknown>>(sql: string) => Promise<Row[]>;

type Fixtures = {
  account: Account;
  /** Unique per test, so repeated runs never match each other's rows. */
  stamp: string;
  /** Scope it with `WHERE user_id = '${account.id}'`. */
  d1: D1;
  /** Saves `<label>.png` to the evidence dir and attaches it to the test. */
  shot: (label: string) => Promise<string>;
};

type WorkerFixtures = {
  instance: State;
};

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

/** Waits until it stops sliding: its content is there before then, and an early click lands elsewhere (#449). */
export async function settled(element: Locator) {
  await expect
    .poll(() => element.evaluate((el) => el.getAnimations().length))
    .toBe(0);
}

/** Runs `action` and expects a successful answer to the write it sends to `path`. Reload only after this. */
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
