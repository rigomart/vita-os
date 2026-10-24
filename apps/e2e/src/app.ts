// Locators for what a person sees in Vita OS, shared by the desktop specs.
import type { Locator, Page } from "@playwright/test";

export function threadCard(scope: Page | Locator, title: string): Locator {
  const page = "page" in scope ? scope.page() : scope;
  return scope
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) });
}

/** The open Note view, or the New note dialog. */
export const noteView = (page: Page) => page.getByRole("dialog");

export const openNote = (scope: Page | Locator, text: string) =>
  scope.getByRole("button", { name: `Open note: ${text}`, exact: true });
