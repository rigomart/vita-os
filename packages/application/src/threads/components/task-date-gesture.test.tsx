import type {
  SetTaskDateInput,
  SetTaskRepeatInput,
  TaskId,
  Thread,
} from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { decideSetTaskDate, decideSetTaskRepeat } from "@vita-os/core";
import { describe, expect, it, vi } from "vitest";

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
import { ConnectedThreadAttentionCard } from "./thread-attention-card";
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

function Surface({ surface }: { surface: "detail" | "card" }) {
  const threads = useOpenThreads();
  const thread = threads.data?.[0];
  if (!thread) return null;
  return surface === "detail" ? (
    <ThreadAttentionSection thread={thread} />
  ) : (
    <ConnectedThreadAttentionCard thread={thread} currentDate={aug(1)} />
  );
}

/** Apply each real domain rule when its request finishes, including the current stored Repeat. */
function setup(surface: "detail" | "card") {
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

describe.each(["detail", "card"] as const)(
  "%s date picker gesture",
  (surface) => {
    it.each(["weekly Friday", "Doesn't repeat"] as const)(
      "holds the picker while %s saves, so a Wednesday picked next is judged by it",
      async (choice) => {
        const service = setup(surface);
        const user = userEvent.setup();
        // In Thread detail the date itself opens the picker; the card's button names no date.
        const trigger = () =>
          screen.getByRole("button", {
            name: surface === "detail" ? /^Change date:/ : "Change date",
          });
        await user.click(trigger());
        await user.click(
          await screen.findByRole("button", { name: "Repeat, Mon" }),
        );
        if (choice === "Doesn't repeat") {
          await user.click(
            screen.getByRole("button", { name: "Doesn't repeat" }),
          );
        } else {
          await user.click(screen.getByRole("button", { name: "Custom…" }));
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
        // Nothing can be picked until the Repeat lands: a row's picker is
        // back on its menu, held; a card's has closed, and its date is held.
        const pickDate = () =>
          screen.queryByRole("button", { name: "Pick a date…" });
        if (surface === "detail") expect(pickDate()).toBeDisabled();
        else {
          expect(pickDate()).toBeNull();
          expect(trigger()).toBeDisabled();
        }

        await act(async () => service.repeatAnswer.resolve());
        if (surface === "card") {
          await waitFor(() => expect(trigger()).toBeEnabled());
          await user.click(trigger());
        }
        await waitFor(() => expect(pickDate()).toBeEnabled());
        await user.click(pickDate()!);
        await user.click(
          within(screen.getByRole("grid")).getByRole("button", {
            name: /Wednesday, August 5th, 2026/,
          }),
        );
        await waitFor(() =>
          expect(service.setTaskDate).toHaveBeenCalledTimes(1),
        );
        const saved = service.stored().tasks![0]!;
        expect(saved.date).toBe(aug(choice === "Doesn't repeat" ? 5 : 7));
        expect(saved.repeat).toEqual(
          choice === "Doesn't repeat"
            ? undefined
            : { kind: "weekly", weekdays: [5] },
        );
      },
    );
  },
);
