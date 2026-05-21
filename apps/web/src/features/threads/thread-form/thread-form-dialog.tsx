import type { Doc, Id } from "@convex/_generated/dataModel";
import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import { Label } from "@vita-os/ui/components/label";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useEffect, useState } from "react";
import { AreaPicker } from "@/features/areas/components/area-picker";
import type { ThreadFormValue } from "./types";

interface ThreadFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Doc<"areas">[];
  defaultAreaId?: Id<"areas">;
  initialValue?: Partial<ThreadFormValue>;
  onSubmit: (value: ThreadFormValue) => Promise<void> | void;
}

export function ThreadFormDialog({
  mode,
  open,
  onOpenChange,
  areas,
  defaultAreaId,
  initialValue,
  onSubmit,
}: ThreadFormDialogProps) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [summary, setSummary] = useState(initialValue?.summary ?? "");
  const [areaId, setAreaId] = useState<string | undefined>(
    initialValue?.areaId ?? defaultAreaId,
  );

  useEffect(() => {
    if (!open) return;
    setTitle(initialValue?.title ?? "");
    setSummary(initialValue?.summary ?? "");
    setAreaId(initialValue?.areaId ?? defaultAreaId);
  }, [open, initialValue, defaultAreaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !areaId) return;

    await onSubmit({
      title: trimmedTitle,
      summary: summary.trim() || undefined,
      areaId: areaId as Id<"areas">,
    });

    if (mode === "create") {
      setTitle("");
      setSummary("");
      setAreaId(defaultAreaId);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {mode === "edit" ? "Edit thread" : "New thread"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {mode === "edit"
              ? "Update this thread's details."
              : "Threads are ongoing situations that belong to an area."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="thread-name">Title</Label>
            <Input
              id="thread-name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Renew passport, File Q4 taxes"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thread-summary">
              Summary
              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="thread-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What is this thread about?"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Area</Label>
            <AreaPicker
              areas={areas}
              selectedAreaId={areaId}
              onSelect={setAreaId}
            />
          </div>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || !areaId}>
              {mode === "edit" ? "Save changes" : "Create thread"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
