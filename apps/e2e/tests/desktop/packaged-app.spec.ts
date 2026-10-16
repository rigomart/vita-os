// The packaged macOS app (#474), run with: bun run test:e2e:desktop tests/desktop/packaged-app.spec.ts
// The fixture packages the app once per run (apps/desktop/scripts/package.ts) and launches the .app itself.
import { threadCard } from "../../src/app.ts";
import { expect, test } from "../../src/desktop.ts";

test.use({ packaged: true });

test("the packaged app keeps a Thread across quit and relaunch, in the Vita OS user-data folder", async ({
  desktop,
  stamp,
  shot,
}) => {
  const title = `Packaged thread ${stamp}`;

  let page = await desktop.launch();
  // Not the dev build: a packaged app loads only its own files, and its name picks the
  // folder its data lives in (~/Library/Application Support/Vita OS) across reinstalls.
  expect(
    await desktop.app().evaluate(({ app }) => ({
      packaged: app.isPackaged,
      name: app.getName(),
    })),
  ).toEqual({ packaged: true, name: "Vita OS" });
  await expect(page).toHaveURL("app://vita/");

  // There is no HTTP to wait on: the success toast is the write's answer.
  await page.getByRole("button", { name: "New thread", exact: true }).click();
  await page.getByLabel("Thread title").fill(title);
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("Thread created")).toBeVisible();
  await expect(threadCard(page, title)).toBeVisible();
  await shot("packaged-thread-created");

  await desktop.quit();
  page = await desktop.launch();
  await expect(threadCard(page, title)).toBeVisible();
  await shot("packaged-thread-after-relaunch");
});
