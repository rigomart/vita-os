import { EditorView } from "@codemirror/view";
import { act, screen } from "@testing-library/react";
// The Note view loads the editor lazily. Loading it with the test file keeps a
// cold import on a slow machine from running out a test's wait for the editor.
import "@vita-os/ui/components/markdown-editor";

/**
 * Drives the Note view's editor. It is CodeMirror, which reads keystrokes from
 * DOM mutations jsdom does not produce, so tests dispatch what a keystroke would.
 */

/** The editor mounts through Suspense, so it appears just after the view. */
export const findNoteEditor = () =>
  screen.findByRole("textbox", { name: "Note body" });

const viewOf = (editor: HTMLElement) => EditorView.findFromDOM(editor)!;

export const noteText = (editor: HTMLElement) =>
  viewOf(editor).state.doc.toString();

export function focusNote(editor: HTMLElement) {
  act(() => viewOf(editor).focus());
}

/** Types at the end of the text, the way the editor records a keystroke. */
export function typeInNote(editor: HTMLElement, text: string) {
  const view = viewOf(editor);
  const end = view.state.doc.length;
  act(() =>
    view.dispatch({
      changes: { from: end, insert: text },
      selection: { anchor: end + text.length },
      userEvent: "input.type",
    }),
  );
}

export function replaceNoteText(editor: HTMLElement, text: string) {
  const view = viewOf(editor);
  act(() =>
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: text },
      selection: { anchor: text.length },
      userEvent: "input.type",
    }),
  );
}
