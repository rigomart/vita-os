import type { MarkdownChangeCause } from "@vita-os/ui/components/markdown-editor";

import { Button } from "@vita-os/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { Kbd } from "@vita-os/ui/components/kbd";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  CalendarClock,
  CopyIcon,
  EllipsisIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";

import { withTimeToken } from "../../attention-list/date-parts";
import { followUpDateLabels } from "../../attention-list/follow-up-date";
import { WhenPopover } from "../../attention-list/row-parts";

// CodeMirror is a large share of the bundle. It starts downloading with this
// module, so it is usually ready before the first Note view opens.
const editorModule = import("@vita-os/ui/components/markdown-editor");
const MarkdownEditor = lazy(() =>
  editorModule.then((module) => ({ default: module.MarkdownEditor })),
);

export interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: {
    body: string;
    /** `done` is how an Archived Note is stored. */
    state: "open" | "done";
    createdAt: number;
    updatedAt?: number;
    completedAt?: number;
  };
  threadTitle?: string;
  onSubmit?: (value: { body: string; when?: number }) => Promise<void> | void;
  onSave?: (body: string) => Promise<void> | void;
  /** Archive an Open Note, or unarchive an Archived one. */
  onToggleArchived?: () => Promise<void> | void;
  /** Deletes without asking: the owner offers Undo once the view has closed. */
  onDelete?: () => void;
  /** Offered on an Open Standalone Note only: choose a Thread for it. */
  onAddToThread?: () => void;
  /** Offered on an Open Standalone Note only: start a Thread from it. */
  onNewThread?: () => void;
  followUp?: number;
  onSetWhen?: (when: number | undefined) => Promise<void> | void;
}

const isApple =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

/** Escape inside a menu or popover belongs to it, not to the view behind it. */
function inFloatingLayer(target: EventTarget | null) {
  return (
    target instanceof Element &&
    target.closest(
      '[data-slot="dropdown-menu-content"], [data-slot="popover-content"]',
    ) !== null
  );
}

