import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@vita-os/ui/components/alert-dialog";
import { Button } from "@vita-os/ui/components/button";
import { Markdown } from "@vita-os/ui/components/markdown";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { format } from "date-fns";
import { CalendarIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { RowDeleteAction, WhenPopover } from "../../attention-list/row-parts";
import { useMarkdownTextarea } from "./use-markdown-textarea";

export interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: {
    body: string;
    state: "open" | "done";
    createdAt: number;
    updatedAt?: number;
    completedAt?: number;
  };
  threadTitle?: string;
  onSubmit?: (value: { body: string; when?: number }) => Promise<void> | void;
  onSave?: (body: string) => Promise<void> | void;
  onToggleDone?: () => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  attentionDate?: number;
  onSetWhen?: (when: number | undefined) => Promise<void> | void;
}

export function NoteDialog({
  open,
  onOpenChange,
  note,
  threadTitle,
  onSubmit,
  onSave,
  onToggleDone,
  onDelete,
  attentionDate,
  onSetWhen,
}: NoteDialogProps) {
  const [mode, setMode] = useState<"compose" | "read" | "edit">(
    note ? "read" : "compose",
  );
  const [savedBody, setSavedBody] = useState(note?.body ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [when, setWhen] = useState<number | undefined>(attentionDate);
  const [discardTarget, setDiscardTarget] = useState<"read" | "close" | null>(
    null,
  );
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const previousMode = useRef(mode);

  useEffect(() => {
    if (mode === "read" && previousMode.current === "edit") {
      editButtonRef.current?.focus();
    }
    previousMode.current = mode;
  }, [mode]);

  // Optimistic cache changes can arrive during an edit. Refresh the document
  // without replacing the draft the user is working on.
  useEffect(() => setSavedBody(note?.body ?? ""), [note?.body]);

  const submit = useGuardedAsyncAction(
    async (value: { body: string; when?: number }) => onSubmit?.(value),
    { successMessage: "Note added", errorToast: false },
  );
  const save = useGuardedAsyncAction(async (value: string) => onSave?.(value), {
    successMessage: "Note saved",
    errorToast: false,
  });
  const toggle = useGuardedAsyncAction(async () => onToggleDone?.(), {
    successMessage: note?.state === "done" ? "Note reopened" : "Note completed",
  });
  const remove = useGuardedAsyncAction(async () => onDelete?.(), {
    successMessage: "Note deleted",
  });
  const changeWhen = useGuardedAsyncAction(async (value: number | undefined) =>
    onSetWhen?.(value),
  );
  const isPending =
    submit.isPending ||
    save.isPending ||
    toggle.isPending ||
    remove.isPending ||
    changeWhen.isPending;
  const error = mode === "compose" ? submit.error : save.error;
  const isDirty =
    mode === "compose"
      ? body !== "" || when !== attentionDate
      : mode === "edit" && body !== savedBody;
  const markdownTextarea = useMarkdownTextarea({
    value: body,
    onChange: setBody,
  });

  const finishDismissal = (target: "read" | "close") => {
    setBody(savedBody);
    setWhen(attentionDate);
    save.clearError();
    submit.clearError();
    if (target === "read") setMode("read");
    else onOpenChange(false);
  };

  const requestDismissal = (target: "read" | "close") => {
    if (isPending) return;
    if (isDirty) setDiscardTarget(target);
    else finishDismissal(target);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) onOpenChange(true);
    else requestDismissal("close");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || isPending) return;
    if (mode === "compose" && onSubmit) {
      const result = await submit.run({
        body: trimmed,
        when: threadTitle === undefined ? when : undefined,
      });
      if (!result.ok) return;
      setBody("");
      setWhen(undefined);
      onOpenChange(false);
    } else if (mode === "edit" && onSave) {
      const result = await save.run(trimmed);
      if (!result.ok) return;
      setSavedBody(trimmed);
      setBody(trimmed);
      setMode("read");
    }
  };

  const title =
    mode === "compose"
      ? threadTitle === undefined
        ? "New note"
        : `New note · ${threadTitle}`
      : (threadTitle ?? "Note");
  const dates = note
    ? [
        `Added ${format(note.createdAt, "MMM d")}`,
        note.updatedAt !== undefined && note.updatedAt !== note.createdAt
          ? `Edited ${format(note.updatedAt, "MMM d")}`
          : undefined,
        note.state === "done" && note.completedAt !== undefined
          ? `Done ${format(note.completedAt, "MMM d")}`
          : undefined,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const attentionPicker =
    threadTitle === undefined && (mode === "compose" || onSetWhen) ? (
      <WhenPopover
        busy={isPending}
        when={mode === "compose" ? when : attentionDate}
        onSetWhen={(value) => {
          if (mode === "compose") setWhen(value);
          else void changeWhen.run(value);
        }}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            aria-label={
              mode === "compose"
                ? "Attention date"
                : attentionDate === undefined
                  ? "Set attention date"
                  : "Change attention date"
            }
            className="rounded-full text-muted-foreground"
          >
            <CalendarIcon className="size-3" />
            {(mode === "compose" ? when : attentionDate) === undefined
              ? "Attention date"
              : format((mode === "compose" ? when : attentionDate)!, "MMM d")}
          </Button>
        }
      />
    ) : null;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      guardDrawerClose={isDirty || isPending}
    >
      <ResponsiveDialogContent
        surface="framed"
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          if (mode !== "edit" || discardTarget) return;
          event.preventDefault();
          event.stopPropagation();
          requestDismissal("read");
        }}
        className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-2xl data-[vaul-drawer-direction=bottom]:max-h-[85dvh] [&>div:last-child]:min-h-0 [&>div:last-child]:overflow-hidden"
      >
        <div className="flex min-h-0 max-h-[calc(85dvh-4rem)] flex-col gap-4">
          <ResponsiveDialogHeader className="shrink-0 flex-row items-start justify-between gap-2">
            <div className="min-w-0 text-left">
              <ResponsiveDialogTitle className="font-heading text-sm font-medium">
                {title}
              </ResponsiveDialogTitle>
              <ResponsiveDialogDescription className="sr-only">
                {mode === "read"
                  ? "Read and manage this note."
                  : mode === "edit"
                    ? "Edit the note using Markdown."
                    : "Write a note using Markdown."}
              </ResponsiveDialogDescription>
              {dates ? (
                <p className="mt-1 text-xs text-muted-foreground">{dates}</p>
              ) : null}
            </div>
            {isPending ? null : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="-my-1 -mr-1 shrink-0 rounded-full text-muted-foreground"
                onClick={() => handleOpenChange(false)}
              >
                <XIcon />
                <span className="sr-only">Close</span>
              </Button>
            )}
          </ResponsiveDialogHeader>
          {mode === "read" ? (
            <>
              <div className="min-h-0 overflow-y-auto overscroll-contain pr-1">
                <Markdown>{savedBody}</Markdown>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                <div className="flex flex-wrap items-center gap-1">
                  {attentionPicker}
                  {onDelete ? (
                    <RowDeleteAction
                      busy={isPending}
                      label="Delete note"
                      title="Delete note?"
                      description="This note will be permanently deleted."
                      confirmLabel="Delete"
                      onConfirm={() => {
                        if (isPending) return;
                        void remove.run().then((result) => {
                          if (result.ok) onOpenChange(false);
                        });
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {onToggleDone ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      aria-busy={toggle.isPending}
                      className="rounded-full"
                      onClick={() => {
                        void toggle.run();
                      }}
                    >
                      {note?.state === "done" ? "Reopen" : "Done"}
                    </Button>
                  ) : null}
                  {onSave ? (
                    <Button
                      ref={editButtonRef}
                      type="button"
                      size="sm"
                      disabled={isPending}
                      className="rounded-full px-4"
                      onClick={() => {
                        setBody(savedBody);
                        save.clearError();
                        setMode("edit");
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-col gap-3"
            >
              <div className="min-h-0 overflow-y-auto overscroll-contain">
                <Textarea
                  variant="inline"
                  aria-label="Note body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="What's on your mind?"
                  rows={12}
                  autoFocus
                  disabled={isPending}
                  className="min-h-64 resize-none py-2 text-base leading-relaxed caret-ring disabled:opacity-100"
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      event.preventDefault();
                      void handleSubmit(event);
                    } else markdownTextarea.onKeyDown(event);
                  }}
                />
              </div>
              {error ? (
                <p role="alert" className="shrink-0 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/60 pt-3">
                {mode === "compose" ? (
                  (attentionPicker ?? <span />)
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    className="rounded-full"
                    onClick={() => requestDismissal("read")}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-full px-4"
                  disabled={
                    !body.trim() ||
                    isPending ||
                    (mode === "compose" ? !onSubmit : !onSave)
                  }
                  aria-busy={isPending}
                >
                  {mode === "compose" ? "Add" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </ResponsiveDialogContent>
      <AlertDialog
        open={discardTarget !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDiscardTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!discardTarget) return;
                finishDismissal(discardTarget);
                setDiscardTarget(null);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResponsiveDialog>
  );
}
