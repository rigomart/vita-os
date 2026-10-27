import type { Repeat } from "@vita-os/contracts";
import type { MarkdownChangeCause } from "@vita-os/ui/components/markdown-editor";

import { decideSetNoteFollowUp, decideSetNoteRepeat } from "@vita-os/core";
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
  CalendarClock,
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  Repeat as RepeatIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useId, useRef, useState } from "react";

import { withTimeToken } from "../../attention-list/date-parts";
import { followUpDateLabels } from "../../attention-list/follow-up-date";
import { repeatLabel } from "../../attention-list/repeat";
import { WhenPicker } from "../../attention-list/when-picker";
import { clock } from "../../lib/clock";
import { browserTimeZone } from "../../lib/time-zone";
import { completeNoteFailure, completeNoteLabel } from "../use-complete-note";

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
    /** Absent for a Thread Note. `done` is how a Completed Note is stored. */
    state?: "open" | "done";
    createdAt: number;
    updatedAt?: number;
    completedAt?: number;
  };
  threadTitle?: string;
  onSubmit?: (value: {
    body: string;
    when?: number;
    repeat?: Repeat;
  }) => Promise<void> | void;
  onSave?: (body: string) => Promise<void> | void;
  /** Archive an Open Note, or unarchive an Archived one. */
  onToggleArchived?: () => Promise<void> | void;
  /** Deletes without asking: the owner offers Undo once the view has closed. */
  onDelete?: () => void;
  /** Read as the view closes: the element to focus; null returns focus to the opener. */
  finalFocus?: () => HTMLElement | null | undefined;
  /** Offered on an Open Standalone Note only: choose a Thread for it. */
  onAddToThread?: () => void;
  /** Offered on an Open Standalone Note only: start a Thread from it. */
  onNewThread?: () => void;
  followUp?: number;
  onSetWhen?: (when: number | undefined) => Promise<void> | void;
  /** The Follow-up date's Repeat, on a saved Standalone Note. */
  repeat?: Repeat;
  /** Offered in the picker of a saved Standalone Note; a new one holds its own. */
  onSetRepeat?: (repeat: Repeat | null) => Promise<void> | void;
  /** Offered on an Open repeating Note: move it to its next date. */
  onComplete?: () => Promise<void> | void;
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
  finalFocus,
  onAddToThread,
  onNewThread,
  followUp,
  onSetWhen,
  repeat,
  onSetRepeat,
  onComplete,
}: NoteDialogProps) {
  const feedback = useFeedback();
  const isCompose = note === undefined;
  const canWrite = isCompose ? onSubmit !== undefined : onSave !== undefined;
  const [savedBody, setSavedBody] = useState(note?.body ?? "");
  // The unsaved text, or null when nothing has been edited.
  const [draft, setDraft] = useState<string | null>(null);
  const [when, setWhen] = useState<number | undefined>(followUp);
  const [composeRepeat, setComposeRepeat] = useState<Repeat | undefined>();
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
    successMessage: archived ? "Note reopened" : "Note completed",
  });
  const changeWhen = useGuardedAsyncAction(async (value: number | undefined) =>
    onSetWhen?.(value),
  );
  const changeRepeat = useGuardedAsyncAction(async (value: Repeat | null) =>
    onSetRepeat?.(value),
  );
  const complete = useGuardedAsyncAction(async () => onComplete?.(), {
    getErrorMessage: completeNoteFailure,
  });
  const isPending =
    submit.isPending ||
    save.isPending ||
    saveTask.isPending ||
    toggle.isPending ||
    changeWhen.isPending ||
    changeRepeat.isPending ||
    complete.isPending;
  const error = isCompose ? submit.error : save.error;
  const isDirty = isCompose
    ? body !== "" || when !== followUp || composeRepeat !== undefined
    : draft !== null && draft !== savedBody;

  const composeDates = (next: { followUp?: number; repeat?: Repeat }) => {
    setWhen(next.followUp);
    setComposeRepeat(next.repeat);
  };

  const finishDismissal = () => {
    setDraft(null);
    setWhen(followUp);
    setComposeRepeat(undefined);
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
        ...(threadTitle === undefined ? { when, repeat: composeRepeat } : {}),
      });
      if (!result.ok) return;
      setDraft(null);
      setWhen(undefined);
      setComposeRepeat(undefined);
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

  const deleting = useRef(false);
  const handleDelete = () => {
    if (isPending || !onDelete) return;
    deleting.current = true;
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
  const shownRepeat = isCompose
    ? composeRepeat
    : shownWhen === undefined
      ? undefined
      : repeat;
  const canComplete =
    note?.state === "open" &&
    followUp !== undefined &&
    repeat !== undefined &&
    onComplete !== undefined;
  const completeLabel = canComplete
    ? completeNoteLabel({ followUp, repeat }, clock.now())
    : undefined;
  const attentionPicker =
    threadTitle === undefined && (isCompose || onSetWhen) ? (
      <WhenPicker
        busy={isPending}
        when={shownWhen}
        onSetWhen={(value) => {
          if (isCompose)
            composeDates(
              decideSetNoteFollowUp(
                { followUp: when, repeat: composeRepeat },
                value ?? null,
                browserTimeZone(),
              ),
            );
          else void changeWhen.run(value);
        }}
        {...(isCompose
          ? {
              repeat: {
                value: composeRepeat,
                onChange: (value: Repeat | null) =>
                  composeDates(
                    decideSetNoteRepeat(
                      { followUp: when },
                      value,
                      browserTimeZone(),
                    ),
                  ),
              },
            }
          : onSetRepeat === undefined
            ? {}
            : {
                repeat: {
                  value: repeat,
                  onChange: (value: Repeat | null) => changeRepeat.run(value),
                },
              })}
        trigger={
          <Button
            type="button"
            variant="secondary"
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
              "rounded-full bg-muted/70 font-medium text-muted-foreground hover:bg-muted",
              shownWhen !== undefined && "text-brand-accent-text",
            )}
          >
            {shownRepeat === undefined ? (
              <CalendarClock className="size-3.5" />
            ) : (
              <span
                role="img"
                aria-label={repeatLabel(shownRepeat)}
                data-slot="repeat-glyph"
                className="flex shrink-0 items-center"
              >
                <RepeatIcon aria-hidden className="size-3.5" />
              </span>
            )}
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
        finalFocus={finalFocus}
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
        // Clip, not hidden: vaul's ::after gives a bottom drawer scroll room
        // that scroll-into-view would use, cutting off the drawer's top (#502).
        className="flex max-h-[85dvh] flex-col overflow-clip sm:max-w-2xl data-[vaul-drawer-direction=bottom]:max-h-[85dvh] [&>div:last-child]:min-h-0 [&>div:last-child]:overflow-hidden"
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
                  data-slot="note-completed"
                  className="inline-flex h-5.5 shrink-0 items-center gap-1 rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground"
                >
                  <CheckIcon aria-hidden className="size-3" />
                  Completed
                  {note.completedAt === undefined ? null : (
                    <span className="hidden sm:inline">
                      {` ${format(note.completedAt, "MMM d")}`}
                    </span>
                  )}
                </span>
              ) : null}
              {!isCompose && (isDirty || dates) ? (
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/80">
                  {isDirty ? "Unsaved changes" : dates}
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
                  <DropdownMenuContent
                    align="end"
                    className="w-auto"
                    // The menu returns focus to its trigger as it closes; skip
                    // that while deleting, so the view's finalFocus holds.
                    finalFocus={() => !deleting.current}
                  >
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
            <div className="flex shrink-0 items-center gap-2">
              {attentionPicker}
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
                ) : canComplete ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    aria-busy={complete.isPending}
                    className="rounded-full px-4"
                    onClick={() => {
                      void complete.run();
                    }}
                  >
                    <CheckIcon />
                    {completeLabel}
                  </Button>
                ) : note && onToggleArchived ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    aria-busy={toggle.isPending}
                    className="rounded-full px-4"
                    onClick={() => {
                      void toggle.run();
                    }}
                  >
                    {archived ? <RotateCcwIcon /> : <CheckIcon />}
                    {archived ? "Reopen" : "Complete"}
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
