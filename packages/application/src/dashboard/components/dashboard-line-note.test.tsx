import type { Note, NoteId } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "../../test/render-with-providers";
import { DashboardLine } from "./dashboard-line";
import { NO_DATE_LOOK } from "./dashboard-list-model";

const mocks = vi.hoisted(() => ({
  archiveNote: vi.fn(),
  completeNote: vi.fn(),
  setNoteRepeat: vi.fn(),
  updateNoteBody: vi.fn(),
  updateNoteWhen: vi.fn(),
}));

vi.mock("../../notes/use-archive-note", () => ({
  useArchiveNote: () => mocks.archiveNote,
}));

vi.mock("../../notes/use-complete-note", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../notes/use-complete-note")>()),
  useCompleteNote: () => mocks.completeNote,
}));

vi.mock("../../notes/use-set-note-repeat", () => ({
  useSetNoteRepeat: () => mocks.setNoteRepeat,
}));

vi.mock("../../notes/use-update-note-body", () => ({
  useUpdateNoteBody: () => mocks.updateNoteBody,
}));

vi.mock("../../notes/use-update-note-when", () => ({
  useUpdateNoteWhen: () => mocks.updateNoteWhen,
}));

const currentDate = new Date(2026, 6, 17, 12).getTime();

function note(body: string, fields: Partial<Note> = {}): Note {
  return {
    _id: "note1" as NoteId,
    body,
    state: "open",
    createdAt: currentDate,
    ...fields,
  };
}

function NoteLine({
  dateInHeading = false,
  note,
  onOpenNote = vi.fn(),
}: {
  dateInHeading?: boolean;
  note: Note;
  onOpenNote?: (note: Note) => void;
}) {
  return (
    <DashboardLine
      dateInHeading={dateInHeading}
      item={{ kind: "note", note }}
      look={NO_DATE_LOOK}
      scope={{ areaById: new Map(), currentDate, onOpenNote }}
    />
  );
}

