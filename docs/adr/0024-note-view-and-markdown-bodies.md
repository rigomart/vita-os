# Notes open in a Note view; bodies are Markdown

Status: Amended by ADR 0025 — the view has Read and Write modes over one draft, the discard question sits in the footer, Delete offers Undo instead of asking, and task checkboxes can be ticked in Read.

A consultation write-up can contain medication changes, tests, and next steps. Such a Note needs room and structure, while its saved card needs to remain small enough to scan beside other Notes.

## Decision

Keep one **Note** model. Its body remains a string and now contains Markdown. No storage migration is needed. Preserve single line breaks so existing multiline Notes remain readable. Support headings, bulleted and numbered lists, emphasis, code, links, quotes, dividers, and GFM tables. Raw HTML is skipped; live links allow only HTTP, HTTPS, and mailto and open in a separate tab. Checkbox markers remain literal `[ ]` or `[x]` text; interactive checkboxes are deferred.

Grow the New note dialog into the **Note view**, shared by Thread and standalone Notes. It has compose, read, and edit modes. Reading renders the full document; editing uses a Markdown textarea with list continuation, list indentation, and bold/italic shortcuts. Save or Add also accepts Command/Control+Enter. Escape or Cancel from edit returns to read mode. Dismissing a changed draft requires a discard confirmation.

The desktop dialog is wider and scrolls its body while keeping the header and actions visible. On a phone it is a drawer, including when opened above the Notes drawer. Thread Notes identify their parent Thread and have no Attention Date, preserving ADR 0016. Standalone Notes keep their Attention Date.

Saved cards are read-only previews that open the Note view. Thread and Notes-panel cards show a bounded Markdown preview; Dashboard cards show a two-line plain-text preview. Preview links are inert. Done remains a quick card action, and Delete moves into the view with its existing confirmation. The open view survives its card moving between lists or leaving the Dashboard.

## Amendments

This amends ADR 0015's wrapped, editable Note rows: saved bodies are now read-only previews, with editing in the Note view. It also amends the Dashboard opening behavior in CONTEXT.md: opening a Note opens the Note view above the current page. Opening the global Notes collection still uses ADR 0012's panel/drawer.

## Alternatives

- A separate **Document** type would add classification and another model for the same capture. A Note can already hold a document.
- A live formatted editor such as Tiptap would hide Markdown syntax but add editor state and complexity. It remains a possible later upgrade if raw Markdown gets in the way.
- Keeping in-place editing would preserve quick edits but keep long documents constrained to small cards and duplicate editing behavior across surfaces.

## Verification

Renderer tests cover preserved line breaks, inert previews, literal checkbox text, tables, and safe links/HTML. Note-view and surface tests cover modes, discard protection, asynchronous errors, quick actions, and card movement. The verification feature map documents real desktop, Thread drawer, and nested phone drawer paths with the consultation example.
