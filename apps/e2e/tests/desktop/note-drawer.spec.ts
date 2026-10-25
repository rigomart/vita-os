// The Note drawer on a phone-sized window (#502), run with: bun run test:e2e:desktop tests/desktop/note-drawer.spec.ts
import { noteView } from "../../src/app.ts";
import { expect, test } from "../../src/desktop.ts";

test("the Note drawer can't be scrolled by code, so nothing cuts off its top", async ({
  desktop,
}) => {
  const page = await desktop.launch();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "New note", exact: true }).click();
  const drawer = page.locator("[data-vaul-drawer]");
  await expect(drawer).toBeVisible();
  await expect(noteView(page)).toBeVisible();

  // vaul hangs a pseudo-element twice the drawer's height below it. Bringing a
  // control into view (as Playwright does before a click) must not scroll into it.
  const scrollTop = await drawer.evaluate((element) => {
    element.scrollTop = 450;
    return element.scrollTop;
  });
  expect(scrollTop).toBe(0);
});
