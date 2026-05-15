import { api } from "@convex/_generated/api";
import { Button } from "@vita-os/ui/components/button";
import { useMutation } from "convex/react";
import { Check, GripVertical, ListOrdered, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
} from "@/components/ui/sortable";
import {
  optimisticallyCompleteNextAction,
  optimisticallyUpdateProject,
} from "@/features/projects/optimistic";
import { useStableQuery } from "@/hooks/use-stable-query";
import { cn } from "@/lib/utils";

interface ActionItem {
  id: string;
  text: string;
}

interface ActionQueueProps {
  projectSlug: string;
}

export function ActionQueue({ projectSlug }: ActionQueueProps) {
  const project = useStableQuery(api.projects.getBySlug, {
    slug: projectSlug,
  });
  const updateProject = useMutation(api.projects.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateProject(localStore, args, { projectSlug });
    },
  );
  const completeAction = useMutation(
    api.projects.completeAction,
  ).withOptimisticUpdate((localStore, args) => {
    optimisticallyCompleteNextAction(localStore, args, { projectSlug });
  });

  const queue = project?.actionQueue ?? [];

  const handleReorder = (items: ActionItem[]) => {
    if (!project) return;
    updateProject({ id: project._id, actionQueue: items });
  };

  const handleEdit = (itemId: string, text: string) => {
    if (!project) return;
    updateProject({
      id: project._id,
      actionQueue: queue.map((item) =>
        item.id === itemId ? { ...item, text } : item,
      ),
    });
  };

  const handleAdd = (text: string) => {
    if (!project) return;
    updateProject({
      id: project._id,
      actionQueue: [...queue, { id: crypto.randomUUID(), text }],
    });
  };

  const handleRemove = (itemId: string) => {
    if (!project) return;
    updateProject({
      id: project._id,
      actionQueue: queue.filter((item) => item.id !== itemId),
    });
  };

  const handleComplete = () => {
    if (!project) return;
    completeAction({ id: project._id });
  };

  const [addText, setAddText] = useState("");

  const handleAddLocal = () => {
    const text = addText.trim();
    if (!text) return;
    handleAdd(text);
    setAddText("");
  };

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <ListOrdered className="h-3.5 w-3.5" />
        Action Queue
        {queue.length > 0 && (
          <span className="text-muted-foreground/60">{queue.length}</span>
        )}
      </div>

      {queue.length > 0 && (
        <Sortable
          value={queue}
          onValueChange={handleReorder}
          getItemValue={(item) => item.id}
        >
          <SortableContent className="space-y-1">
            {queue.map((item, index) => (
              <ActionQueueItem
                key={item.id}
                item={item}
                index={index}
                isCurrent={index === 0}
                onEdit={handleEdit}
                onRemove={handleRemove}
                onComplete={handleComplete}
              />
            ))}
          </SortableContent>
        </Sortable>
      )}

      <div className={cn("flex gap-2", queue.length > 0 && "mt-2")}>
        <input
          type="text"
          value={addText}
          onChange={(e) => setAddText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAddLocal();
            }
          }}
          placeholder={
            queue.length === 0 ? "Add your first action..." : "Add next step..."
          }
          className="w-full rounded bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}

function ActionQueueItem({
  item,
  index,
  isCurrent,
  onEdit,
  onRemove,
  onComplete,
}: {
  item: ActionItem;
  index: number;
  isCurrent: boolean;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onComplete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(item.text);
  }, [item.text]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.text) {
      onEdit(item.id, trimmed);
    } else {
      setDraft(item.text);
    }
  };

  return (
    <SortableItem
      value={item.id}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-1.5",
        isCurrent && "bg-surface-3/60",
      )}
    >
      <SortableItemHandle asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground/40 hover:text-muted-foreground"
        >
          <GripVertical />
        </Button>
      </SortableItemHandle>

      {isCurrent ? (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onComplete}
          className="rounded-full border border-green-500/40 text-green-600 hover:bg-green-500/10 hover:text-green-600"
          aria-label="Complete action"
        >
          <Check />
        </Button>
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center text-xs text-muted-foreground/50">
          {index}.
        </span>
      )}

      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(item.text);
            }
          }}
          className="min-w-0 flex-1 rounded border-none bg-transparent px-1 py-0.5 text-sm outline-none ring-1 ring-ring"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "min-w-0 flex-1 cursor-text truncate rounded px-1 py-0.5 text-left text-sm transition-colors hover:bg-muted/50",
            isCurrent && "font-medium",
          )}
        >
          {item.text}
        </button>
      )}

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => onRemove(item.id)}
        className="text-muted-foreground/40 opacity-0 hover:text-destructive group-hover:opacity-100"
        aria-label="Remove action"
      >
        <X />
      </Button>
    </SortableItem>
  );
}
