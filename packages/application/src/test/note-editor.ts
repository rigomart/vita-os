import { EditorView } from "@codemirror/view";
import { act, screen } from "@testing-library/react";

/**
 * Drives the Note view's editor. It is CodeMirror, which reads keystrokes from
 * DOM mutations jsdom does not produce, so tests dispatch what a keystroke would.
 */

/** The editor loads on its own, so it appears a moment after the view. */
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