export function NoteDialog({
  open,
  onOpenChange,
  note,
  threadTitle,
  onSubmit,
  onSave,
  onToggleArchived,
  onDelete,
  onAddToThread,
  onNewThread,
  followUp,
  onSetWhen,
}: NoteDialogProps) {
  const feedback = useFeedback();
  const isCompose = note === undefined;
  const canWrite = isCompose ? onSubmit !== undefined : onSave !== undefined;
  const [savedBody, setSavedBody] = useState(note?.body ?? "");
  // The unsaved text, or null when nothing has been edited.
  const [draft, setDraft] = useState<string | null>(null);
  const [when, setWhen] = useState<number | undefined>(followUp);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const discardTitleId = useId();

  // Optimistic cache changes can arrive during an edit. Refresh the document
  // without replacing the draft the user is working on.
  useEffect(() => setSavedBody(note?.body ?? ""), [note?.body]);

  const body = draft ?? savedBody;

  useEffect(() => {
    if (confirmingDiscard) keepEditingRef.current?.focus();
  }, [confirmingDiscard]);

  const submit = useGuardedAsyncAction(
    async (value: { body: string; when?: number }) => onSubmit?.(value),
    { successMessage: "Note added", errorToast: false },
  );
  const save = useGuardedAsyncAction(async (value: string) => onSave?.(value), {
    successMessage: "Note saved",
    errorToast: false,
  });
  // Ticking a box on a saved Note saves quietly; a failure still reports.
  const saveTask = useGuardedAsyncAction(async (value: string) =>
    onSave?.(value),
  );
  const archived = note?.state === "done";
  const toggle = useGuardedAsyncAction(async () => onToggleArchived?.(), {
    successMessage: archived ? "Note unarchived" : "Note archived",
  });
  const changeWhen = useGuardedAsyncAction(async (value: number | undefined) =>
    onSetWhen?.(value),
  );
  const isPending =
    submit.isPending ||
    save.isPending ||
    saveTask.isPending ||
    toggle.isPending ||
    changeWhen.isPending;
  const error = isCompose ? submit.error : save.error;
  const isDirty = isCompose
    ? body !== "" || when !== followUp
    : draft !== null && draft !== savedBody;

  const finishDismissal = () => {
    setDraft(null);
    setWhen(followUp);
    setConfirmingDiscard(false);
    save.clearError();
    submit.clearError();
    onOpenChange(false);
  };

  const requestDismissal = () => {
    if (isPending) return;
    if (isDirty) setConfirmingDiscard(true);
    else finishDismissal();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) onOpenChange(true);
    else requestDismissal();
  };

  const handleSubmit = async () => {
    const trimmed = body.trim();
    if (!trimmed || isPending) return;
    if (isCompose && onSubmit) {
      const result = await submit.run({
        body: trimmed,
        when: threadTitle === undefined ? when : undefined,
      });
      if (!result.ok) return;
      setDraft(null);
      setWhen(undefined);
      onOpenChange(false);
    } else if (!isCompose && onSave && isDirty) {
      const result = await save.run(trimmed);
      if (!result.ok) return;
      setSavedBody(trimmed);
      setDraft(null);
    }
  };

  const handleChange = (next: string, cause: MarkdownChangeCause) => {
    if (cause === "edit" || isCompose || isDirty) {
      setDraft(next);
      return;
    }
    const previous = savedBody;
    setSavedBody(next);
    // A draft typed back to the saved text is not a change; the tick replaces it.
    setDraft(null);
    void saveTask.run(next).then((result) => {
      if (!result.ok) setSavedBody(previous);
    });
  };

  const copyMarkdown = () => {
    void navigator.clipboard?.writeText(body).then(
      () => feedback.success("Markdown copied"),
      () => feedback.error("The note could not be copied."),
    );
  };

  // Adding takes the saved Note; an unsaved draft must be saved or discarded
  // first, so it is never lost on the way into a Thread.
  const canAddToThread = note?.state === "open" && !isPending && !isDirty;

  const handleDelete = () => {
    if (isPending || !onDelete) return;
    onDelete();
    onOpenChange(false);
  };

  const title = isCompose
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
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const shownWhen = isCompose ? when : followUp;
  const attentionPicker =
    threadTitle === undefined && (isCompose || onSetWhen) ? (
      <WhenPopover
        busy={isPending}
        when={shownWhen}
        onSetWhen={(value) => {
          if (isCompose) setWhen(value);
          else void changeWhen.run(value);
        }}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            aria-label={
              isCompose
                ? followUpDateLabels.name
                : followUp === undefined
                  ? followUpDateLabels.set
                  : followUpDateLabels.change
            }
            className={cn(
              "-ml-2 rounded-full text-muted-foreground",
              shownWhen !== undefined && "text-brand-accent-text",
            )}
          >
            <CalendarClock className="size-3.5" />
            {shownWhen === undefined
              ? followUpDateLabels.name
              : withTimeToken(format(shownWhen, "MMM d"), shownWhen)}
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
          if (inFloatingLayer(event.target)) {
            event.preventDefault();
            return;
          }
          if (!confirmingDiscard) return;
          // Escape answers the question with its safe choice: keep editing.
          event.preventDefault();
          event.stopPropagation();
          setConfirmingDiscard(false);
        }}
        className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-2xl data-[vaul-drawer-direction=bottom]:max-h-[85dvh] [&>div:last-child]:min-h-0 [&>div:last-child]:overflow-hidden"
      >
        <div className="flex max-h-[calc(85dvh-4rem)] min-h-0 flex-col gap-3">
          {/* In a drawer the handle sits right above the header. */}
          <ResponsiveDialogHeader className="shrink-0 flex-row items-center justify-between gap-2 in-data-[slot=drawer-content]:pt-4">
            <div className="flex min-w-0 items-center gap-2.5 text-left">
              <ResponsiveDialogTitle className="flex min-w-0 items-center gap-2 font-heading text-xs font-semibold text-muted-foreground">
                {!isCompose && threadTitle !== undefined ? (
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full border-2 border-brand-accent"
                  />
                ) : null}
                <span className="truncate">{title}</span>
              </ResponsiveDialogTitle>
              {note?.state === "done" ? (
                <span
                  data-slot="note-archived"
                  className="inline-flex h-5.5 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground"
                >
                  <ArchiveIcon aria-hidden className="size-3" />
                  Archived
                  {/* A phone's header has no room for the date beside the
                      switch; the footer still says when the Note was added. */}
                  {note.completedAt === undefined ? null : (
                    <span className="hidden sm:inline">
                      {` ${format(note.completedAt, "MMM d")}`}
                    </span>
                  )}
                </span>
              ) : null}
              <ResponsiveDialogDescription className="sr-only">
                {isCompose
                  ? "Write a note using Markdown."
                  : "Read, edit and manage this note. It uses Markdown."}
              </ResponsiveDialogDescription>
            </div>
            <div className="-my-1 flex shrink-0 items-center gap-1">
              {!isCompose ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    disabled={isPending}
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground"
                      />
                    }
                  >
                    <EllipsisIcon />
                    <span className="sr-only">More actions</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-auto">
                    <DropdownMenuItem onClick={copyMarkdown}>
                      <CopyIcon />
                      Copy Markdown
                    </DropdownMenuItem>
                    {note?.state === "open" && onAddToThread ? (
                      <DropdownMenuItem
                        disabled={!canAddToThread}
                        onClick={onAddToThread}
                      >
                        <MessageSquarePlusIcon />
                        Add to thread…
                      </DropdownMenuItem>
                    ) : null}
                    {note?.state === "open" && onNewThread ? (
                      <DropdownMenuItem
                        disabled={!canAddToThread}
                        onClick={onNewThread}
                      >
                        <MessageSquareIcon />
                        New thread from note
                      </DropdownMenuItem>
                    ) : null}
                    {onDelete ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={handleDelete}
                      >
                        <Trash2Icon />
                        Delete note
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {isPending ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-mr-1.5 shrink-0 rounded-full text-muted-foreground"
                  onClick={() => handleOpenChange(false)}
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              )}
            </div>
          </ResponsiveDialogHeader>

          <div className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1 py-1">
            <Suspense fallback={<div className="min-h-85" />}>
              <MarkdownEditor
                aria-label="Note body"
                value={body}
                onChange={handleChange}
                onSubmit={() => void handleSubmit()}
                readOnly={!canWrite}
                disabled={isPending}
                autoFocus={isCompose}
                placeholder="What's on your mind?"
                className="[&_.cm-content]:min-h-85!"
              />
            </Suspense>
          </div>

          {error ? (
            <p role="alert" className="shrink-0 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {confirmingDiscard ? (
            <div
              role="alertdialog"
              aria-labelledby={discardTitleId}
              className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-3xl border border-destructive/20 bg-destructive/8 py-1.5 pr-1.5 pl-3.5"
            >
              <p
                id={discardTitleId}
                className="flex items-center gap-2 text-sm font-medium"
              >
                <TriangleAlertIcon
                  aria-hidden
                  className="size-4 shrink-0 text-destructive"
                />
                Discard unsaved changes?
              </p>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  ref={keepEditingRef}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setConfirmingDiscard(false)}
                >
                  Keep editing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full bg-destructive px-4 text-destructive-foreground hover:bg-destructive/90"
                  onClick={finishDismissal}
                >
                  Discard
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <div className="flex items-center gap-1.5">
                {attentionPicker}
                {note && onToggleArchived ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    aria-busy={toggle.isPending}
                    className="rounded-full"
                    onClick={() => {
                      void toggle.run();
                    }}
                  >
                    {archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
                    {archived ? "Unarchive" : "Archive"}
                  </Button>
                ) : null}
              </div>
              <div className="ml-auto flex items-center gap-2.5">
                {isCompose ? (
                  <>
                    <Kbd aria-hidden className="hidden sm:inline-flex">
                      {isApple ? "⌘" : "Ctrl"} ↵
                    </Kbd>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full px-4"
                      disabled={!body.trim() || isPending || !onSubmit}
                      aria-busy={isPending}
                      onClick={() => void handleSubmit()}
                    >
                      Add
                    </Button>
                  </>
                ) : isDirty ? (
                  <>
                    <span className="text-xs text-muted-foreground">
                      Unsaved changes
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-full px-4"
                      disabled={!body.trim() || isPending || !onSave}
                      aria-busy={isPending}
                      onClick={() => void handleSubmit()}
                    >
                      Save
                    </Button>
                  </>
                ) : dates ? (
                  <p className="text-xs text-muted-foreground">{dates}</p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
