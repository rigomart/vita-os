import type { AreaId } from "@vita-os/contracts";

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
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useEffect, useState } from "react";

import type { ThreadFormValue } from "./types";

import { AreaPicker } from "../../areas/components/area-picker";

interface ThreadFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultAreaId?: AreaId;
  initialValue?: Partial<ThreadFormValue>;
  onSubmit: (value: ThreadFormValue) => Promise<void> | void;
}

function getThreadSaveError(error: unknown) {
  const detail =
    error instanceof Error && error.message
      ? error.message
      : "Please try again.";
  return `Thread was not saved. ${detail}`;
}

export function ThreadFormDialog({
  mode,
  open,
  onOpenChange,
  defaultAreaId,
  initialValue,
  onSubmit,
}: ThreadFormDialogProps) {
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [areaId, setAreaId] = useState<AreaId | undefined>(
    initialValue?.areaId ?? defaultAreaId,
  );

  useEffect(() => {
    if (!open) return;
    setTitle(initialValue?.title ?? "");
    setAreaId(initialValue?.areaId ?? defaultAreaId);
  }, [open, initialValue, defaultAreaId]);

  const {
    run: submitThread,
    isPending,
    error,
  } = useGuardedAsyncAction(onSubmit, {
    successMessage: mode === "create" ? "Thread created" : undefined,
    errorToast: false,
    getErrorMessage: getThreadSaveError,
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (isPending && !nextOpen) return;
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || isPending) return;

    const result = await submitThread({
      title: trimmedTitle,
      ...(areaId === undefined ? {} : { areaId }),
    });
    if (!result.ok) return;

    if (mode === "create") {
      setTitle("");
      setAreaId(defaultAreaId);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent showCloseButton={!isPending}>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {mode === "edit" ? "Edit thread" : "New thread"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {mode === "edit"
              ? "Update this thread's details."
              : "Threads are ongoing situations. A title is all they need."}
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
              disabled={isPending}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Area</span>
            <AreaPicker
              value={areaId}
              onChange={setAreaId}
              disabled={isPending}
            />
          </div>
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
              disabled={!title.trim() || isPending}
              aria-busy={isPending}
            >
              {mode === "edit" ? "Save changes" : "Create thread"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
