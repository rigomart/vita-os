import { conditionColors, conditionLabels } from "@convex/lib/condition";
import { Button } from "@vita-os/ui/components/button";
import { Calendar } from "@vita-os/ui/components/calendar";
import { Kbd } from "@vita-os/ui/components/kbd";
import { Textarea } from "@vita-os/ui/components/textarea";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  History,
  Inbox,
  MousePointerClick,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AreaIcon } from "@/features/areas/components/area-icon";

import type { MockArea } from "../mock-data";
import type { PlanItem, QuickTarget } from "./model";
import type { PlanAction } from "./plan-state";

import {
  agoLabel,
  areaOf,
  dateSentence,
  dateToneClass,
  dayDelta,
  quickDate,
  quickTargets,
} from "./model";

/**
 * The persistent editing rail.
 *
 * It opens on selection and *stays* open through every action — chained edits
 * are the whole point. Nothing here closes the rail except the close button
 * and Escape.
 */
export function PlanRail({
  areaById,
  areas,
  className,
  dispatch,
  focusSignal,
  item,
  now,
  onClose,
}: {
  areaById: ReadonlyMap<string, MockArea>;
  areas: MockArea[];
  className?: string;
  dispatch: (action: PlanAction) => void;
  /** Bumped by the parent to pull focus into the Next Move editor. */
  focusSignal: number;
  item?: PlanItem;
  now: number;
  onClose: () => void;
}) {
  return (
    <aside
      aria-label="Editor"
      className={cn(
        "flex w-[352px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-surface-2",
        className,
      )}
    >
      {item ? (
        <RailBody
          key={item.id}
          area={areaOf(item, areaById)}
          areas={areas}
          dispatch={dispatch}
          focusSignal={focusSignal}
          item={item}
          now={now}
          onClose={onClose}
        />
      ) : (
        <RailEmpty />
      )}
    </aside>
  );
}

function RailEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-surface-3 text-muted-foreground">
        <MousePointerClick className="size-5" />
      </span>
      <p className="font-heading text-sm font-semibold">Pick something up</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Select any chip to retarget its Follow-up, rewrite the Next Move, move
        it to another Area, or resolve it — without leaving the grid.
      </p>
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
        <Kbd className="text-[10px]">Tab</Kbd>
        <span>then</span>
        <Kbd className="text-[10px]">↵</Kbd>
        <span>from the keyboard</span>
      </p>
    </div>
  );
}

function RailBody({
  area,
  areas,
  dispatch,
  focusSignal,
  item,
  now,
  onClose,
}: {
  area?: MockArea;
  areas: MockArea[];
  dispatch: (action: PlanAction) => void;
  focusSignal: number;
  item: PlanItem;
  now: number;
  onClose: () => void;
}) {
  const isTask = item.kind === "task";

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b border-border/60 px-4 py-2.5">
        {isTask ? (
          <>
            <span className="flex size-7 items-center justify-center rounded-lg border border-dashed border-border bg-surface-3 text-muted-foreground">
              <Inbox className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
              Inbox task · no Area
            </span>
          </>
        ) : (
          <>
            <span className="flex size-7 items-center justify-center rounded-lg bg-surface-3 text-brand-accent-foreground">
              <AreaIcon icon={area?.icon} className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium">
              {area?.name}
            </span>
            {area && (
              <span
                title={conditionLabels[area.condition]}
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  conditionColors[area.condition],
                )}
              />
            )}
          </>
        )}
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="Close editor"
          onClick={onClose}
          className="-mr-1 text-muted-foreground"
        >
          <X />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-1.5">
          <h3 className="font-heading text-base leading-snug font-semibold tracking-tight">
            {item.title}
          </h3>
          {item.summary && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {item.summary}
            </p>
          )}
          {isTask && item.createdAt != null && (
            <p className="text-[11px] text-muted-foreground/60">
              Captured {agoLabel(item.createdAt, now)}
            </p>
          )}
        </div>

        <DateSection dispatch={dispatch} item={item} now={now} />

        {!isTask && (
          <NextMoveSection
            dispatch={dispatch}
            focusSignal={focusSignal}
            item={item}
          />
        )}

        {!isTask && (
          <AreaSection
            areas={areas}
            currentId={item.areaId}
            dispatch={dispatch}
            itemId={item.id}
          />
        )}

        {item.lastActivity && (
          <section className="flex flex-col gap-1.5">
            <SectionLabel>Last activity</SectionLabel>
            <div className="flex gap-2 rounded-lg bg-surface-3/60 px-3 py-2.5">
              <History className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {item.lastActivity.content}
                <span className="block pt-1 text-[11px] text-muted-foreground/60">
                  {agoLabel(item.lastActivity.createdAt, now)}
                </span>
              </p>
            </div>
          </section>
        )}
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <Kbd className="text-[10px]">R</Kbd>
          <span>{isTask ? "mark done" : "resolve"}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => dispatch({ itemId: item.id, type: "resolve" })}
        >
          <CircleCheck data-icon="inline-start" />
          {isTask ? "Mark done" : "Resolve thread"}
        </Button>
      </footer>
    </>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
      {children}
    </span>
  );
}

/* ------------------------------------------------------- follow-up / when -- */

