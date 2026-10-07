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
    it.each(["weekly Friday", "Never"] as const)(
      "waits for %s before saving a picked Wednesday under the new rule",
      async (choice) => {
        const service = setup(surface);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: /^Change date/ }));
        const repeat = await screen.findByRole("group", { name: "Repeat" });
        if (choice === "Never")
          await user.click(
            within(repeat).getByRole("button", { name: "Never" }),
          );
        else {
          await user.click(
            within(repeat).getByRole("button", { name: "Monday" }),
          );
          await user.click(
            within(repeat).getByRole("button", { name: "Friday" }),
          );
        }
        await user.click(
          within(screen.getByRole("grid")).getByRole("button", {
            name: /Wednesday, August 5th, 2026/,
          }),
        );
        await waitFor(() =>
          expect(service.setTaskRepeat).toHaveBeenCalledTimes(1),
        );
        const dateSentWhileRepeatPending =
          service.setTaskDate.mock.calls.length;
        await act(async () => service.repeatAnswer.resolve());
        await waitFor(() =>
          expect(service.setTaskDate).toHaveBeenCalledTimes(1),
        );
        const saved = service.stored().tasks![0]!;
        expect(saved.date).toBe(aug(choice === "Never" ? 5 : 7));
        expect(saved.repeat).toEqual(
          choice === "Never" ? undefined : { kind: "weekly", weekdays: [5] },
        );
        expect(dateSentWhileRepeatPending).toBe(0);
      },
    );
  },
);
