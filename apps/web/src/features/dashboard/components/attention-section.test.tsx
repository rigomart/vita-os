import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AttentionSection } from "./attention-section";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: ComponentPropsWithoutRef<"a"> & {
    to: string;
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

describe("AttentionSection", () => {
  const today = new Date(2026, 4, 20, 12).getTime();

  it("renders Dashboard Thread groups from attention state", () => {
    render(
      <AttentionSection
        currentDate={today}
        threads={[
          {
            id: "resolved",
            key: "resolved",
            name: "Resolved passport renewal",
            threadName: "Resolved passport renewal",
            threadSlug: "resolved-passport-renewal",
            areaSlug: "life-admin",
            lifecycle: "resolved",
          },
          {
            id: "due",
            key: "due",
            name: "Call clinic",
            threadName: "Call clinic",
            threadSlug: "call-clinic",
            areaSlug: "health",
            lifecycle: "open",
            followUp: today,
          },
          {
            id: "scheduled",
            key: "scheduled",
            name: "Check insurance reply",
            threadName: "Check insurance reply",
            threadSlug: "check-insurance-reply",
            areaSlug: "life-admin",
            lifecycle: "open",
            followUp: today + 86_400_000,
            nextMove: "Draft reply",
          },
          {
            id: "ready",
            key: "ready",
            name: "Send signed form",
            threadName: "Send signed form",
            threadSlug: "send-signed-form",
            areaSlug: "life-admin",
            lifecycle: "open",
            nextMove: "Email the PDF",
          },
          {
            id: "open",
            key: "open",
            name: "Think about winter trip",
            threadName: "Think about winter trip",
            threadSlug: "winter-trip",
            areaSlug: "travel",
            lifecycle: "open",
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Follow-up Due" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Scheduled" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ready" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Open" })).toBeVisible();

    expect(screen.getByRole("link", { name: /call clinic/i })).toBeVisible();
    expect(
      screen.getByRole("link", { name: /check insurance reply/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /send signed form/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: /think about winter trip/i }),
    ).toBeVisible();
    expect(
      screen.queryByText("Resolved passport renewal"),
    ).not.toBeInTheDocument();
  });
});
