import type { AreaSummary, Thread } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";
import { conditionLabels } from "@vita-os/core";
import { cn } from "@vita-os/ui/lib/utils";
import { CalendarClock, Check } from "lucide-react";

import type { ProductSearch } from "../../navigation/search-params";

import { AreaIcon } from "../../areas/components/area-icon";
import { conditionTextClassName } from "../../areas/condition-presentation";
import { WhenPopover } from "../../attention-list";
import {
  dateToken,
  dateToneClassName,
  dayDelta,
} from "../../dashboard/components/dashboard-model";
import { useCompleteNextMove } from "../use-complete-next-move";
import { useUpdateThread } from "../use-update-thread";

const revealed =
  "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100";

export function ThreadAttentionCard({
  actions,
  area,
  currentDate,
  onCompleteNextMove,
  onSetFollowUp,
  thread,
}: {
  actions?: ReactNode;
  area?: AreaSummary;
  currentDate: number;
  onCompleteNextMove: () => void;
  onSetFollowUp: (when: number | undefined) => void;
  thread: Thread;
}) {
  const move = thread.nextMove?.trim();
  const followUp = thread.followUp ?? undefined;
  const late = followUp !== undefined && dayDelta(followUp, currentDate) < 0;

  return (
    <div
      className={cn(
        "group relative rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
        late && "bg-condition-attention/[0.06]",
      )}
    >
      <Link
        to="."
        search={(previous: ProductSearch): ProductSearch => ({
          ...previous,
          thread: thread.slug,
        })}
        className={cn(
          "block min-w-0 text-sm leading-snug outline-none after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring/40",
          move ? "line-clamp-2 font-medium" : "text-muted-foreground/40",
        )}
      >
        {move ?? (
          <>
            <span aria-hidden>—</span>
            <span className="sr-only">No Next Move</span>
          </>
        )}
      </Link>

      <div className="mt-1 flex items-center gap-1.5 text-[12px] leading-snug text-muted-foreground/75">
        <AreaGlyph area={area} />
        <span className="truncate">{thread.title}</span>

        <span className="ml-auto flex shrink-0 items-center gap-1 pl-1">
          <WhenPopover
            when={followUp}
            onSetWhen={onSetFollowUp}
            trigger={
              followUp === undefined ? (
                <ControlButton className={revealed} label="Set Follow-up">
                  <CalendarClock className="size-3.5" />
                </ControlButton>
              ) : (
                <button
                  type="button"
                  aria-label="Change Follow-up"
                  className={cn(
                    "relative z-10 -my-0.5 inline-flex items-center gap-1 rounded-full px-1 py-0.5 tabular-nums transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40",
                    dateToneClassName(followUp, currentDate),
                  )}
                >
                  <CalendarClock aria-hidden className="size-3" />
                  {dateToken(followUp, currentDate)}
                </button>
              )
            }
          />

          {move && (
            <ControlButton
              label="Complete Next Move"
              onClick={onCompleteNextMove}
              className={cn(
                revealed,
                "bg-muted hover:bg-condition-healthy/15 hover:text-condition-healthy",
              )}
            >
              <Check className="size-3.5" />
            </ControlButton>
          )}

          {actions && (
            <span className={cn("relative z-10 flex", revealed)}>
              {actions}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

export function ConnectedThreadAttentionCard({
  area,
  currentDate,
  thread,
}: {
  area?: AreaSummary;
  currentDate: number;
  thread: Thread;
}) {
  const completeNextMove = useCompleteNextMove(thread);
  const updateThread = useUpdateThread(thread);

  return (
    <ThreadAttentionCard
      area={area}
      currentDate={currentDate}
      thread={thread}
      onCompleteNextMove={() => void completeNextMove()}
      onSetFollowUp={(when) => void updateThread({ followUp: when ?? null })}
    />
  );
}

function ControlButton({
  children,
  className,
  label,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "relative z-10 -my-1 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-[color,background-color,transform,opacity] hover:bg-muted hover:text-foreground active:scale-90 focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      {children}
    </button>
  );
}

function AreaGlyph({ area }: { area?: AreaSummary }) {
  if (!area) return null;
  return (
    <span
      title={`${area.name} — ${conditionLabels[area.condition]}`}
      className={cn(
        "inline-flex shrink-0",
        conditionTextClassName[area.condition],
      )}
    >
      <AreaIcon icon={area.icon} className="size-3.5" />
    </span>
  );
}
