import { Button } from "@vita-os/ui/components/button";
import { DatePicker } from "@vita-os/ui/components/date-picker";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { XIcon } from "lucide-react";
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
      <ResponsiveDialogContent surface="framed" showCloseButton={false}>
        <ResponsiveDialogHeader className="flex-row items-center justify-between gap-2">
          <ResponsiveDialogTitle className="font-heading text-xs font-medium text-muted-foreground">
            New note
          </ResponsiveDialogTitle>
          {isPending ? null : (
            <ResponsiveDialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="-my-1 -mr-1 rounded-full text-muted-foreground hover:text-foreground"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </ResponsiveDialogClose>
          )}
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <Textarea
            variant="inline"
            aria-label="Note body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What's on your mind?"
            rows={6}
            autoFocus
            disabled={isPending}
            className="min-h-40 py-2 text-base leading-relaxed caret-ring disabled:opacity-100"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSubmit(e);
              }
            }}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <DatePicker
              value={when}
              onChange={setWhen}
              disabled={isPending}
              placeholder="Attention date"
              className="-ml-1 rounded-full"
            />
            <Button
              type="submit"
              size="sm"
              className="rounded-full px-4"
              disabled={!body.trim() || isPending}
              aria-busy={isPending}
            >
              Add
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
