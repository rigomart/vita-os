import type {
  SetTaskDateInput,
  SetTaskRepeatInput,
  TaskId,
  Thread,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { decideSetTaskDate, decideSetTaskRepeat } from "@vita-os/core";
import { describe, expect, it, vi } from "vitest";

import { DashboardLine } from "../../dashboard/components/dashboard-line";
import { NO_DATE_LOOK } from "../../dashboard/components/dashboard-list-model";
import { queryKeys } from "../../query-keys";
import {
  createQuietApplicationClient,
  deferred,
  success,
} from "../../test/fake-application-client";
import { aThread } from "../../test/fixtures";
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { useOpenThreads } from "../hooks";
import { ThreadAttentionSection } from "./thread-attention-section";

const aug = (day: number) => new Date(2026, 7, day).getTime();
const taskId = "weekly" as TaskId;
const seed = aThread({
  tasks: [
    {
      _id: taskId,
      text: "Clinic call",
      date: aug(3),
      repeat: { kind: "weekly", weekdays: [1] },
    },
  ],
});

function Surface({ surface }: { surface: "detail" | "line" }) {
  const threads = useOpenThreads();
  const thread = threads.data?.[0];
  if (!thread) return null;
  return surface === "detail" ? (
    <ThreadAttentionSection thread={thread} />
  ) : (
    <DashboardLine
      dateInHeading={false}
      item={{ kind: "thread", thread }}
      look={NO_DATE_LOOK}
      scope={{ areaById: new Map(), currentDate: aug(1), onOpenNote: vi.fn() }}
    />
  );
}

/** Apply each real domain rule when its request finishes, including the current stored Repeat. */
function setup(surface: "detail" | "line") {
  let stored: Thread = seed;
  const repeatAnswer = deferred<void>();
  const setTaskRepeat = vi.fn(async (input: SetTaskRepeatInput) => {
    await repeatAnswer.promise;
    const change = decideSetTaskRepeat(
      stored,
      input.taskId,
      input.repeat,
      input.timeZone,
    )!;
    stored = { ...stored, ...change.patch };
    return success(stored);
  });
  const setTaskDate = vi.fn(async (input: SetTaskDateInput) => {
    const change = decideSetTaskDate(
      stored,
      input.taskId,
      input.date,
      input.timeZone,
    )!;
    stored = { ...stored, ...change.patch };
    return success(stored);
  });
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.threads.open(), [seed]);
  render(<Surface surface={surface} />, {
    queryClient,
    applicationClient: createQuietApplicationClient({
      setTaskRepeat,
      setTaskDate,
      listOpenThreads: async () => success([stored]),
    }),
  });
  return { repeatAnswer, setTaskRepeat, setTaskDate, stored: () => stored };
}

// One gesture across two openings of the picker, whose calendar jsdom draws
// slowly: on CI it takes most of the default five seconds.
describe.each(["detail", "line"] as const)(
  "%s date picker gesture",
  { timeout: 15_000 },
  (surface) => {
    it.each(["weekly Friday", "Stop repeating"] as const)(
      "holds the picker while %s saves, so a Wednesday picked next is judged by it",
      async (choice) => {
        const service = setup(surface);
        const user = userEvent.setup();
        // In Thread detail the date itself opens the picker; the line's button names no date.
        const trigger = () =>
          screen.getByRole("button", {
            name: surface === "detail" ? /^Change date:/ : "Change date",
          });
        await user.click(trigger());
        if (choice === "Stop repeating") {
          await user.click(
            await screen.findByRole("button", { name: "Stop repeating" }),
          );
        } else {
          await user.click(
            await screen.findByRole("button", { name: /^Custom/ }),
          );
          const custom = screen.getByRole("group", { name: "Custom repeat" });
          await user.click(
            within(custom).getByRole("button", { name: "Monday" }),
          );
          await user.click(
            within(custom).getByRole("button", { name: "Friday" }),
          );
          await user.click(
            within(custom).getByRole("button", { name: "Save repeat" }),
          );
        }
        await waitFor(() =>
          expect(service.setTaskRepeat).toHaveBeenCalledTimes(1),
        );
        // Nothing can be picked until the Repeat lands: a row's picker stays
        // open, its calendar held; a line's has closed, and its date is held.
        const wednesday = () =>
          screen.queryByRole("button", { name: /Wednesday, August 5th, 2026/ });
        if (surface === "detail") expect(wednesday()).toBeDisabled();
        else {
          expect(wednesday()).toBeNull();
          expect(trigger()).toBeDisabled();
        }

        await act(async () => service.repeatAnswer.resolve());
        if (surface === "line") {
          await waitFor(() => expect(trigger()).toBeEnabled());
          await user.click(trigger());
        }
        await waitFor(() => expect(wednesday()).toBeEnabled());
        await user.click(wednesday()!);
        await waitFor(() =>
          expect(service.setTaskDate).toHaveBeenCalledTimes(1),
        );
        const saved = service.stored().tasks![0]!;
        expect(saved.date).toBe(aug(choice === "Stop repeating" ? 5 : 7));
        expect(saved.repeat).toEqual(
          choice === "Stop repeating"
            ? undefined
            : { kind: "weekly", weekdays: [5] },
        );
      },
    );
  },
);
