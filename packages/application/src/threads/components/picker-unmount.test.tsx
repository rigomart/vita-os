import type { Task, TaskId, Thread } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../../query-keys";
import {
  createFakeApplicationClient,
  success,
} from "../../test/fake-application-client";
import { aThread } from "../../test/fixtures";
import {
  createTestQueryClient,
  render,
  screen,
  waitFor,
  within,
} from "../../test/render-with-providers";
import { ThreadAttentionSection } from "./thread-attention-section";

const evening = new Date(2026, 7, 13, 21).getTime();
const checkIn: Task = {
  _id: "check-in" as TaskId,
  text: "Evening check-in",
  date: evening,
};
const seed = aThread({ revision: 4, tasks: [checkIn] });

/**
 * Thread detail with a Task's picker open and Daily chosen but not saved;
 * then something changes the cache, and the surface goes away.
 */
async function draftThenUnmount(change: (thread: Thread) => Thread[]) {
  const user = userEvent.setup();
  const setTaskRepeat = vi.fn(async () => success(seed));
  const setTaskDate = vi.fn(async () => success(seed));
  const client = createFakeApplicationClient({ setTaskRepeat, setTaskDate });
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(queryKeys.threads.open(), [seed]);
  const { rerender, feedback } = render(
    <ThreadAttentionSection thread={seed} />,
    { applicationClient: client, queryClient },
  );

  await user.click(screen.getByRole("button", { name: /^Change date/ }));
  await user.click(
    within(await screen.findByRole("group", { name: "Repeat" })).getByRole(
      "button",
      { name: "Daily" },
    ),
  );
  // A refresh brings what happened elsewhere, then the surface goes away
  // without rendering it, as a card that moved to another heading does.
  queryClient.setQueryData(queryKeys.threads.open(), change(seed));
  rerender(<></>);
  // Let anything the unmount sent reach the client.
  await new Promise((resolve) => setTimeout(resolve, 20));

  return { setTaskRepeat, setTaskDate, feedback };
}

describe("a Task's picker that goes away open", () => {
  it("saves its unsaved Repeat while the Task is still as shown", async () => {
    const { setTaskRepeat } = await draftThenUnmount((thread) => [thread]);

    await waitFor(() =>
      expect(setTaskRepeat).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          taskId: checkIn._id,
          repeat: { kind: "days", every: 1 },
        }),
      ),
    );
  });

  it("drops it when the Task's date changed elsewhere, rather than undo that change", async () => {
    const { setTaskRepeat, setTaskDate, feedback } = await draftThenUnmount(
      (thread) => [
        {
          ...thread,
          revision: 5,
          tasks: [{ ...checkIn, date: evening + 86_400_000 }],
        },
      ],
    );

    expect(setTaskRepeat).not.toHaveBeenCalled();
    expect(setTaskDate).not.toHaveBeenCalled();
    expect(feedback.error).not.toHaveBeenCalled();
  });

  it("drops it when the Thread was resolved or removed elsewhere, with no failure toast", async () => {
    const { setTaskRepeat, setTaskDate, feedback } = await draftThenUnmount(
      () => [],
    );

    expect(setTaskRepeat).not.toHaveBeenCalled();
    expect(setTaskDate).not.toHaveBeenCalled();
    expect(feedback.error).not.toHaveBeenCalled();
  });
});
