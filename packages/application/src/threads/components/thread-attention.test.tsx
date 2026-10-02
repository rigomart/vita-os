import type { Move, MoveId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { addDays, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { render, screen, within } from "../../test/render-with-providers";
import { ThreadAttention } from "./thread-attention";

const now = new Date("2026-08-13T12:00:00").getTime();
/** Today as the picker stores a date alone: local midnight. */
const today = new Date(2026, 7, 13).getTime();

const callClinic: Move = { _id: "move-1" as MoveId, text: "Call the clinic" };
const bookScan: Move = { _id: "move-2" as MoveId, text: "Book the scan" };
const collect: Move = { _id: "move-3" as MoveId, text: "Collect the results" };

function renderAttention(
  props: Partial<Parameters<typeof ThreadAttention>[0]> = {},
) {
  const handlers = {
    onAddMove: vi.fn(),
    onEditMove: vi.fn(),
    onRemoveMove: vi.fn(),
    onCompleteMove: vi.fn(),
    onFocusMove: vi.fn(),
    onSetFollowUp: vi.fn(),
    onClearFollowUp: vi.fn(),
  };

  const { unmount } = render(
    <ThreadAttention
      moves={[]}
      followUp={undefined}
      now={now}
      {...handlers}
      {...props}
    />,
  );

  return { ...handlers, unmount };
}

function moveRows() {
  return within(screen.getByRole("list", { name: "Moves" })).getAllByRole(
    "listitem",
  );
}

describe("ThreadAttention", () => {
  it("lists every Move in capture order, highlighting the Focused Move where it sits", () => {
    renderAttention({
      moves: [callClinic, bookScan, collect],
      focusedMoveId: bookScan._id,
      followUp: today,
    });

    const rows = moveRows();
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Call the clinic"),
      expect.stringContaining("Book the scan"),
      expect.stringContaining("Collect the results"),
    ]);
    expect(rows[1]).toHaveAttribute("data-focused", "true");
    expect(rows[0]).not.toHaveAttribute("data-focused");
    expect(
      within(rows[1]!).getByRole("button", { name: "Unfocus this move" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(rows[0]!).getByRole("button", { name: "Focus this move" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("3")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Follow up Aug 13" }),
    ).toBeVisible();
  });

  it("toggles focus from the radio: focusing another replaces it, focusing the focused one unfocuses", async () => {
    const user = userEvent.setup();
    const { onFocusMove } = renderAttention({
      moves: [callClinic, bookScan],
      focusedMoveId: callClinic._id,
    });

    await user.click(
      within(moveRows()[1]!).getByRole("button", { name: "Focus this move" }),
    );
    expect(onFocusMove).toHaveBeenLastCalledWith(bookScan._id);

    await user.click(
      within(moveRows()[0]!).getByRole("button", { name: "Unfocus this move" }),
    );
    expect(onFocusMove).toHaveBeenLastCalledWith(null);
  });

  it("highlights nothing when nothing is focused", () => {
    renderAttention({ moves: [callClinic, bookScan] });

    expect(
      moveRows().filter((row) => row.hasAttribute("data-focused")),
    ).toEqual([]);
    expect(
      screen.getByText(
        "Focus one when you know it, or leave them all unfocused.",
      ),
    ).toBeVisible();
  });

  it("completes and removes any Move, focused or not", async () => {
    const user = userEvent.setup();
    const { onCompleteMove, onRemoveMove } = renderAttention({
      moves: [callClinic, bookScan],
      focusedMoveId: callClinic._id,
    });

    await user.click(
      within(moveRows()[1]!).getByRole("button", { name: "Complete move" }),
    );
    expect(onCompleteMove).toHaveBeenCalledWith(bookScan._id);

    await user.click(
      within(moveRows()[0]!).getByRole("button", { name: "Remove move" }),
    );
    expect(onRemoveMove).toHaveBeenCalledWith(callClinic._id);
  });

  it("edits a Move in place", async () => {
    const user = userEvent.setup();
    const { onEditMove } = renderAttention({ moves: [callClinic] });

    await user.click(screen.getByText("Call the clinic"));
    const editor = screen.getByDisplayValue("Call the clinic");
    await user.clear(editor);
    await user.type(editor, "Book appointment{Enter}");

    expect(onEditMove).toHaveBeenCalledWith(callClinic._id, "Book appointment");
  });

  it("captures a Move on Enter and on blur, never asking about focus", async () => {
    const user = userEvent.setup();
    const { onAddMove, onFocusMove } = renderAttention();

    expect(screen.queryByRole("list", { name: "Moves" })).toBeNull();
    const field = screen.getByRole("textbox", { name: "Add a move" });
    await user.type(field, "Call the clinic{Enter}");
    expect(onAddMove).toHaveBeenCalledWith("Call the clinic");

    await user.type(field, "  Book the scan  ");
    await user.tab();
    expect(onAddMove).toHaveBeenLastCalledWith("Book the scan");
    expect(onAddMove).toHaveBeenCalledTimes(2);
    expect(onFocusMove).not.toHaveBeenCalled();

    await user.type(field, "   {Enter}");
    expect(onAddMove).toHaveBeenCalledTimes(2);
  });

  it("keeps the row controls reachable on touch", () => {
    renderAttention({ moves: [callClinic] });

    // `xl` is THREAD_PANE_BREAKPOINT: the rail hides removal until the row is
    // hovered or focused, the drawer never does.
    expect(
      within(moveRows()[0]!).getByRole("button", { name: "Remove move" }),
    ).toHaveClass("xl:opacity-0");
    expect(
      within(moveRows()[0]!).getByRole("button", { name: "Complete move" }),
    ).toHaveClass("size-8", "xl:size-6");
    expect(screen.getByRole("textbox", { name: "Add a move" })).toHaveClass(
      "h-9",
      "xl:h-7",
    );
  });

  it("picks a follow-up date from the calendar and clears it", async () => {
    const user = userEvent.setup();
    const { onSetFollowUp, onClearFollowUp } = renderAttention({
      followUp: today,
    });

    await user.click(screen.getByRole("button", { name: "Follow up Aug 13" }));
    expect(
      await screen.findByText("When to bring this Thread back."),
    ).toBeVisible();
    // The time waits behind its button until asked for.
    expect(screen.queryByLabelText("Time")).not.toBeInTheDocument();
    // The calendar opens on the Follow-up's month.
    await user.click(within(await screen.findByRole("grid")).getByText("20"));
    expect(onSetFollowUp).toHaveBeenCalledWith(new Date(2026, 7, 20).getTime());

    await user.click(screen.getByRole("button", { name: "Clear follow-up" }));
    expect(onClearFollowUp).toHaveBeenCalled();
  });

  it("adds a time to the follow-up once, when the picker closes", async () => {
    const user = userEvent.setup();
    const { onSetFollowUp } = renderAttention({ followUp: today });

    await user.click(screen.getByRole("button", { name: "Follow up Aug 13" }));
    await user.click(await screen.findByRole("button", { name: "Add time" }));
    const time = screen.getByLabelText("Time");
    expect(time).toHaveFocus();
    await user.type(time, "15:30");
    expect(onSetFollowUp).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onSetFollowUp).toHaveBeenCalledExactlyOnceWith(
      new Date(2026, 7, 13, 15, 30).getTime(),
    );
  });

  it("shows a follow-up's time beside its date, and removes it", async () => {
    const user = userEvent.setup();
    const { onSetFollowUp } = renderAttention({
      followUp: new Date(2026, 7, 13, 9).getTime(),
    });

    await user.click(
      screen.getByRole("button", { name: "Follow up Aug 13 · 9 AM" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "Remove time" }),
    );
    expect(screen.getByRole("button", { name: "Add time" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(onSetFollowUp).toHaveBeenCalledExactlyOnceWith(today);
  });

  it("tones a late follow-up the way the rest of the app does", () => {
    const { unmount } = renderAttention({
      followUp: subDays(new Date(today), 2).getTime(),
    });
    expect(screen.getByText("Aug 11")).toHaveClass("text-condition-attention");
    unmount();

    renderAttention({ followUp: addDays(new Date(today), 9).getTime() });
    expect(screen.getByText("Aug 22")).toHaveClass("text-muted-foreground");
  });
});
