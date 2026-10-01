# Note view reads and writes one draft; Delete offers Undo

**Status:** Accepted
**Date:** 2026-09-30

The **Note view** from ADR 0024 had three modes and two stacked confirmations. A saved **Note** opened in read mode with an Edit button; composing had no way to see the rendered Markdown; read mode shrank to its content, so a one-line **Note** opened as a strip; and both "Discard changes?" and "Delete note?" opened a second modal, with a second scrim, over the view.

## Decision

The view has two modes, **Read** and **Write**, chosen by a segmented switch in the header. A saved **Note** opens on Read and a new one on Write. Both modes show the same draft: switching to Read renders unsaved text instead of discarding it, so Read is also the preview while composing. Write shows a dot while a saved **Note** has unsaved changes, and Save sits in the footer in either mode. Escape closes the view; only a changed draft asks first.

Both modes keep a 340px floor, so switching never resizes the view and a short **Note** still opens as a document. Delete and Copy Markdown live in a ⋯ menu. Done is a "Mark done" pill beside the Attention Date, matching the board card. The added and edited dates sit in the footer while nothing is unsaved.

The discard question replaces the footer inside the view ("Discard unsaved changes?" · Keep editing · Discard). Focus moves to Keep editing, and Escape answers Keep editing. No second modal opens.

Delete happens at once, closes the view, and shows "Note deleted" with Undo for five seconds. The delete command shows its optimistic removal immediately but holds the service call until the Undo offer lapses. Undo rejects the held command, so the cache rolls back and the **Note** returns with its id, dates and Attention Date intact. Thread and standalone **Notes** behave the same.

Task list items render as checkboxes. In Read they can be ticked: on a saved **Note** with no unsaved edits the change saves straight away, quietly; on a draft it edits the draft. Previews on cards draw the boxes without making them controls.

## Considered Options

- **Keep read/edit/compose with a separate preview toggle in compose**: fixes compose but keeps two ways to leave edit mode, one of which discards.
- **Split view**: an editor beside a live preview. Useful on wide screens but halves the writing width in the 672px dialog; it can be added later as a third option of the same switch.
- **A live formatted editor**: hides Markdown syntax as you type. Still deferred for the reasons in ADR 0024.
- **A confirmation sheet inside the view for Delete**: avoids the stacked modal but still asks before a reversible action.

## Consequences

- Amends ADR 0024: Escape no longer returns from edit to read, there is no Cancel, Delete no longer asks first, and checkbox markers are no longer literal text.
- A delete is lost if the page closes during the five-second Undo window: the **Note** survives. This errs toward keeping data.
- `Feedback` gains `undoable(message)`, which resolves `true` when the offer lapses. A command that should wait for it takes an `undoWindow` and throws `CommandUndone` when it is taken.
- Menus and popovers set `pointer-events: auto` on their positioner, as the alert dialog already did, so they stay usable inside a Radix drawer on a phone.
