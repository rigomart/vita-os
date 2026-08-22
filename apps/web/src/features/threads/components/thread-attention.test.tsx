import userEvent from "@testing-library/user-event";
import { addDays, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test/render-with-providers";

import { ThreadAttention } from "./thread-attention";

const now = new Date("2026-08-13T12:00:00").getTime();

function renderAttention(
  props: Partial<Parameters<typeof ThreadAttention>[0]> = {},
) {
  const handlers = {
    onSetNextMove: vi.fn(),
    onClearNextMove: vi.fn(),
    onCompleteNextMove: vi.fn(),
    onReplaceUpNext: vi.fn(),
    onSetFollowUp: vi.fn(),
    onClearFollowUp: vi.fn(),
  };

  const { unmount } = render(
    <ThreadAttention
      nextMove={undefined}
      upNext={[]}
      followUp={undefined}
      now={now}
      {...handlers}
      {...props}
    />,
  );

  return { ...handlers, unmount };
}

/** The waiting moves, in the order the cascade hangs them. */
function upNextRows() {
  return within(screen.getByRole("list", { name: "Up Next" })).getAllByRole(
    "listitem",
  );
}

describe("ThreadAttention", () => {
  it("states the whole attention state without any interaction", () => {
    renderAttention({
      nextMove: "Call the clinic",
      upNext: ["Book the scan", "Collect the results"],
      followUp: now,
    });

    const attention = screen.getByRole("region", { name: "Thread attention" });
    expect(within(attention).getByText("Call the clinic")).toBeVisible();
    expect(within(attention).getByText("Aug 13")).toBeVisible();
    expect(
      within(attention).getByRole("button", { name: "Follow up Aug 13" }),
    ).toBeVisible();
    expect(
      within(attention).getByRole("button", { name: "Complete next move" }),
    ).toBeVisible();

    const rows = upNextRows();
    expect(
      within(rows[0]!).getByRole("button", { name: "Book the scan" }),
    ).toBeVisible();
    expect(
      within(rows[1]!).getByRole("button", { name: "Collect the results" }),
    ).toBeVisible();
  });

  it("counts the line only while moves are waiting", () => {
    const { unmount } = renderAttention({ nextMove: "Call the clinic" });

    expect(screen.getByText("Up Next")).toBeVisible();
    expect(screen.queryByRole("list", { name: "Up Next" })).toBeNull();
    expect(screen.queryByText(/·/)).toBeNull();
    unmount();

    renderAttention({ upNext: ["Book the scan", "Collect the results"] });
    expect(screen.getByText("· 2")).toBeVisible();
  });

  it("takes a new next move on Enter and on blur", async () => {
    const user = userEvent.setup();
    const { onSetNextMove } = renderAttention();

    const field = screen.getByRole("textbox", { name: "Next move" });
    await user.type(field, "Call the clinic{Enter}");
    expect(onSetNextMove).toHaveBeenCalledWith("Call the clinic");

    await user.type(field, "  Book the scan  ");
    await user.tab();
    expect(onSetNextMove).toHaveBeenLastCalledWith("Book the scan");
    expect(onSetNextMove).toHaveBeenCalledTimes(2);
  });

  it("edits an existing next move in place", async () => {
    const user = userEvent.setup();
    const { onSetNextMove } = renderAttention({ nextMove: "Call the clinic" });

    await user.click(screen.getByText("Call the clinic"));
    const editor = screen.getByDisplayValue("Call the clinic");
    await user.clear(editor);
    await user.type(editor, "Book appointment{Enter}");

    expect(onSetNextMove).toHaveBeenCalledWith("Book appointment");
  });

  it("completes and clears the next move", async () => {
    const user = userEvent.setup();
    const { onCompleteNextMove, onClearNextMove } = renderAttention({
      nextMove: "Call the clinic",
    });

    await user.click(
      screen.getByRole("button", { name: "Complete next move" }),
    );
    expect(onCompleteNextMove).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Clear next move" }));
    expect(onClearNextMove).toHaveBeenCalled();
  });

  it("disables only the actions that are in flight", () => {
    renderAttention({
      nextMove: "Call the clinic",
      followUp: now,
      pending: { clear: true },
    });

    expect(
      screen.getByRole("button", { name: "Clear next move" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Complete next move" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Follow up Aug 13" }),
    ).not.toBeDisabled();
  });

  it("appends a move to the back of the line", async () => {
    const user = userEvent.setup();
    const { onReplaceUpNext } = renderAttention({
      nextMove: "Call the clinic",
      upNext: ["Book the scan"],
    });

    const field = screen.getByRole("textbox", { name: "Add an upcoming move" });
    await user.type(field, "  Collect the results  {Enter}");
    expect(onReplaceUpNext).toHaveBeenCalledWith([
      "Book the scan",
      "Collect the results",
    ]);

    // Escape abandons the draft, so the blur that follows commits nothing.
    await user.type(field, "Never mind{Escape}");
    await user.tab();
    expect(onReplaceUpNext).toHaveBeenCalledTimes(1);
  });

  it("edits, reorders and removes upcoming moves as the whole line", async () => {
    const user = userEvent.setup();
    const { onReplaceUpNext } = renderAttention({
      nextMove: "Call the clinic",
      upNext: ["Book the scan", "Collect the results"],
    });

    await user.click(
      within(upNextRows()[1]!).getByRole("button", { name: "Move earlier" }),
    );
    expect(onReplaceUpNext).toHaveBeenLastCalledWith([
      "Collect the results",
      "Book the scan",
    ]);

    await user.click(
      within(upNextRows()[0]!).getByRole("button", { name: "Move later" }),
    );
    expect(onReplaceUpNext).toHaveBeenLastCalledWith([
      "Collect the results",
      "Book the scan",
    ]);

    await user.click(
      within(upNextRows()[0]!).getByRole("button", {
        name: "Remove upcoming move",
      }),
    );
    expect(onReplaceUpNext).toHaveBeenLastCalledWith(["Collect the results"]);

    await user.click(
      within(upNextRows()[0]!).getByRole("button", { name: "Book the scan" }),
    );
    const editor = screen.getByDisplayValue("Book the scan");
    await user.clear(editor);
    await user.type(editor, "Book the MRI{Enter}");
    expect(onReplaceUpNext).toHaveBeenLastCalledWith([
      "Book the MRI",
      "Collect the results",
    ]);
  });

  it("pins the ends of the line", () => {
    renderAttention({
      nextMove: "Call the clinic",
      upNext: ["Book the scan", "Collect the results"],
    });

    const rows = upNextRows();
    expect(
      within(rows[0]!).getByRole("button", { name: "Move earlier" }),
    ).toBeDisabled();
    expect(
      within(rows[1]!).getByRole("button", { name: "Move later" }),
    ).toBeDisabled();
  });

  it("keeps the row controls reachable on touch", () => {
    renderAttention({
      nextMove: "Call the clinic",
      upNext: ["Book the scan"],
    });

    // `xl` is THREAD_PANE_BREAKPOINT: the rail hides them until the row is
    // hovered or focused, the drawer never does.
    expect(
      within(upNextRows()[0]!).getByRole("button", {
        name: "Remove upcoming move",
      }).parentElement,
    ).toHaveClass("xl:opacity-0");
    expect(
      screen.getByRole("textbox", { name: "Add an upcoming move" }),
    ).toHaveClass("h-9", "xl:h-7");
  });

  it("picks a follow-up date from the calendar and clears it", async () => {
    const user = userEvent.setup();
    const { onSetFollowUp, onClearFollowUp } = renderAttention({
      followUp: now,
    });

    await user.click(screen.getByRole("button", { name: "Follow up Aug 13" }));
    expect(
      await screen.findByText(/A soft date — the Thread comes back/),
    ).toBeVisible();
    await user.click(within(await screen.findByRole("grid")).getByText("20"));

    expect(onSetFollowUp).toHaveBeenCalledWith(new Date(2026, 7, 20).getTime());

    await user.click(screen.getByRole("button", { name: "Clear follow-up" }));
    expect(onClearFollowUp).toHaveBeenCalled();
  });

  it("tones a late follow-up the way the rest of the app does", () => {
    const { unmount } = renderAttention({
      followUp: subDays(new Date(now), 2).getTime(),
    });
    expect(screen.getByText("Aug 11")).toHaveClass("text-condition-attention");
    unmount();

    renderAttention({ followUp: addDays(new Date(now), 9).getTime() });
    expect(screen.getByText("Aug 22")).toHaveClass("text-muted-foreground");
  });
});
