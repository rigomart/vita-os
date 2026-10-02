import { Button } from "@vita-os/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@vita-os/ui/components/dropdown-menu";
import { Kbd } from "@vita-os/ui/components/kbd";
import { Markdown, toggleMarkdownTask } from "@vita-os/ui/components/markdown";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@vita-os/ui/components/responsive-dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@vita-os/ui/components/tabs";
import { Textarea } from "@vita-os/ui/components/textarea";
import { useGuardedAsyncAction } from "@vita-os/ui/hooks/use-guarded-async-action";
import { useFeedback } from "@vita-os/ui/lib/feedback";
import { cn } from "@vita-os/ui/lib/utils";
import { format } from "date-fns";
import {
  CalendarClock,
  CheckIcon,
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
  TriangleAlertIcon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { withTimeToken } from "../../attention-list/date-parts";
import { followUpDateLabels } from "../../attention-list/follow-up-date";
import { WhenPopover } from "../../attention-list/row-parts";
import { useMarkdownTextarea } from "./use-markdown-textarea";

type Mode = "read" | "write";

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
  /** Deletes without asking: the owner offers Undo once the view has closed. */
  onDelete?: () => void;
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
  onToggleDone,
  onDelete,
  followUp,
  onSetWhen,
}: NoteDialogProps) {
  const feedback = useFeedback();
  const isCompose = note === undefined;
  const canWrite = isCompose ? onSubmit !== undefined : onSave !== undefined;
  const [mode, setMode] = useState<Mode>(isCompose ? "write" : "read");
  const [savedBody, setSavedBody] = useState(note?.body ?? "");
  // The unsaved text, or null when nothing has been edited. Read shows it, so
  // switching modes previews a draft instead of throwing it away.
  const [draft, setDraft] = useState<string | null>(null);
  const [when, setWhen] = useState<number | undefined>(followUp);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const writeTabRef = useRef<HTMLButtonElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const focusEditorOnWrite = useRef(false);
  const focusWriteTab = useRef(false);
  const discardTitleId = useId();

  // Optimistic cache changes can arrive during an edit. Refresh the document
  // without replacing the draft the user is working on.
  useEffect(() => setSavedBody(note?.body ?? ""), [note?.body]);

  const body = draft ?? savedBody;

  useEffect(() => {
    if (mode === "write" && focusEditorOnWrite.current) {
      focusEditorOnWrite.current = false;
      const textarea = textareaRef.current;
      textarea?.focus();
      textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
    }
    if (mode === "read" && focusWriteTab.current) {
      focusWriteTab.current = false;
      writeTabRef.current?.focus();
    }
  }, [mode]);

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
  // Ticking a box while reading saves quietly; a failure still reports.
  const saveTask = useGuardedAsyncAction(async (value: string) =>
    onSave?.(value),
  );
  const toggle = useGuardedAsyncAction(async () => onToggleDone?.(), {
    successMessage: note?.state === "done" ? "Note reopened" : "Note completed",
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
  const markdownTextarea = useMarkdownTextarea({
    value: body,
    onChange: setDraft,
  });

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
      if (mode === "write") {
        focusWriteTab.current = true;
        setMode("read");
      }
    }
  };

  const handleToggleTask = (offset: number) => {
    if (isPending) return;
    const next = toggleMarkdownTask(body, offset);
    if (next === body) return;
    if (isCompose || isDirty) {
      setDraft(next);
      return;
    }
    const previous = savedBody;
    setSavedBody(next);
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
        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as Mode)}
          className="flex max-h-[calc(85dvh-4rem)] min-h-0 flex-col gap-3"
        >
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
                <span className="inline-flex h-5.5 shrink-0 items-center gap-1 rounded-full bg-condition-healthy/10 px-2 text-xs font-semibold text-condition-healthy">
                  <CheckIcon aria-hidden className="size-3" />
                  {note.completedAt === undefined
                    ? "Done"
                    : `Done ${format(note.completedAt, "MMM d")}`}
                </span>
              ) : null}
              <ResponsiveDialogDescription className="sr-only">
                {isCompose
                  ? "Write a note using Markdown."
                  : "Read and manage this note."}
              </ResponsiveDialogDescription>
            </div>
            <div className="-my-1 flex shrink-0 items-center gap-1">
              {canWrite ? (
                <TabsList
                  aria-label="Note view"
                  className="h-8 gap-0.5 bg-muted p-[3px]"
                >
                  <TabsTrigger
                    value="read"
                    className="h-full gap-1.5 px-2.5 text-xs font-semibold data-active:bg-surface-2 data-active:shadow-xs data-active:ring-1 data-active:ring-border dark:data-active:bg-foreground/15 [&_svg:not([class*='size-'])]:size-3.5"
                  >
                    <EyeIcon aria-hidden />
                    Read
                  </TabsTrigger>
                  <TabsTrigger
                    ref={writeTabRef}
                    value="write"
                    onPointerDown={() => {
                      focusEditorOnWrite.current = true;
                    }}
                    className="h-full gap-1.5 px-2.5 text-xs font-semibold data-active:bg-surface-2 data-active:shadow-xs data-active:ring-1 data-active:ring-border dark:data-active:bg-foreground/15 [&_svg:not([class*='size-'])]:size-3.5"
                  >
                    <PencilIcon aria-hidden />
                    Write
                    {isDirty && !isCompose ? (
                      <>
                        <span
                          aria-hidden
                          className="size-1.5 rounded-full bg-condition-attention"
                        />
                        <span className="sr-only">, unsaved changes</span>
                      </>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              ) : null}
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

          <div className="-mx-1 min-h-0 overflow-y-auto overscroll-contain px-1">
            <TabsContent value="read" className="min-h-85 py-1 text-base">
              {body.trim() ? (
                <Markdown
                  className="text-base leading-relaxed"
                  onToggleTask={
                    canWrite && !isPending ? handleToggleTask : undefined
                  }
                >
                  {body}
                </Markdown>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nothing to read yet. Switch to Write to start.
                </p>
              )}
            </TabsContent>
            <TabsContent value="write" className="min-h-85">
              <Textarea
                ref={textareaRef}
                variant="inline"
                aria-label="Note body"
                value={body}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="What's on your mind?"
                autoFocus={isCompose}
                disabled={isPending}
                className="field-sizing-content min-h-85 py-1 text-base leading-relaxed caret-ring disabled:opacity-100"
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    void handleSubmit();
                  } else markdownTextarea.onKeyDown(event);
                }}
              />
            </TabsContent>
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
                {note && onToggleDone ? (
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
                    {note.state === "done" ? <Undo2Icon /> : <CheckIcon />}
                    {note.state === "done" ? "Reopen" : "Mark done"}
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
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
