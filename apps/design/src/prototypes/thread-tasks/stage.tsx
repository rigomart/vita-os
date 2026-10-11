import type { Thread } from "@vita-os/contracts";
import type { ComponentType } from "react";

import { ThreadAreaChip } from "@vita-os/application/internal/threads/components/thread-area-chip.tsx";
import { ThreadBodyTabs } from "@vita-os/application/internal/threads/components/thread-body-tabs.tsx";
import { ThreadDefinitionSection } from "@vita-os/application/internal/threads/components/thread-definition-section.tsx";
import { ThreadHeaderSection } from "@vita-os/application/internal/threads/components/thread-header-section.tsx";
import {
  useOpenThreads,
  useThreadDetail,
} from "@vita-os/application/internal/threads/hooks.ts";
import { ThreadPaneNavContext } from "@vita-os/application/internal/threads/thread-detail/thread-pane-nav.ts";
import { cn } from "@vita-os/ui/lib/utils";
import { useState } from "react";

/** The widths a Thread is read at: the pane at its narrowest and widest, and a phone's drawer. */
const FRAMES = {
  narrow: { label: "Pane · 28rem", className: "w-[28rem] px-6" },
  wide: { label: "Pane · 34rem", className: "w-[34rem] px-6" },
  phone: { label: "Phone · 390px", className: "w-[390px] px-5" },
} as const;
type Frame = keyof typeof FRAMES;

const NAV = { onThreadLocationChange: () => {} };

/**
 * A Thread as its pane draws it, header and body tabs included, with the
 * Tasks drawn by the direction on show. It opens on the Thread with the most
 * Tasks; the picker reaches the others.
 */
export function TaskStage({
  list: List,
}: {
  list: ComponentType<{ thread: Thread }>;
}) {
  const threads = useOpenThreads().data ?? [];
  const [chosen, setChosen] = useState<string | null>(null);
  const [frame, setFrame] = useState<Frame>("narrow");
  const fullest = [...threads].sort(
    (a, b) => (b.tasks?.length ?? 0) - (a.tasks?.length ?? 0),
  )[0];
  const slug = chosen ?? fullest?.slug;

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-background px-6 py-6 text-sm">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <select
          aria-label="Thread"
          value={slug ?? ""}
          onChange={(event) => setChosen(event.target.value)}
          className="h-8 rounded-full border border-border bg-secondary px-3 text-sm"
        >
          {threads.map((thread) => (
            <option key={thread._id} value={thread.slug}>
              {thread.title} · {thread.tasks?.length ?? 0}
            </option>
          ))}
        </select>
        <div
          role="radiogroup"
          aria-label="Width"
          className="flex rounded-full bg-secondary p-0.5"
        >
          {(Object.keys(FRAMES) as Frame[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={frame === key}
              onClick={() => setFrame(key)}
              className={cn(
                "h-7 rounded-full px-3 text-xs text-muted-foreground",
                frame === key && "bg-background text-foreground shadow-sm",
              )}
            >
              {FRAMES[key].label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={cn(
          "flex min-h-[44rem] flex-col rounded-3xl border bg-popover py-8 text-popover-foreground shadow-xl",
          FRAMES[frame].className,
        )}
      >
        {slug === undefined ? (
          <p className="text-muted-foreground">No open Threads here.</p>
        ) : (
          <ThreadPaneNavContext.Provider value={NAV}>
            <StagedThread slug={slug} list={List} />
          </ThreadPaneNavContext.Provider>
        )}
      </div>
      {frame === "phone" && (
        <p className="max-w-md text-center text-xs text-muted-foreground">
          This is the phone's width, not its touch behaviour: below 1280px the
          app shows every control without hover. Narrow the window to see that.
        </p>
      )}
    </div>
  );
}

function StagedThread({
  slug,
  list: List,
}: {
  slug: string;
  list: ComponentType<{ thread: Thread }>;
}) {
  const thread = useThreadDetail(slug).data?.thread;
  if (thread === undefined) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <header className="flex shrink-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <ThreadAreaChip thread={thread} />
        </div>
        <div className="flex flex-col gap-0.5">
          <ThreadHeaderSection thread={thread} />
          <ThreadDefinitionSection thread={thread} />
        </div>
      </header>
      <List thread={thread} />
      <ThreadBodyTabs
        threadTitle={thread.title}
        threadId={thread._id}
        {...(thread.lastActivityAt === undefined
          ? {}
          : { lastActivityAt: thread.lastActivityAt })}
      />
    </div>
  );
}
