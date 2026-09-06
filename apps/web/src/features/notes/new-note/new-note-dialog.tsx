import { Button } from "@vita-os/ui/components/button";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useState } from "react";

import type { CreateNoteValue } from "@/features/notes/use-create-note";

interface NewNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: CreateNoteValue) => Promise<void> | void;
}

export function NewNoteDialog({
  open,
  onOpenChange,
  onSubmit,
}: NewNoteDialogProps) {
  const [body, setBody] = useState("");
  const [when, setWhen] = useState<Date | undefined>(undefined);

  const {
    run: submitNote,
    isPending,
    error,
  } = useGuardedAsyncAction(onSubmit, {
    successMessage: "Note added",
    errorToast: false,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isPending) return;

    const result = await submitNote({ body: trimmed, when: when?.getTime() });
    if (!result.ok) return;

    setBody("");
    setWhen(undefined);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent showCloseButton={!isPending}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>New note</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            aria-label="Note body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind?"
            rows={3}
            autoFocus
            disabled={isPending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
          />
          <DatePicker
            value={when}
            onChange={setWhen}
            placeholder="Attention date (optional)"
          />
          <p className="text-xs text-muted-foreground">
            Bring this Note back into attention on this date.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!body.trim() || isPending}
              aria-busy={isPending}
            >
              Add
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