describe("a Note's line", () => {
  beforeEach(() => {
    mocks.archiveNote.mockReset();
    mocks.completeNote.mockReset();
    mocks.setNoteRepeat.mockReset();
    mocks.updateNoteBody.mockReset();
    mocks.updateNoteWhen.mockReset();
  });

  it("opens the Note from its first line, in plain text", async () => {
    const user = userEvent.setup();
    const onOpenNote = vi.fn();
    const saved = note(
      "# Consultation\n**Next steps** [Clinic](https://example.com)",
    );
    render(<NoteLine note={saved} onOpenNote={onOpenNote} />);

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    const preview = screen.getByRole("button", {
      name: /Open note: Consultation/,
    });
    expect(preview).toHaveAccessibleName(
      /^Open note: Consultation\s+Next steps Clinic$/,
    );
    expect(preview).toHaveTextContent(/^Consultation$/);
    await user.click(preview);
    expect(onOpenNote).toHaveBeenCalledExactlyOnceWith(saved);
  });

  it("completes the note from its line and says so", async () => {
    const user = userEvent.setup();
    const onOpenNote = vi.fn();
    mocks.archiveNote.mockResolvedValue(undefined);
    const { feedback } = render(
      <NoteLine note={note("Water the plants")} onOpenNote={onOpenNote} />,
    );

    expect(
      screen.queryByRole("button", { name: /done/i }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Complete note" }));

    expect(mocks.archiveNote).toHaveBeenCalledExactlyOnceWith("note1");
    await waitFor(() =>
      expect(feedback.success).toHaveBeenCalledWith("Note completed"),
    );
    expect(mocks.updateNoteBody).not.toHaveBeenCalled();
    expect(onOpenNote).not.toHaveBeenCalled();
  });

  it("dates itself with the board's token and says it is a Note where a Thread names its Area", () => {
    render(
      <NoteLine
        note={note("Water the plants", {
          followUp: currentDate - 2 * 24 * 60 * 60 * 1000,
        })}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Change follow-up date" }),
    ).toHaveTextContent("−2d");
    expect(screen.getByText("Note")).toBeInTheDocument();
  });

  describe("repeating", () => {
    // Today, with no time, monthly on its own day.
    const today = new Date(2026, 6, 17).getTime();
    const monthly = { kind: "monthly", day: 17 } as const;

    it("offers Complete in place of Archive, naming where it goes back to", async () => {
      const user = userEvent.setup();
      const onOpenNote = vi.fn();
      const repeating = note("Pay the utility bill", {
        followUp: today,
        repeat: monthly,
      });
      mocks.completeNote.mockResolvedValue(undefined);
      render(<NoteLine note={repeating} onOpenNote={onOpenNote} />);

      expect(
        screen.queryByRole("button", { name: "Complete note" }),
      ).not.toBeInTheDocument();
      const complete = screen.getByRole("button", {
        name: "Complete · back Aug 17",
      });
      expect(complete).toHaveAttribute("title", "Complete · back Aug 17");
      await user.click(complete);

      expect(mocks.completeNote).toHaveBeenCalledExactlyOnceWith(repeating);
      expect(mocks.archiveNote).not.toHaveBeenCalled();
      expect(onOpenNote).not.toHaveBeenCalled();
    });

    it("completes once while the first completion is in flight", async () => {
      const user = userEvent.setup();
      let finish: () => void = () => undefined;
      mocks.completeNote.mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      render(
        <NoteLine
          note={note("Pay the utility bill", {
            followUp: today,
            repeat: monthly,
          })}
        />,
      );

      const complete = screen.getByRole("button", { name: /^Complete/ });
      await user.click(complete);
      await user.click(complete);

      expect(mocks.completeNote).toHaveBeenCalledTimes(1);
      finish();
    });

    it("says so when completing fails", async () => {
      const user = userEvent.setup();
      mocks.completeNote.mockRejectedValue({
        code: "conflict",
        message: "Moved.",
        retryable: false,
      });
      const { feedback } = render(
        <NoteLine
          note={note("Pay the utility bill", {
            followUp: today,
            repeat: monthly,
          })}
        />,
      );

      await user.click(screen.getByRole("button", { name: /^Complete/ }));

      await waitFor(() =>
        expect(feedback.error).toHaveBeenCalledWith(
          "This note changed elsewhere. It has been refreshed.",
        ),
      );
    });

    it("wears the repeat glyph on its date, even under its day's heading", () => {
      render(
        <NoteLine
          dateInHeading
          note={note("Pay the utility bill", {
            followUp: today,
            repeat: monthly,
          })}
        />,
      );

      const date = screen.getByRole("button", {
        name: "Change follow-up date",
      });
      expect(date.querySelector('[data-slot="repeat-glyph"]')).toHaveAttribute(
        "aria-label",
        "Repeats monthly on the 17th",
      );
    });

    it("offers a plain Complete and no glyph on a one-off Note", () => {
      render(<NoteLine note={note("Water the plants", { followUp: today })} />);

      expect(
        screen.getByRole("button", { name: "Complete note" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /^Complete · / }),
      ).not.toBeInTheDocument();
      expect(document.querySelector('[data-slot="repeat-glyph"]')).toBeNull();
    });

    it("sets a Repeat from the date's picker", async () => {
      const user = userEvent.setup();
      mocks.setNoteRepeat.mockResolvedValue(undefined);
      render(
        <NoteLine note={note("Pay the utility bill", { followUp: today })} />,
      );

      await user.click(
        screen.getByRole("button", { name: "Change follow-up date" }),
      );
      await user.click(
        await screen.findByRole("button", { name: "Every month on the 17th" }),
      );

      expect(mocks.setNoteRepeat).toHaveBeenCalledExactlyOnceWith(
        "note1",
        monthly,
      );
    });
  });
});
