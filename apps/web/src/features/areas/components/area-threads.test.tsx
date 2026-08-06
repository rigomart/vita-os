import type { Doc, Id } from "@convex/_generated/dataModel";
import type { ReactNode } from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AreaThreads } from "./area-threads";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useLocation: () => ({ pathname: "/admin" }),
}));

const today = new Date(2026, 4, 20, 12).getTime();
const yesterday = new Date(2026, 4, 19, 12).getTime();
const tomorrow = new Date(2026, 4, 21, 12).getTime();

function thread(
  id: string,
  title: string,
  fields: Partial<Pick<Doc<"threads">, "followUp" | "nextMove" | "order">> = {},
): Doc<"threads"> {
  return {
    _id: id as Id<"threads">,
    _creationTime: 0,
    userId: "user1",
    title,
    slug: id,
    areaId: "area1" as Id<"areas">,
    state: "open",
    order: 0,
    createdAt: 0,
    ...fields,
  };
}

describe("AreaThreads", () => {
  it("renders a flat thread list with header actions", () => {
    render(
      <AreaThreads
        threads={[
          thread("call-clinic", "Call clinic", { followUp: tomorrow }),
          thread("renew-passport", "Renew passport"),
        ]}
        currentDate={today}
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Threads" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "New Thread" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Call clinic")).toBeInTheDocument();
    expect(screen.getByText("Renew passport")).toBeInTheDocument();
  });

  it("shows a loading skeleton while Threads are still loading", () => {
    render(
      <AreaThreads
        threads={[]}
        currentDate={today}
        isLoading
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(screen.getByTestId("area-threads-skeleton")).toBeVisible();
    expect(
      screen.queryByText("No open Threads in this Area yet."),
    ).not.toBeInTheDocument();
  });

  it("shows an empty state when there are no Threads", () => {
    render(
      <AreaThreads
        threads={[]}
        currentDate={today}
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No open Threads in this Area yet."),
    ).toBeInTheDocument();
  });

  it("shows each scheduled date once and hides empty Next Move lines", () => {
    render(
      <AreaThreads
        threads={[
          thread("call-clinic", "Call clinic", { followUp: yesterday }),
          thread("renew-passport", "Renew passport", { followUp: tomorrow }),
          thread("sort-receipts", "Sort receipts", { nextMove: "Scan them" }),
        ]}
        currentDate={today}
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(screen.getAllByText("May")).toHaveLength(2);
    expect(screen.getByText("19")).toBeVisible();
    expect(screen.getByText("21")).toBeVisible();
    expect(screen.getByText("19").closest("time")?.parentElement).toHaveClass(
      "bg-condition-attention-fill",
    );
    expect(
      screen.getByText("21").closest("time")?.parentElement,
    ).not.toHaveClass("bg-condition-attention-fill");
    expect(screen.getByText("Scan them")).toBeVisible();
    expect(screen.queryByText("No next move")).not.toBeInTheDocument();
  });

  it("orders due Follow-ups before Next Move Threads and plain Open Threads", () => {
    render(
      <AreaThreads
        threads={[
          thread("future", "Future Follow-up", { followUp: tomorrow }),
          thread("today", "Today Follow-up", { followUp: today }),
          thread("overdue", "Overdue Follow-up", { followUp: yesterday }),
          thread("open", "Plain Open Thread", { order: 0 }),
          thread("next", "Thread With Next Move", {
            nextMove: "Call the clinic",
            order: 2,
          }),
        ]}
        currentDate={today}
        onCreateThread={vi.fn()}
        onRemoveThread={vi.fn()}
      />,
    );

    expect(
      screen
        .getByText("Overdue Follow-up")
        .compareDocumentPosition(screen.getByText("Today Follow-up")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen
        .getByText("Today Follow-up")
        .compareDocumentPosition(screen.getByText("Future Follow-up")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen
        .getByText("Future Follow-up")
        .compareDocumentPosition(screen.getByText("Thread With Next Move")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      screen
        .getByText("Thread With Next Move")
        .compareDocumentPosition(screen.getByText("Plain Open Thread")),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
