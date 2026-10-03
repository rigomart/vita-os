import type { AreaId } from "@vita-os/contracts";

import { Button } from "@vita-os/ui/components/button";
import { Input } from "@vita-os/ui/components/input";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { XIcon } from "lucide-react";
import { useState } from "react";

import type { CreateThreadValue } from "../use-create-thread";

import { AreaPicker } from "../../areas/components/area-picker";

interface NewThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAreaId?: AreaId;
  /** A suggested title the person can edit, as when starting from a Note. */
  defaultTitle?: string;
  onSubmit: (value: CreateThreadValue) => Promise<void> | void;
}

function getThreadSaveError(error: unknown) {
  const detail =
    error instanceof Error && error.message
      ? error.message
      : "Please try again.";
  return `Thread was not saved. ${detail}`;
}

/**
 * Capture a Thread in the new Note dialog's grammar: the title is the writing
 * surface, and the Area and Create float on it.
 */
export function NewThreadDialog({
  open,
  onOpenChange,
  defaultAreaId,
  defaultTitle = "",
  onSubmit,
}: NewThreadDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [areaId, setAreaId] = useState<AreaId | undefined>(defaultAreaId);

  const {
    run: submitThread,
    isPending,
    error,
  } = useGuardedAsyncAction(onSubmit, {
    successMessage: "Thread created",
    errorToast: false,
    getErrorMessage: getThreadSaveError,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isPending) return;

    const result = await submitThread({
      title: trimmed,
      ...(areaId === undefined ? {} : { areaId }),
    });
    if (!result.ok) return;

    setTitle(defaultTitle);
    setAreaId(defaultAreaId);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent surface="framed" showCloseButton={false}>
        <ResponsiveDialogHeader className="flex-row items-center justify-between gap-2">
          <ResponsiveDialogTitle className="font-heading text-xs font-medium text-muted-foreground">
            New thread
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
          <Input
            variant="inline"
            aria-label="Thread title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's going on?"
            autoFocus
            disabled={isPending}
            className="py-2 text-lg font-medium caret-ring disabled:opacity-100"
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <AreaPicker
              value={areaId}
              onChange={setAreaId}
              disabled={isPending}
            />
            <Button
              type="submit"
              size="sm"
              className="rounded-full px-4"
              disabled={!title.trim() || isPending}
              aria-busy={isPending}
            >
              Create
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
