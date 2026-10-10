# The Note view edits Markdown in live preview

**Status:** Accepted. Amends [ADR 0024](./0024-note-view-and-markdown-bodies.md) and [ADR 0025](./0025-note-view-read-write-and-undoable-delete.md).
**Date:** 2026-10-10

The **Note view** had a Read/Write switch over one draft (ADR 0025). Fixing a typo or adding a line meant choosing Write, editing raw Markdown, and switching back to Read to see the result. Both earlier ADRs deferred a live formatted editor until raw Markdown got in the way. The switch is that friction.

## Decision

The view has one editing surface and no Read/Write switch. It is CodeMirror with the live-preview extensions from `@atomic-editor/editor`, the setup Notas uses. Formatting renders as you type, and Markdown syntax shows only on the line with the caret. The body stays plain Markdown, so storage and card previews do not change.

- A saved **Note** opens without a caret, so every line is rendered. Clicking or tapping a line places the caret there and reveals its syntax. A new Note opens with the caret in the body.
- Saving stays explicit. Edits make a draft; the footer shows `Unsaved changes` and Save, and Command/Control+Enter also saves. After saving, the caret stays where it was. The discard question from ADR 0025 is unchanged.
- Ticking a task checkbox on a saved Note with no unsaved edits saves straight away and quietly, as before. On a draft it edits the draft.
- Enter continues lists and task items. Tab and Shift+Tab nest list items. Anywhere else, Tab leaves the editor. Command/Control+B and +I wrap the selection in bold and italic markers.
- Links render as links, with an icon that opens them in a new tab while editing. Only http, https and mailto links open. Images are not loaded and tables render in place.
- The editor follows the app's color and type tokens in both themes. CodeMirror loads as its own chunk (about 113 KB gzipped). The download starts when the Note view's module loads, not when the view first opens.

Card previews keep the `Markdown` renderer. Its checkboxes only draw a box now, since the view no longer uses them as controls.

## Considered Options

- **Keep Read/Write and add a split view**: still a mode to choose, and it halves the width of a 672px dialog.
- **Autosave like Notas**: removes Save, but every keystroke becomes a network write and an optimistic update in an app with shared cache state. Explicit Save keeps one write per edit and keeps the discard question meaningful.
- **A rich-text editor such as Tiptap**: stores a document model, not Markdown, so bodies would need converting both ways.

## Consequences

- Amends ADR 0025: there is no Read/Write switch and no unsaved dot on a Write tab, and Save no longer returns to Read. Amends ADR 0024's renderer choice for the view: the view now renders through the editor, not `react-markdown`.
- The editor and the card previews can draw the same Markdown slightly differently. For example, a ticked item is struck through in the editor and not on a card.
- Rendered links and checkboxes in the editor are not native `<a>` elements, and the checkboxes have no accessible names. A screen reader hears the line's text and an unlabeled checkbox.
- Tests drive the editor by dispatching CodeMirror transactions (`packages/application/src/test/note-editor.ts`), because jsdom produces no DOM input for CodeMirror to read.
