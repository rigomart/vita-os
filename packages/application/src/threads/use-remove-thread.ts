import type { Thread } from "@vita-os/contracts";

import { useRemoveThread as useRemoveThreadCommand } from "./hooks";

export function useRemoveThread(thread: Thread) {
  const removeThread = useRemoveThreadCommand();

  return () => removeThread.mutateAsync({ thread });
}
