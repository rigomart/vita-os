import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { SocialProviderOption } from "@/features/auth/auth-card-shell";

import { render, screen } from "@/test/render-with-providers";

import { SignUpForm } from "./sign-up-form";

function buildProviders(
  overrides: {
    github?: Partial<SocialProviderOption>;
    google?: Partial<SocialProviderOption>;
  } = {},
): SocialProviderOption[] {
  return [
    { id: "github", name: "GitHub", onClick: vi.fn(), ...overrides.github },
    { id: "google", name: "Google", onClick: vi.fn(), ...overrides.google },
  ];
}

describe("SignUpForm", () => {
  it("submits the entered name, email, and password", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const providers = buildProviders();

    render(
      <SignUpForm
        error=""
        loading={false}
        providers={providers}
        onSubmit={onSubmit}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Name"), "Rigo");
    await user.type(screen.getByLabelText("Email"), "rigo@example.com");
    await user.type(screen.getByLabelText("Password"), "password-123");
    await user.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Rigo",
      email: "rigo@example.com",
      password: "password-123",
    });

    await user.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );
    expect(providers[1]?.onClick).toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );
    expect(providers[0]?.onClick).toHaveBeenCalled();
  });

  it("shows email and social provider pending states", () => {
    render(
      <SignUpForm
        error=""
        loading
        providers={buildProviders({
          github: { loading: true },
          google: { loading: true },
        })}
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

    const googleButton = screen.getByRole("button", {
      name: "Connecting to Google...",
    });
    expect(googleButton).toBeDisabled();
    expect(googleButton).toHaveAttribute("aria-busy", "true");
  });

  it("shows inline email and social provider failures", () => {
    render(
      <SignUpForm
        error="Email is already in use"
        loading={false}
        providers={buildProviders({
          github: { error: "GitHub is unavailable" },
          google: { error: "Google is unavailable" },
        })}
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
    expect(screen.getByText("Google is unavailable")).toHaveAttribute(
      "role",
      "alert",
    );
  });
});
