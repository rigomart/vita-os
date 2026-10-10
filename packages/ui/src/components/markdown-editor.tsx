import {
  atomicEditorTheme,
  atomicMarkdownSyntax,
  autoCloseCodeFence,
  extendEmphasisPair,
  inlinePreview,
  readOnlyExtension,
  startAsteriskList,
  tables,
} from "@atomic-editor/editor";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from "@codemirror/commands";
import {
  markdownKeymap,
  markdownLanguage,
  pasteURLAsLink,
} from "@codemirror/lang-markdown";
import {
  Annotation,
  Compartment,
  EditorSelection,
  EditorState,
  Prec,
  Transaction,
} from "@codemirror/state";
import {
  type Command,
  EditorView,
  keymap,
  placeholder as placeholderText,
} from "@codemirror/view";
import { type CSSProperties, useEffect, useEffectEvent, useRef } from "react";

import { cn } from "../lib/utils";
import { safeLink } from "./markdown";

/** Why the text changed: typing, or ticking a rendered task checkbox. */
export type MarkdownChangeCause = "edit" | "task";

/** Marks a change that came from `value`, so it is not reported back. */
const fromValue = Annotation.define<boolean>();

const taskMarker = /^\[[ xX]\]$/;

// The checkbox widget swaps `[ ]` and `[x]` without a user event; typing always has one.
function isTaskToggle(transaction: Transaction) {
  if (transaction.annotation(Transaction.userEvent) !== undefined) return false;
  const changes: boolean[] = [];
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changes.push(
      taskMarker.test(transaction.startState.sliceDoc(fromA, toA)) &&
        taskMarker.test(inserted.toString()),
    );
  });
  return changes.length === 1 && changes[0] === true;
}

function wrapSelection(marker: string): Command {
  return (view) => {
    view.dispatch(
      view.state.changeByRange((range) => ({
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(
          range.anchor + marker.length,
          range.head + marker.length,
        ),
      })),
      { userEvent: "input.format" },
    );
    return true;
  };
}

const listItem = /^\s*(?:[-*+]|\d+[.)])\s/;

// Tab nests a list item; anywhere else it leaves the editor, like a field.
function onListItem(command: Command): Command {
  return (view) => {
    const { state } = view;
    const onList = state.selection.ranges.every((range) =>
      listItem.test(state.doc.lineAt(range.head).text),
    );
    return onList && command(view);
  };
}

function openLink(url: string) {
  const href = safeLink(url);
  if (href) window.open(href, "_blank", "noopener,noreferrer");
}

// The editor's palette and type follow the app's tokens in both themes.
const tokens = {
  "--atomic-editor-font": "var(--font-sans)",
  "--atomic-editor-font-mono": "ui-monospace, monospace",
  "--atomic-editor-body-size": "1rem",
  "--atomic-editor-body-leading": "1.625",
  "--atomic-editor-measure": "none",
  "--atomic-editor-radius": "0.375rem",
  "--atomic-editor-bg": "transparent",
  "--atomic-editor-bg-panel": "var(--popover)",
  "--atomic-editor-bg-surface": "var(--muted)",
  "--atomic-editor-border": "var(--border)",
  "--atomic-editor-fg": "var(--foreground)",
  "--atomic-editor-fg-muted": "var(--muted-foreground)",
  "--atomic-editor-fg-faint": "var(--muted-foreground)",
  // Ticked boxes draw a white check on the accent, so it must be dark enough.
  "--atomic-editor-accent": "var(--brand-accent-strong)",
  "--atomic-editor-accent-bright": "var(--brand-accent-strong)",
  "--atomic-editor-accent-soft": "var(--border)",
  "--atomic-editor-link": "var(--primary)",
  "--atomic-editor-link-hover": "var(--primary)",
  "--atomic-editor-code-bg": "var(--muted)",
  "--atomic-editor-code-rail": "var(--border)",
  "--atomic-editor-selection-bg":
    "color-mix(in oklab, var(--brand-accent) 28%, transparent)",
} as CSSProperties;

