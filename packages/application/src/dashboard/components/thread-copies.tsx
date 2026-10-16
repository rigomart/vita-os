import type { Thread, ThreadId } from "@vita-os/contracts";
import type { FocusEvent, ReactNode } from "react";

import { cn } from "@vita-os/ui/lib/utils";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";

import { datedTasks } from "./attention-board-model";

interface PointedCopies {
  /** The Threads with a copy under the pointer or holding keyboard focus. */
  pointed: ReadonlySet<ThreadId>;
  /** Marks one copy as pointed at; the returned function unmarks it. */
  point: (copy: string, threadId: ThreadId) => () => void;
}

const PointedCopiesContext = createContext<PointedCopies>({
  pointed: new Set(),
  point: () => () => {},
});

/**
 * Holds which copies are pointed at, so every copy of their Threads across
 * the board can ring. A copy unmarks itself when it is no longer hovered or
 * focused, and when it leaves the board, so nothing stays ringed at rest.
 */
export function ThreadCopies({ children }: { children: ReactNode }) {
  const [copies, setCopies] = useState<ReadonlyMap<string, ThreadId>>(
    new Map(),
  );
  const point = useCallback((copy: string, threadId: ThreadId) => {
    setCopies((current) => new Map(current).set(copy, threadId));
    return () =>
      setCopies((current) => {
        const next = new Map(current);
        next.delete(copy);
        return next;
      });
  }, []);
  const value = useMemo<PointedCopies>(
    () => ({ pointed: new Set(copies.values()), point }),
    [copies, point],
  );
  return <PointedCopiesContext value={value}>{children}</PointedCopiesContext>;
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
  const { pointed, point } = use(PointedCopiesContext);
  const copy = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const engaged = hovered || focused;
  useEffect(
    () => (engaged ? point(copy, thread._id) : undefined),
    [engaged, point, copy, thread._id],
  );
  const ringed = pointed.has(thread._id) && datedTasks(thread).length > 1;
  return (
    <div
      data-slot="thread-copy"
      data-ringed={ringed || undefined}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event: FocusEvent<HTMLDivElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
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
