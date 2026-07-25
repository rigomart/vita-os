import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeHarness() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div>
      <p>{`${theme}:${resolvedTheme}`}</p>
      <button type="button" onClick={() => setTheme("dark")}>
        Use dark
      </button>
      <button type="button" onClick={() => setTheme("light")}>
        Use light
      </button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  });

  it("uses the system preference by default", () => {
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    expect(screen.getByText("system:light")).toBeVisible();
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("applies and stores an explicit preference", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Use dark" }));

    expect(screen.getByText("dark:dark")).toBeVisible();
    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("vita-os:theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Use light" }));

    expect(screen.getByText("light:light")).toBeVisible();
    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem("vita-os:theme")).toBe("light");
  });
});
