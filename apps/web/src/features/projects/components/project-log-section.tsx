import type { Doc } from "@convex/_generated/dataModel";
import { Button } from "@vita-os/ui/components/button";
import { Skeleton } from "@vita-os/ui/components/skeleton";
import { Textarea } from "@vita-os/ui/components/textarea";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Pen } from "lucide-react";
import { type FormEvent, type KeyboardEvent, useState } from "react";

interface ProjectLogSectionProps {
  logs: Doc<"projectLogs">[] | undefined;
  onCreateNote: (content: string) => void | Promise<void>;
}

export function ProjectLogSection({
  logs,
  onCreateNote,
}: ProjectLogSectionProps) {
  const [noteText, setNoteText] = useState("");

  const submitNote = async () => {
    const text = noteText.trim();
    if (!text) return;

    setNoteText("");
    await onCreateNote(text);
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
    <section>
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-3">
          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <h2 className="text-sm font-medium">Activity</h2>
        {logs && logs.length > 0 && (
          <span className="text-xs text-muted-foreground">{logs.length}</span>
        )}
      </div>

      <form onSubmit={handleAddNote} className="mb-5 flex gap-2">
        <Textarea
          value={noteText}
          onChange={(event) => setNoteText(event.target.value)}
          placeholder="Add a note..."
          className="min-h-9 bg-surface-2"
          rows={1}
          onKeyDown={handleNoteKeyDown}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!noteText.trim()}
          className="shrink-0"
        >
          Add
        </Button>
      </form>

      <ProjectLogTimeline logs={logs} />
    </section>
  );
}

function ProjectLogTimeline({
  logs,
}: {
  logs: Doc<"projectLogs">[] | undefined;
}) {
  if (logs === undefined) {
    return (
      <div className="relative before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-px before:bg-border/50">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items have no stable id
            key={i}
            className="relative py-2 pl-8"
          >
            <div className="absolute left-[7px] top-[13px] h-3 w-3 rounded-full bg-surface-3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-muted-foreground">
        No activity yet
      </p>
    );
  }

  return (
    <div className="relative before:absolute before:left-[11px] before:top-0 before:bottom-0 before:w-px before:bg-border/50">
      {logs.map((log) =>
        log.type === "note" ? (
          <div key={log._id} className="relative py-2 pl-8">
            <div className="absolute left-0 top-[17px] flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
              <Pen className="h-3 w-3 text-primary" />
            </div>
            <div className="rounded-lg border border-border-subtle bg-surface-2 px-4 py-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {log.content}
              </p>
              <ProjectLogTimestamp createdAt={log.createdAt} />
            </div>
          </div>
        ) : (
          <div key={log._id} className="relative py-1.5 pl-8">
            <div className="absolute left-[7px] top-[13px] h-3 w-3 rounded-full border-2 border-border/60 bg-surface-1" />
            <p className="text-xs text-muted-foreground italic">
              {log.content}
            </p>
            <ProjectLogTimestamp createdAt={log.createdAt} compact />
          </div>
        ),
      )}
    </div>
  );
}

function ProjectLogTimestamp({
  createdAt,
  compact,
}: {
  createdAt: number;
  compact?: boolean;
}) {
  return (
    <p
      className={
        compact
          ? "mt-0.5 text-xs text-muted-foreground/50"
          : "mt-1.5 text-xs text-muted-foreground/70"
      }
    >
      {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
    </p>
  );
}
