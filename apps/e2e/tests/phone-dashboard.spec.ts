import { closeThread, createThread } from "../src/app.ts";
import { expect, test } from "../src/fixtures.ts";

// A phone: a page wider than this widens the layout viewport, and fixed
// surfaces such as the Thread drawer land below the screen.
test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("a filter row too wide for a phone folds without widening the page, and a Thread opens on screen", async ({
  page,
  stamp,
  shot,
}) => {
  await page.goto("/");
  const titles = ["Health", "Household", "Paperwork"].map(
    (area) => `${area} thread ${stamp}`,
  );
  for (const [index, area] of ["Health", "Household", "Paperwork"].entries()) {
    const thread = await createThread(page, titles[index]!, {
      area: `${area} ${stamp}`,
      newArea: true,
    });
    await closeThread(thread);
  }
  await expect(page.getByRole("button", { name: /^\d+ more$/ })).toBeVisible();

  const widths = () =>
    page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      screen: window.innerWidth,
    }));
  await expect.poll(widths).toEqual({ page: 390, screen: 390 });
  await shot("phone-dashboard");

  const noDate = page.getByRole("region", { name: "No date" });
  await noDate.getByRole("button", { name: new RegExp(stamp) }).click();
  await noDate.getByText(titles[2]!, { exact: true }).click();
  const drawer = page.getByRole("dialog", { name: titles[2], exact: true });
  await expect(drawer).toBeInViewport({ ratio: 0.9 });
  await shot("phone-drawer");
});
