import type { Doc, Id } from "@convex/_generated/dataModel";

import { Button } from "@vita-os/ui/components/button";
import { Checkbox } from "@vita-os/ui/components/checkbox";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
} from "@vita-os/ui/components/item";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { cn } from "@vita-os/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Check, FileText, Target } from "lucide-react";
import { useState } from "react";

import type { ProcessTaskAction } from "@/features/tasks/use-process-task";

import { AreaIcon } from "@/features/areas/components/area-icon";

import {
  type ThreadChoice,
  ThreadSearchAutocomplete,
} from "./thread-search-autocomplete";

type ProcessingMode = "add_activity_log_entry" | "set_next_move";

interface ProcessTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Doc<"tasks">;
  areas: Doc<"areas">[];
  threads: Doc<"threads">[];
  isLoading?: boolean;
  onProcess: (
    taskId: Id<"tasks">,
    action: ProcessTaskAction,
  ) => void | Promise<void>;
}

function getProcessSuccessMessage(
  action: ProcessTaskAction,
  threads: Doc<"threads">[],
): string {
  if (action.type === "create_thread") {
    return `Created thread · ${action.title}`;
  }

  const thread = threads.find((candidate) => candidate._id === action.threadId);
  const threadTitle = thread?.title ?? "thread";

  if (action.type === "set_next_move") {
    return `Set Next Move · ${threadTitle}`;
  }

  return `Added Activity Log entry · ${threadTitle}`;
}

