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
import { cn } from "@vita-os/ui/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Check, FileText, Target } from "lucide-react";
import { useState } from "react";
import type { ProcessItemAction } from "@/features/items/use-process-item";
import {
  type ProjectChoice,
  ProjectSearchAutocomplete,
} from "./project-search-autocomplete";

type ProcessingMode = "add_activity_log_entry" | "set_next_move";

interface ProcessItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Doc<"items">;
  areas: Doc<"areas">[];
  projects: Doc<"projects">[];
  isLoading?: boolean;
  onProcess: (
    itemId: Id<"items">,
    action: ProcessItemAction,
  ) => void | Promise<void>;
}

export function ProcessItemDialog({
  open,
  onOpenChange,
  item,
  areas,
  projects,
  isLoading = false,
  onProcess,
}: ProcessItemDialogProps) {
  const [choice, setChoice] = useState<ProjectChoice | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState<ProcessingMode>("add_activity_log_entry");
  const [creationDraft, setCreationDraft] = useState<{
    name: string;
  } | null>(null);
  const [createAreaId, setCreateAreaId] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCreating = creationDraft !== null;
  const createName = creationDraft?.name ?? "";
  const selectedProject = choice?.kind === "project" ? choice.project : null;

  const canSubmit =
    !!selectedProject ||
    (isCreating && createName.trim().length > 0 && !!createAreaId);

  const resetCreationFields = () => {
    setCreateAreaId(undefined);
  };

  const handleChoiceChange = (next: ProjectChoice | null) => {
    setChoice(next);
    if (next?.kind === "project") {
      setInputValue(next.project.name);
      setCreationDraft(null);
      resetCreationFields();
    } else if (next?.kind === "create") {
      setInputValue(next.name);
      setCreationDraft({ name: next.name });
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
        current ? { name: next.trim() } : current,
      );
      setChoice(
        next.trim().length > 0 ? { kind: "create", name: next.trim() } : null,
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
      choice.kind === "project" && choice.project.name === next;
    if (!stillMatches) {
      setChoice(null);
      resetCreationFields();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      if (isCreating) {
        await onProcess(item._id, {
          type: "create_project",
          name: createName.trim(),
          areaId: createAreaId as Id<"areas">,
        });
      } else if (selectedProject) {
        await onProcess(item._id, {
          type: mode,
          projectId: selectedProject._id,
        });
      }
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Process task</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <InboxItemPreview item={item} />
        <p className="-mt-3 text-sm text-muted-foreground">
          Move this Inbox task into a Thread as an Activity Log entry or Next
          Move.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <ProjectSearchAutocomplete
            areas={areas}
            projects={projects}
            isLoading={isLoading}
            value={choice}
            onValueChange={handleChoiceChange}
            inputValue={inputValue}
            onInputValueChange={handleInputValueChange}
          />

          {isCreating && (
            <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-2/60 p-4">
              <AreaChoice
                areas={areas}
                selectedAreaId={createAreaId}
                onSelect={setCreateAreaId}
              />
            </div>
          )}

          {selectedProject && (
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
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              Process
              <ArrowRight className="h-4 w-4" />
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function InboxItemPreview({ item }: { item: Doc<"items"> }) {
  const timestamp = formatDistanceToNow(new Date(item.createdAt), {
    addSuffix: true,
  });

  return (
    <Item
      size="sm"
      className="items-start gap-3 rounded-2xl border border-border-subtle bg-surface-2"
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
          {item.text}
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
                "h-7 rounded-full px-3 text-xs font-medium",
                !isSelected && "bg-transparent",
              )}
            >
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
        "group relative flex cursor-pointer items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-all",
        "border-border-subtle bg-surface-2 hover:border-border hover:bg-surface-3",
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
