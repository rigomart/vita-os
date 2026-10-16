import type { Thread, ThreadId } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { cn } from "@vita-os/ui/lib/utils";
import { createContext, use, useMemo, useState } from "react";

import { datedTasks } from "./attention-board-model";

interface PointedThread {
  /** The Thread whose copy the pointer or keyboard is on. */
  threadId: ThreadId | null;
  enter: (threadId: ThreadId) => void;
  leave: (threadId: ThreadId) => void;
}

const PointedThreadContext = createContext<PointedThread>({
  threadId: null,
  enter: () => {},
  leave: () => {},
});

/** Holds which Thread is pointed at, so its copies across the board can ring. */
export function ThreadCopies({ children }: { children: ReactNode }) {
  const [threadId, setThreadId] = useState<ThreadId | null>(null);
  const value = useMemo<PointedThread>(
    () => ({
      threadId,
      enter: setThreadId,
      leave: (left) =>
        setThreadId((current) => (current === left ? null : current)),
    }),
    [threadId],
  );
  return <PointedThreadContext value={value}>{children}</PointedThreadContext>;
}

/**
 * One copy of a Thread on the board, card or one-line row. Hovering or
 * focusing it rings every copy of the Thread, so a Thread spread across the
 * week reads as one. A Thread that stands once never rings, and nothing rings
 * at rest: colour on the board belongs to time.
 */
export function ThreadCopy({
  children,
  className,
  thread,
}: {
  children: ReactNode;
  className?: string;
  thread: Thread;
}) {
  const pointed = use(PointedThreadContext);
  const ringed =
    pointed.threadId === thread._id && datedTasks(thread).length > 1;
  return (
    <div
      data-slot="thread-copy"
      data-ringed={ringed || undefined}
      onPointerEnter={() => pointed.enter(thread._id)}
      onPointerLeave={() => pointed.leave(thread._id)}
      onFocus={() => pointed.enter(thread._id)}
      onBlur={() => pointed.leave(thread._id)}
      className={cn(
        "transition-shadow motion-reduce:transition-none",
        ringed && "ring-2 ring-brand-accent/60",
        className,
      )}
    >
      {children}
    </div>
  );
}
