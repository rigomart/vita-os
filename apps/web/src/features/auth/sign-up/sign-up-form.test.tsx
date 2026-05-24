import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { SignUpForm } from "./sign-up-form";

describe("SignUpForm", () => {
  it("submits the entered name, email, and password", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <SignUpForm
        error=""
        githubError=""
        githubLoading={false}
        loading={false}
        onGitHub={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await user.type(screen.getByLabelText("Name"), "Rigo");
    await user.type(screen.getByLabelText("Email"), "rigo@example.com");
    await user.type(screen.getByLabelText("Password"), "password-123");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Rigo",
      email: "rigo@example.com",
      password: "password-123",
    });
  });

  it("shows email and GitHub pending states", () => {
    render(
      <SignUpForm
        error=""
        githubError=""
        githubLoading
        loading
        onGitHub={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const submitButton = screen.getByRole("button", {
      name: "Creating account...",
    });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute("aria-busy", "true");

    const githubButton = screen.getByRole("button", {
      name: "Connecting to GitHub...",
    });
    expect(githubButton).toBeDisabled();
    expect(githubButton).toHaveAttribute("aria-busy", "true");
  });

  it("shows inline email and GitHub failures", () => {
    render(
      <SignUpForm
        error="Email is already in use"
        githubError="GitHub is unavailable"
        githubLoading={false}
        loading={false}
        onGitHub={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("Email is already in use")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByText("GitHub is unavailable")).toHaveAttribute(
      "role",
      "alert",
    );
  });
});
