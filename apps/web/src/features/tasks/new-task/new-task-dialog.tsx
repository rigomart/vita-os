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

import type { CreateTaskValue } from "@/features/tasks/use-create-task";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (value: CreateTaskValue) => Promise<void> | void;
}

export function NewTaskDialog({
  open,
  onOpenChange,
  onSubmit,
}: NewTaskDialogProps) {
  const [text, setText] = useState("");
  const [when, setWhen] = useState<Date | undefined>(undefined);

  const {
    run: submitTask,
    isPending,
    error,
  } = useGuardedAsyncAction(onSubmit, {
    successMessage: "Task added",
    errorToast: false,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isPending) return;

    const result = await submitTask({ text: trimmed, when: when?.getTime() });
    if (!result.ok) return;

    setText("");
    setWhen(undefined);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent showCloseButton={!isPending}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>New task</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
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
          <DatePicker value={when} onChange={setWhen} placeholder="Add When" />
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
              disabled={!text.trim() || isPending}
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