// Grows with its text inside the view's own scroll area, flush with its edges.
const layout = Prec.high(
  EditorView.theme({
    "&": { height: "auto" },
    "&.cm-editor .cm-content": {
      padding: "0",
      caretColor: "var(--ring)",
    },
    ".cm-cursor": { borderLeftColor: "var(--ring)" },
    ".cm-placeholder": { color: "var(--muted-foreground)" },
  }),
);

function lock(readOnly: boolean, disabled: boolean) {
  return [
    readOnlyExtension(readOnly),
    EditorState.changeFilter.of(() => !readOnly && !disabled),
  ];
}

/**
 * Markdown with live preview: formatting renders as you type and the syntax
 * shows only where the caret is, so the text stays plain Markdown. Lists
 * continue on Enter and task checkboxes tick on click.
 */
export function MarkdownEditor({
  value,
  onChange,
  onSubmit,
  readOnly = false,
  disabled = false,
  autoFocus = false,
  placeholder,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string, cause: MarkdownChangeCause) => void;
  /** Command/Control+Enter. */
  onSubmit?: () => void;
  /** A reading surface: every line stays rendered and nothing can change. */
  readOnly?: boolean;
  /** Ignores changes while it keeps the caret and the current rendering. */
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label": string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const locks = useRef(new Compartment());
  const change = useEffectEvent(onChange);
  const submit = useEffectEvent(() => {
    onSubmit?.();
    return onSubmit !== undefined;
  });

  useEffect(() => {
    const view = new EditorView({
      parent: rootRef.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          Prec.highest(
            keymap.of([
              {
                key: "Mod-Enter",
                run: () => submit(),
              },
              { key: "Mod-b", run: wrapSelection("**") },
              { key: "Mod-i", run: wrapSelection("_") },
              { key: "Tab", run: onListItem(indentMore) },
              { key: "Shift-Tab", run: onListItem(indentLess) },
            ]),
          ),
          history(),
          EditorView.lineWrapping,
          // The bare GFM language: `markdown()` would also bundle HTML, JS, and CSS parsers.
          markdownLanguage,
          pasteURLAsLink,
          atomicMarkdownSyntax,
          atomicEditorTheme,
          layout,
          inlinePreview({ onLinkClick: openLink }),
          tables({ onLinkClick: openLink }),
          startAsteriskList,
          extendEmphasisPair,
          autoCloseCodeFence,
          keymap.of([...historyKeymap, ...markdownKeymap, ...defaultKeymap]),
          placeholder ? placeholderText(placeholder) : [],
          EditorView.contentAttributes.of({
            "aria-label": ariaLabel,
            spellcheck: "true",
          }),
          locks.current.of(lock(readOnly, disabled)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            if (update.transactions.some((tr) => tr.annotation(fromValue))) {
              return;
            }
            change(
              update.state.doc.toString(),
              update.transactions.every(isTaskToggle) ? "task" : "edit",
            );
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (autoFocus) {
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.focus();
    }
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The view is created once; the effects below follow later props.
  }, []);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: locks.current.reconfigure(lock(readOnly, disabled)),
    });
  }, [readOnly, disabled]);

  // A saved body or a rolled-back tick can replace the text. Change only the
  // part that differs, so the caret keeps its place in the rest.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    let start = 0;
    while (start < current.length && current[start] === value[start]) start++;
    let end = 0;
    while (
      end < current.length - start &&
      end < value.length - start &&
      current[current.length - 1 - end] === value[value.length - 1 - end]
    ) {
      end++;
    }
    view.dispatch({
      changes: {
        from: start,
        to: current.length - end,
        insert: value.slice(start, value.length - end),
      },
      annotations: [fromValue.of(true), Transaction.addToHistory.of(false)],
      filter: false,
    });
  }, [value]);

  return (
    <div
      ref={rootRef}
      style={tokens}
      className={cn("atomic-cm-editor min-w-0", className)}
    />
  );
}
