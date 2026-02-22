import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Textarea } from "@/components/ui/textarea";

interface QuickCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickCaptureDialog({
  open,
  onOpenChange,
}: QuickCaptureDialogProps) {
  const [text, setText] = useState("");
  const createCapture = useMutation(api.captures.create).withOptimisticUpdate(
    (localStore, args) => {
      const current = localStore.getQuery(api.captures.list, {});
      if (current !== undefined) {
        localStore.setQuery(api.captures.list, {}, [
          {
            _id: crypto.randomUUID() as Id<"captures">,
            _creationTime: Date.now(),
            userId: "",
            text: args.text,
            createdAt: Date.now(),
          },
          ...current,
        ]);
      }

      const count = localStore.getQuery(api.captures.count, {});
      if (count !== undefined) {
        localStore.setQuery(api.captures.count, {}, count + 1);
      }
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    createCapture({ text: trimmed });
    setText("");
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Quick capture</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!text.trim()}>
              Capture
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
