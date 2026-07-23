import type { Doc } from "@convex/_generated/dataModel";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@vita-os/ui/components/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@vita-os/ui/components/empty";
import { Field, FieldGroup, FieldLabel } from "@vita-os/ui/components/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@vita-os/ui/components/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@vita-os/ui/components/item";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { format, isToday, isYesterday } from "date-fns";
import {
  ArrowRight,
  ArrowUp,
  Bell,
  CircleCheck,
  Clock3,
  Link2,
  MapPin,
  MessageSquareText,
  PenLine,
  RefreshCw,
  Scale,
} from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

import { getActivityLogEntryLabel } from "@/features/threads/activity-log-entry";

interface ActivityLogProps {
  logs: Doc<"activityLogs">[] | undefined;
  onAddNote: (text: string) => Promise<void> | void;
}

type ActivityLogEntry = Doc<"activityLogs">;
type AutomaticActivityLogEntry = ActivityLogEntry & {
  type: Exclude<ActivityLogEntry["type"], "note">;
};

const ACTIVITY_LOG_ICONS: Record<
  AutomaticActivityLogEntry["type"],
  LucideIcon
> = {
  status_change: RefreshCw,
  next_action_change: ArrowRight,
  state_change: CircleCheck,
  decision: Scale,
  reference: Link2,
  waiting_change: Clock3,
  follow_up_change: Bell,
  area_move: MapPin,
};

export function ActivityLog({ logs, onAddNote }: ActivityLogProps) {
  const [noteText, setNoteText] = useState("");
  const { run: addNote, isPending } = useGuardedAsyncAction(onAddNote, {
    errorToast: true,
  });

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text || isPending) return;

    const result = await addNote(text);
    if (result.ok) setNoteText("");
  };

  const handleAddNote = (event: FormEvent) => {
    event.preventDefault();
    void submitNote();
  };

  const handleNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submitNote();
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        <h2 className="text-xs font-medium text-muted-foreground">
          Activity log
        </h2>
        {logs && logs.length > 0 && (
          <Badge variant="ghost" className="px-1.5 text-muted-foreground">
            {logs.length}
          </Badge>
        )}
      </div>

      <form onSubmit={handleAddNote}>
        <FieldGroup className="gap-0">
          <Field data-disabled={isPending || undefined}>
            <FieldLabel htmlFor="activity-log-note" className="sr-only">
              Activity log note
            </FieldLabel>
            <InputGroup>
              <InputGroupTextarea
                id="activity-log-note"
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                disabled={isPending}
                aria-label="Activity log note"
                placeholder="Add a note about what happened…"
                className="min-h-12 pr-12"
                rows={1}
                onKeyDown={handleNoteKeyDown}
              />
              <InputGroupAddon
                align="block-end"
                className="absolute right-2 bottom-2 w-auto p-0"
              >
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="secondary"
                  disabled={!noteText.trim() || isPending}
                  aria-label="Add note"
                  aria-busy={isPending}
                >
                  <ArrowUp data-icon="inline-start" />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </Field>
        </FieldGroup>
      </form>

      <ActivityLogTimeline logs={logs} />
    </section>
  );
}

function ActivityLogTimeline({
  logs,
}: {
  logs: ActivityLogEntry[] | undefined;
}) {
  if (logs === undefined) return <ActivityLogSkeleton />;

  if (logs.length === 0) {
    return (
      <Empty className="min-h-44 p-6">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MessageSquareText />
          </EmptyMedia>
          <EmptyTitle>No activity yet</EmptyTitle>
          <EmptyDescription>
            Add a note to start the continuity record for this Thread.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {groupLogsByDay(logs).map((group) => {
        const headingId = `activity-log-day-${group.key}`;

        return (
          <section
            key={group.key}
            aria-labelledby={headingId}
            className="flex flex-col gap-2.5"
          >
            <h3
              id={headingId}
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              {group.label}
            </h3>
            <ItemGroup className="gap-2">
              {group.logs.map((log) =>
                isAutomaticActivityLogEntry(log) ? (
                  <AutomaticChange key={log._id} log={log} />
                ) : (
                  <ManualNote key={log._id} log={log} />
                ),
              )}
            </ItemGroup>
          </section>
        );
      })}
    </div>
  );
}

function ManualNote({ log }: { log: ActivityLogEntry }) {
  return (
    <Item size="sm">
      <ItemMedia variant="icon">
        <PenLine className="text-primary" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Note</ItemTitle>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {log.content}
        </p>
      </ItemContent>
      <ItemActions className="self-start">
        <ActivityLogTimestamp createdAt={log.createdAt} />
      </ItemActions>
    </Item>
  );
}

function AutomaticChange({ log }: { log: AutomaticActivityLogEntry }) {
  const Icon = ACTIVITY_LOG_ICONS[log.type];

  return (
    <Item size="xs">
      <ItemMedia variant="icon">
        <Icon className="text-muted-foreground" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{getActivityLogEntryLabel(log.type)}</ItemTitle>
        <ItemDescription>{getAutomaticChangeSummary(log)}</ItemDescription>
      </ItemContent>
      <ItemActions className="self-start">
        <ActivityLogTimestamp createdAt={log.createdAt} />
      </ItemActions>
    </Item>
  );
}

function ActivityLogTimestamp({ createdAt }: { createdAt: number }) {
  const date = new Date(createdAt);

  return (
    <time
      dateTime={date.toISOString()}
      title={format(date, "PPpp")}
      className="shrink-0 text-xs text-muted-foreground"
    >
      {format(date, "h:mm a")}
    </time>
  );
}

function ActivityLogSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-label="Loading activity log">
      {Array.from({ length: 2 }).map((_, groupIndex) => (
        <div key={groupIndex} className="flex flex-col gap-3">
          <Skeleton className="h-3 w-16" />
          {Array.from({ length: groupIndex + 1 }).map((__, itemIndex) => (
            <div key={itemIndex} className="flex items-start gap-3 py-2">
              <Skeleton className="size-8 shrink-0 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="h-3 w-14" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function groupLogsByDay(logs: ActivityLogEntry[]) {
  const groups = new Map<string, ActivityLogEntry[]>();

  for (const log of [...logs].sort((a, b) => b.createdAt - a.createdAt)) {
    const key = format(new Date(log.createdAt), "yyyy-MM-dd");
    const group = groups.get(key) ?? [];
    group.push(log);
    groups.set(key, group);
  }

  return [...groups.entries()].map(([key, groupLogs]) => ({
    key,
    label: getDayLabel(groupLogs[0]!.createdAt),
    logs: groupLogs,
  }));
}

function getDayLabel(createdAt: number) {
  const date = new Date(createdAt);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function getAutomaticChangeSummary(log: AutomaticActivityLogEntry) {
  if (log.previousValue && log.newValue) {
    return `${log.previousValue} → ${log.newValue}`;
  }

  if (log.newValue) return `Set to ${log.newValue}`;

  if (log.previousValue) {
    return log.type === "next_action_change" &&
      log.content.startsWith("Completed")
      ? `Completed ${log.previousValue}`
      : `Cleared ${log.previousValue}`;
  }

  return log.content;
}

function isAutomaticActivityLogEntry(
  log: ActivityLogEntry,
): log is AutomaticActivityLogEntry {
  return log.type !== "note";
}
