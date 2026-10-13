// #418. Sign-up leaves a session of its own, so D1 counts sessions against before.
import type { Page } from "@playwright/test";

import type { Account, D1 } from "../src/fixtures.ts";

import { expect, sent, test } from "../src/fixtures.ts";

test.use({ storageState: { cookies: [], origins: [] } });

const sessionsOf = async (d1: D1, account: Account) =>
  (
    await d1<{ n: number }>(
      `SELECT COUNT(*) AS n FROM session WHERE userId = '${account.id}'`,
    )
  )[0]!.n;

async function signInWithForm(page: Page, account: Account) {
  await expect(
    page.getByText("Sign in to your account to continue"),
  ).toBeVisible();
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await sent(page, /\/api\/auth\/sign-in\/email$/, () =>
    page.getByRole("button", { name: "Sign In", exact: true }).click(),
  );
  await expect(page.getByRole("banner", { name: "Vita OS" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
}

test("a signed-out visit is gated to /sign-in, and the form signs in to the Dashboard", async ({
  page,
  account,
  d1,
  instance,
  shot,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("banner", { name: "Vita OS" })).toHaveCount(0);
  const before = await sessionsOf(d1, account);

  await signInWithForm(page, account);
  expect(await sessionsOf(d1, account)).toBe(before + 1);
  const session = await page.request.get(
    `${instance.apiUrl}/api/auth/get-session`,
  );
  expect(session.ok()).toBe(true);
  expect(
    ((await session.json()) as { user: { email: string } }).user.email,
  ).toBe(account.email);

  await page.goto("/sign-in");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("banner", { name: "Vita OS" })).toBeVisible();
  await shot("sign-in-after");
});

test("Sign out in the user menu ends the session and gates the Dashboard", async ({
  page,
  account,
  d1,
  shot,
}) => {
  await page.goto("/sign-in");
  await signInWithForm(page, account);
  const signedIn = await sessionsOf(d1, account);
  await shot("sign-in-before");

  await page.getByRole("button", { name: "E2E Bot", exact: true }).click();
  await sent(page, /\/api\/auth\/sign-out$/, () =>
    page.getByRole("menuitem", { name: "Sign out", exact: true }).click(),
  );
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByText("Sign in to your account to continue"),
  ).toBeVisible();
  expect(await sessionsOf(d1, account)).toBe(signedIn - 1);
  await shot("sign-in-signed-out");

  await page.goto("/");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByText("Sign in to your account to continue"),
  ).toBeVisible();
  await expect(page.getByRole("banner", { name: "Vita OS" })).toHaveCount(0);
});
