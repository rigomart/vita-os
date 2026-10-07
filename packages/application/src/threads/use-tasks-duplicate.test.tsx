import type { OperationResult, Task, TaskId, Thread } from "@vita-os/contracts";

import userEvent from "@testing-library/user-event";
import { nextTaskDate } from "@vita-os/core";
import { describe, expect, it, vi } from "vitest";

import { queryKeys } from "../query-keys";
import {
  createQuietApplicationClient,
  deferred,
  success,
} from "../test/fake-application-client";
import { aThread } from "../test/fixtures";
import {
  act,
  createTestQueryClient,
  render,
  screen,
  waitFor,
} from "../test/render-with-providers";
import { ThreadAttentionSection } from "./components/thread-attention-section";
import { useOpenThreads } from "./hooks";
const task: Task = {
  _id: "repeat" as TaskId,
  text: "Check in",
  date: new Date(2026, 9, 7, 12).getTime(),
  repeat: { kind: "days", every: 1 },
};
const seed = aThread({ tasks: [task] });
function Surface() {
  const threads = useOpenThreads();
  return threads.data?.[0] ? (
    <ThreadAttentionSection thread={threads.data[0]} />
  ) : null;
}
describe("rendered pending Task controls", () => {
  it.each(["Complete task", "Skip task"])(
    "%s accepts a double click once and advances a repeating Task once",
    async (label) => {
      const answer = deferred<OperationResult<Thread>>();
      const completeTask = vi.fn(() => answer.promise);
      const skipTask = vi.fn(() => answer.promise);
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(queryKeys.threads.open(), [seed]);
      const applicationClient = createQuietApplicationClient({
        completeTask,
        skipTask,
        listOpenThreads: async () => success([seed]),
      });
      render(<Surface />, { applicationClient, queryClient });
      const user = userEvent.setup();
      const button = screen.getByRole("button", { name: label });
      await user.dblClick(button);
      await waitFor(() => expect(button).toBeDisabled());
      const command = label === "Complete task" ? completeTask : skipTask;
      expect(command).toHaveBeenCalledTimes(1);
      expect(command).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId: seed._id,
          taskId: task._id,
          expectedOccurrence: task.date,
        }),
      );
      const next = nextTaskDate(
        task.date!,
        task.repeat!,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        Date.now(),
      );
      expect(
        queryClient.getQueryData<Thread[]>(queryKeys.threads.open())?.[0]
          ?.tasks?.[0]?.date,
      ).toBe(next);
      await act(async () =>
        answer.resolve(success({ ...seed, tasks: [{ ...task, date: next }] })),
      );
      await waitFor(() => expect(button).toBeEnabled());
    },
  );
});
