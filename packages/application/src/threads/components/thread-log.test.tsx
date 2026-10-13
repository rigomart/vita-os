import type { ActivityLogEntry, ActivityLogEntryId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../../test/render-with-providers";
import { ActivityLog } from "./thread-log";

const now = new Date("2026-05-19T12:00:00Z").getTime();

const areaMove = {
  _id: "log1" as ActivityLogEntryId,
  type: "area_move",
  content: 'Moved from "Health" to "Finances"',
  previousValue: "Health",
  newValue: "Finances",
  createdAt: now,
} satisfies ActivityLogEntry;

const followUp = {
  _id: "log2" as ActivityLogEntryId,
  type: "follow_up_change",
  content: "Follow-up set",
  newValue: "May 20, 2026",
  createdAt: now - 60_000,
} satisfies ActivityLogEntry;

const resolution = {
  _id: "log3" as ActivityLogEntryId,
  type: "state_change",
  content:
    'Resolved thread: Deposit is back in full. — discarded tasks: "Cancel the broadband", "Redirect post"',
  previousValue: "open",
  newValue: "resolved",
  createdAt: now - 120_000,
} satisfies ActivityLogEntry;

/** The sentence an entry reads as, however its parts are styled. */
function sentence(text: string) {
  return screen.getByText(
    (_, element) =>
      element?.tagName === "P" && element.textContent?.endsWith(text) === true,
  );
}

describe("ActivityLog", () => {
  it("reads each automatic change as a sentence and offers no manual entry controls", () => {
    render(<ActivityLog logs={[areaMove, followUp]} />);

    expect(screen.getByLabelText("Activity log")).toBeVisible();
    expect(sentence("Moved to Finances, from Health")).toHaveTextContent(
      "Area: Moved to Finances, from Health",
    );
    expect(sentence("Set the Follow-up for May 20, 2026")).toBeVisible();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add note" })).toBeNull();
  });

  it("shows what a resolution carried: its note and the Tasks it dropped", () => {
    render(<ActivityLog logs={[resolution]} />);

    expect(sentence("Resolved the Thread")).toBeVisible();
    expect(screen.getByText("Deposit is back in full.")).toBeVisible();
    expect(screen.getByText("Dropped 2 open Tasks")).toBeVisible();
    expect(screen.getByText("Cancel the broadband")).toBeVisible();
    expect(screen.getByText("Redirect post")).toBeVisible();
  });

  it("writes a recorded Follow-up in the reader's time zone, time and all", () => {
    const may20 = new Date(2026, 4, 20).getTime();
    const jun1At3 = new Date(2026, 5, 1, 15).getTime();

    render(
      <ActivityLog
        logs={[
          {
            ...followUp,
            content: "Follow-up changed",
            previousValue: String(may20),
            newValue: String(jun1At3),
          },
        ]}
      />,
    );

    expect(
      sentence("Moved the Follow-up to Jun 1, 2026 · 3 PM, from May 20, 2026"),
    ).toBeVisible();
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