function DateSection({
  dispatch,
  item,
  now,
}: {
  dispatch: (action: PlanAction) => void;
  item: PlanItem;
  now: number;
}) {
  const [showCalendar, setShowCalendar] = useState(false);
  const status = dateSentence(item, now);
  const selected = item.date == null ? undefined : new Date(item.date);

  const isActive = (target: QuickTarget) =>
    item.date != null &&
    dayDelta(quickDate(target, now), now) === dayDelta(item.date, now);

  const set = (date: number | undefined) =>
    dispatch({ date, itemId: item.id, type: "set-date" });

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>
          {item.kind === "task" ? "When" : "Follow-up"}
        </SectionLabel>
        {item.date != null && (
          <Button
            variant="ghost"
            size="xs"
            className="-mr-2 text-muted-foreground"
            onClick={() => set(undefined)}
          >
            Clear
          </Button>
        )}
      </div>

      <p className={cn("text-xs font-medium", dateToneClass[status.tone])}>
        {status.text}
      </p>
      {status.tone === "attention" && (
        <p className="-mt-1 text-[11px] text-muted-foreground/70">
          Not late — just waiting for you to re-engage.
        </p>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {quickTargets.map((target) => (
          <Button
            key={target.key}
            variant={isActive(target.key) ? "secondary" : "outline"}
            size="sm"
            className="justify-between px-2.5 text-xs"
            onClick={() => set(quickDate(target.key, now))}
          >
            {target.label}
            <Kbd className="bg-transparent text-[10px] text-muted-foreground/70">
              {target.hint}
            </Kbd>
          </Button>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        aria-expanded={showCalendar}
        className="justify-start gap-1.5 px-2.5 text-xs text-muted-foreground"
        onClick={() => setShowCalendar((value) => !value)}
      >
        <CalendarDays data-icon="inline-start" />
        {selected ? format(selected, "EEEE, MMMM d") : "Pick an exact date"}
        <ChevronDown
          className={cn(
            "ml-auto transition-transform",
            showCalendar && "rotate-180",
          )}
        />
      </Button>

      {showCalendar && (
        <div className="rounded-xl border border-border/60 bg-surface-1">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) return;
              const next = new Date(date);
              next.setHours(9, 0, 0, 0);
              set(next.getTime());
              setShowCalendar(false);
            }}
          />
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- next move -- */

function NextMoveSection({
  dispatch,
  focusSignal,
  item,
}: {
  dispatch: (action: PlanAction) => void;
  focusSignal: number;
  item: PlanItem;
}) {
  const [draft, setDraft] = useState(item.nextMove ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  const mountedAt = useRef(focusSignal);

  useEffect(() => {
    if (focusSignal === mountedAt.current) return;
    const node = ref.current;
    if (!node) return;
    node.focus();
    // Caret at the end: never select-all, so an existing move is edited, not
    // wiped by the first keystroke.
    node.setSelectionRange(node.value.length, node.value.length);
  }, [focusSignal]);

  const commit = () => {
    const value = draft.trim();
    if (value === (item.nextMove ?? "")) return;
    dispatch({ itemId: item.id, text: value, type: "set-next-move" });
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <SectionLabel>Next Move</SectionLabel>
        {item.nextMove && (
          <Button
            variant="ghost"
            size="xs"
            className="-mr-2 text-muted-foreground"
            onClick={() => {
              setDraft("");
              dispatch({ itemId: item.id, type: "complete-next-move" });
            }}
          >
            <Check data-icon="inline-start" />
            Mark done
          </Button>
        )}
      </div>
      <Textarea
        ref={ref}
        rows={2}
        value={draft}
        placeholder="The single next thing you'd do…"
        aria-label="Next Move"
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => {
          const node = event.currentTarget;
          node.setSelectionRange(node.value.length, node.value.length);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setDraft(item.nextMove ?? "");
            event.currentTarget.blur();
          }
        }}
        className="min-h-0 rounded-xl bg-input/60 px-3 py-2 text-xs leading-relaxed md:text-xs"
      />
      <p className="text-[11px] text-muted-foreground/60">
        One move only — <Kbd className="text-[10px]">↵</Kbd> saves,{" "}
        <Kbd className="text-[10px]">Esc</Kbd> reverts.
      </p>
    </section>
  );
}

/* ----------------------------------------------------------- move to area -- */

function AreaSection({
  areas,
  currentId,
  dispatch,
  itemId,
}: {
  areas: MockArea[];
  currentId?: string;
  dispatch: (action: PlanAction) => void;
  itemId: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>Move to Area</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {areas.map((area) => {
          const current = area.id === currentId;
          return (
            <Button
              key={area.id}
              variant={current ? "secondary" : "ghost"}
              size="icon-sm"
              disabled={current}
              aria-label={
                current ? `${area.name} (current)` : `Move to ${area.name}`
              }
              title={
                current ? `${area.name} — current Area` : `Move to ${area.name}`
              }
              className={cn(
                "rounded-lg",
                current
                  ? "opacity-100 ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() =>
                dispatch({ itemId, toAreaId: area.id, type: "move-area" })
              }
            >
              <AreaIcon icon={area.icon} className="size-4" />
            </Button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground/60">
        Moving logs an activity entry on the Thread.
      </p>
    </section>
  );
}
