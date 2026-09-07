import type { Id } from "@convex/_generated/dataModel";
import type { ProjectedActivityLog } from "@convex/lib/validators";

import userEvent from "@testing-library/user-event";
import { subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "@/test/render-with-providers";

import { ActivityLog } from "./thread-log";

const now = new Date("2026-05-19T12:00:00Z").getTime();

const areaMove = {
  _id: "log1" as Id<"activityLogs">,
  type: "area_move",
  content: 'Moved from "Health" to "Finances"',
  previousValue: "Health",
  newValue: "Finances",
  createdAt: now,
} satisfies ProjectedActivityLog;

const followUp = {
  _id: "log2" as Id<"activityLogs">,
  type: "follow_up_change",
  content: "Follow-up set",
  newValue: "May 20, 2026",
  createdAt: now - 60_000,
} satisfies ProjectedActivityLog;

describe("ActivityLog", () => {
  it("renders only automatic changes and offers no manual entry controls", () => {
    render(<ActivityLog logs={[areaMove, followUp]} />);

    expect(
      screen.queryByRole("heading", { name: "Activity log" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Activity log")).toBeVisible();
    expect(screen.getByText("Health → Finances")).toHaveClass(
      "text-muted-foreground/80",
    );
    expect(screen.getByText("Set to May 20, 2026")).toBeVisible();
    expect(screen.getByText("Area")).toHaveClass("sr-only");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add note" })).toBeNull();
  });

  it("groups automatic changes by day", () => {
    const currentTime = Date.now();
    const yesterday = subDays(new Date(currentTime), 1).getTime();

    render(
      <ActivityLog
        logs={[
          { ...areaMove, createdAt: currentTime },
          { ...followUp, createdAt: yesterday },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Today" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Yesterday" }),
    ).toBeInTheDocument();
  });

  it("uses a read-only continuity empty state", () => {
    render(<ActivityLog logs={[]} />);

    expect(
      screen.getByText(
        "Automatic Thread changes will appear here as they happen.",
      ),
    ).toBeInTheDocument();
  });

  it("captions the timeline origin with how long the Thread has been still", () => {
    const { rerender } = render(<ActivityLog logs={[]} />);

    expect(screen.getByText("No activity yet")).toBeVisible();

    rerender(
      <ActivityLog
        logs={[areaMove]}
        lastActivityAt={subDays(new Date(), 3).getTime()}
      />,
    );

    expect(screen.getByText("Updated 3 days ago")).toBeVisible();
  });

  it("loads earlier automatic changes on request", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <ActivityLog logs={[areaMove]} canLoadMore onLoadMore={onLoadMore} />,
    );

    await user.click(screen.getByRole("button", { name: "Show earlier" }));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
