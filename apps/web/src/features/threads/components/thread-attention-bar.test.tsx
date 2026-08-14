import userEvent from "@testing-library/user-event";
import { addDays, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";

import { render, screen, within } from "@/test/render-with-providers";

import { ThreadAttentionBar } from "./thread-attention-bar";

const now = new Date("2026-08-13T12:00:00").getTime();

function renderBar(props: Partial<Parameters<typeof ThreadAttentionBar>[0]>) {
  const handlers = {
    onSetNextMove: vi.fn(),
    onClearNextMove: vi.fn(),
    onCompleteNextMove: vi.fn(),
    onSetFollowUp: vi.fn(),
    onClearFollowUp: vi.fn(),
  };

  render(
    <ThreadAttentionBar
      nextMove={undefined}
      followUp={undefined}
      now={now}
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

describe("ThreadAttentionBar", () => {
  it("states both halves of attention without any interaction", () => {
    renderBar({ nextMove: "Call the clinic", followUp: now });

    const attention = screen.getByRole("region", { name: "Thread attention" });
    expect(within(attention).getByText("Call the clinic")).toBeVisible();
    expect(within(attention).getByText("Aug 13, 2026")).toBeVisible();
    expect(
      within(attention).getByRole("button", { name: "Complete next move" }),
    ).toBeVisible();
  });

  it("stacks the two controls below the Thread pane breakpoint", () => {
    renderBar({ followUp: now });

    // `xl` is THREAD_PANE_BREAKPOINT: one line as a rail, stacked as a drawer.
    expect(
      screen.getByRole("region", { name: "Thread attention" }),
    ).toHaveClass("flex-col", "xl:flex-row");
    expect(screen.getByRole("button", { name: /Follow-up/ })).toHaveClass(
      "w-full",
      "xl:w-auto",
    );
    expect(screen.getByRole("textbox", { name: "Next move" })).toHaveClass(
      "h-9",
      "xl:h-7",
    );
  });

  it("takes a new next move on Enter and on blur", async () => {
    const user = userEvent.setup();
    const { onSetNextMove } = renderBar({});

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
    const { onSetNextMove } = renderBar({ nextMove: "Call the clinic" });

    await user.click(screen.getByText("Call the clinic"));
    const editor = screen.getByDisplayValue("Call the clinic");
    await user.clear(editor);
    await user.type(editor, "Book appointment{Enter}");

    expect(onSetNextMove).toHaveBeenCalledWith("Book appointment");
  });

  it("completes and clears the next move", async () => {
    const user = userEvent.setup();
    const { onCompleteNextMove, onClearNextMove } = renderBar({
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
    renderBar({
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
      screen.getByRole("button", { name: /Follow-up/ }),
    ).not.toBeDisabled();
  });

  it("picks a follow-up date from the calendar and clears it", async () => {
    const user = userEvent.setup();
    const { onSetFollowUp, onClearFollowUp } = renderBar({ followUp: now });

    await user.click(screen.getByRole("button", { name: /Follow-up/ }));
    await user.click(within(await screen.findByRole("grid")).getByText("20"));

    expect(onSetFollowUp).toHaveBeenCalledWith(new Date(2026, 7, 20).getTime());

    await user.click(screen.getByRole("button", { name: "Clear follow-up" }));
    expect(onClearFollowUp).toHaveBeenCalled();
  });

  it("tones a late follow-up the way the rest of the app does", () => {
    const { unmount } = render(
      <ThreadAttentionBar
        nextMove={undefined}
        followUp={subDays(new Date(now), 2).getTime()}
        now={now}
        onSetNextMove={vi.fn()}
        onClearNextMove={vi.fn()}
        onCompleteNextMove={vi.fn()}
        onSetFollowUp={vi.fn()}
        onClearFollowUp={vi.fn()}
      />,
    );
    expect(screen.getByText("Aug 11, 2026")).toHaveClass(
      "text-condition-attention",
    );
    unmount();

    renderBar({ followUp: addDays(new Date(now), 9).getTime() });
    expect(screen.getByText("Aug 22, 2026")).toHaveClass("text-foreground");
  });
});