export function ProcessTaskDialog({
  open,
  onOpenChange,
  task,
  areas,
  threads,
  isLoading = false,
  onProcess,
}: ProcessTaskDialogProps) {
  const feedback = useFeedback();
  const [choice, setChoice] = useState<ThreadChoice | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<ProcessingMode>("add_activity_log_entry");
  const [creationDraft, setCreationDraft] = useState<{
    title: string;
  } | null>(null);
  const [createAreaId, setCreateAreaId] = useState<string | undefined>();

  const { run: submitProcess, isPending } = useGuardedAsyncAction(
    async (action: ProcessTaskAction) => {
      await onProcess(task._id, action);
    },
    { errorToast: true },
  );

  const isCreating = creationDraft !== null;
  const createTitle = creationDraft?.title ?? "";
  const selectedThread = choice?.kind === "thread" ? choice.thread : null;

  const canSubmit =
    !!selectedThread ||
    (isCreating && createTitle.trim().length > 0 && !!createAreaId);

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const resetCreationFields = () => {
    setCreateAreaId(undefined);
  };

  const handleChoiceChange = (next: ThreadChoice | null) => {
    setChoice(next);
    if (next?.kind === "thread") {
      setInputValue(next.thread.title);
      setCreationDraft(null);
      resetCreationFields();
    } else if (next?.kind === "create") {
      setInputValue(next.title);
      setCreationDraft({ title: next.title });
      resetCreationFields();
    } else {
      setChoice(null);
    }
  };

  const handleInputValueChange = (
    next: string,
    details: { reason: string },
  ) => {
    if (isCreating) {
      if (
        details.reason !== "input-change" &&
        details.reason !== "input-clear"
      ) {
        return;
      }
      setInputValue(next);
      setCreationDraft((current) =>
        current ? { title: next.trim() } : current,
      );
      setChoice(
        next.trim().length > 0 ? { kind: "create", title: next.trim() } : null,
      );
      return;
    }

    setInputValue(next);
    if (details.reason === "input-clear") {
      setChoice(null);
      resetCreationFields();
      return;
    }
    if (details.reason !== "input-change") return;
    if (!choice) return;

    const stillMatches =
      choice.kind === "thread" && choice.thread.title === next;
    if (!stillMatches) {
      setChoice(null);
      resetCreationFields();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || isPending) return;

    let action: ProcessTaskAction | undefined;
    if (isCreating) {
      action = {
        type: "create_thread",
        title: createTitle.trim(),
        areaId: createAreaId as Id<"areas">,
      };
    } else if (selectedThread) {
      action = {
        type: mode,
        threadId: selectedThread._id,
      };
    }

    if (!action) return;

    const result = await submitProcess(action);
    if (result.ok) {
      feedback.success(getProcessSuccessMessage(action, threads));
      onOpenChange(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent
        className="sm:max-w-lg"
        showCloseButton={!isPending}
      >
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Process task</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <InboxTaskPreview task={task} />
        <p className="-mt-3 text-sm text-muted-foreground">
          Move this Inbox task into a Thread as an Activity Log entry or Next
          Move.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ThreadSearchAutocomplete
            areas={areas}
            threads={threads}
            isLoading={isLoading}
            value={choice}
            onValueChange={handleChoiceChange}
            inputValue={inputValue}
            onInputValueChange={handleInputValueChange}
          />

          {isCreating && (
            <div className="space-y-4 border-t border-border/50 pt-4">
              <AreaChoice
                areas={areas}
                selectedAreaId={createAreaId}
                onSelect={setCreateAreaId}
              />
            </div>
          )}

          {selectedThread && (
            <div className="grid gap-2 sm:grid-cols-2">
              <ProcessingModeCard
                mode="add_activity_log_entry"
                selectedMode={mode}
                onSelect={setMode}
                title="Activity Log entry"
                description="Logged in the thread activity log."
                icon={<FileText className="h-4 w-4" />}
              />
              <ProcessingModeCard
                mode="set_next_move"
                selectedMode={mode}
                onSelect={setMode}
                title="Next Move"
                description="Becomes what to do next."
                icon={<Target className="h-4 w-4" />}
              />
            </div>
          )}

          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || isPending}
              aria-busy={isPending}
            >
              Process
              <ArrowRight className="h-4 w-4" />
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function InboxTaskPreview({ task }: { task: Doc<"tasks"> }) {
  const timestamp = formatDistanceToNow(new Date(task.createdAt), {
    addSuffix: true,
  });

  return (
    <Item
      size="sm"
      className="flex-nowrap items-start gap-3 rounded-none border-0"
    >
      <ItemMedia>
        <Checkbox
          checked={false}
          disabled
          aria-hidden="true"
          tabIndex={-1}
          className="cursor-default opacity-70"
        />
      </ItemMedia>
      <ItemContent className="min-w-0 gap-1.5">
        <p className="line-clamp-3 min-w-0 whitespace-pre-wrap text-sm leading-relaxed">
          {task.text}
        </p>
        <ItemDescription className="text-[11px] text-muted-foreground/60">
          {timestamp}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

function AreaChoice({
  areas,
  selectedAreaId,
  onSelect,
}: {
  areas: Doc<"areas">[];
  selectedAreaId: string | undefined;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
        Area
      </span>
      <div className="flex flex-wrap gap-1.5">
        {areas.map((area) => {
          const isSelected = selectedAreaId === area._id;
          return (
            <Button
              key={area._id}
              type="button"
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onSelect(area._id)}
              className={cn(
                "h-7 gap-1.5 rounded-full px-3 text-xs font-medium",
                !isSelected && "bg-transparent",
              )}
            >
              <AreaIcon icon={area.icon} className="size-3.5 shrink-0" />
              {area.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function ProcessingModeCard({
  mode,
  selectedMode,
  onSelect,
  title,
  description,
  icon,
}: {
  mode: ProcessingMode;
  selectedMode: ProcessingMode;
  onSelect: (mode: ProcessingMode) => void;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  const id = `process-${mode}`;
  const isSelected = mode === selectedMode;

  return (
    <label
      htmlFor={id}
      className={cn(
        "group relative flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/50 px-3 py-2.5 transition-all",
        "bg-transparent hover:border-border hover:bg-muted/50",
        isSelected &&
          "border-primary/40 bg-primary/5 ring-1 ring-primary/20 hover:bg-primary/5",
      )}
    >
      <input
        id={id}
        type="radio"
        name="processing-mode"
        value={mode}
        checked={isSelected}
        onChange={() => onSelect(mode)}
        className="sr-only"
      />

      <div
        aria-hidden="true"
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
          isSelected
            ? "bg-primary/15 text-primary"
            : "bg-surface-3 text-muted-foreground group-hover:text-foreground",
        )}
      >
        {icon}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-5">
        <span className="truncate text-sm font-medium leading-tight">
          {title}
        </span>
        <span className="truncate text-xs leading-snug text-muted-foreground">
          {description}
        </span>
      </div>

      {isSelected && (
        <div
          aria-hidden="true"
          className="absolute top-2.5 right-2.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
        >
          <Check className="h-2.5 w-2.5" />
        </div>
      )}
    </label>
  );
}
