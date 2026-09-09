# Dashboard time columns with an unscheduled margin

The **Dashboard** lays every **Open Thread** and every open **Standalone Note** on one axis of time: three full-height columns — **Now** (late or due today), **This week** (the next six days), **Later** — beside a margin holding everything unscheduled, in three labelled runs: **Ready to move**, **Open**, **Notes**. A single row above carries the date, the **Area Conditions** as status, and four counts. Each column scrolls itself.

This supersedes ADR 0014's flat global run. That decision rejected temporal bands on the grounds that time would own the first reading and undated Threads would become a remainder bucket; both risks were tested directly in prototype (issue #314) and neither survived contact. Time owning the *layout* does not make it the loudest signal when Now is the widest, warmest column and the counts sit above it. Undated Threads are not a remainder because the margin is not a leftovers bin: its first run is **Ready to move**, the things a person can do today, given its own heading rather than being sorted to the bottom of a list.

The flat run's real failure was density. One column of rows could not use a desktop viewport, so the page compressed into its top half; and the row itself — date rail, title, detail, quiet age, Area name — read as a ledger. Columns spend the width on more of the board rather than on more per row.

## Considered Options

Prototyped in order on the `worktree-prototype-314-dashboard` branch, each round narrowing the next:

- **Whole-page layouts** (round 1) — now/ahead split, temporal bands, horizon ribbon, Area lanes. All rejected: the row, not the page, was the problem.
- **Row treatments** (round 2) — quiet lines, sentences, cards, hover-to-reveal. Rejected as a class: they answered density by removing information and left the desktop empty. Only the one-line, title-led row survived as an instinct.
- **Dense variants** (round 3) — wrapped run, tile board, Area × time matrix. The matrix made time legible but left empty cells; the board had no time axis at all.
- **Where time lives** (round 4) — time as layout, as a chart over an attention board, or as a chronological spine beside cards. **Time as layout won**: the other two put the calendar somewhere you had to consult rather than somewhere you already were.
- **Notes in the same columns as Threads, drawn as Thread cards** — rejected in round 8. A Note is a thing you wrote, not a line item with a state in front, and the board was the only surface breaking that rule.
- **A fourth "No date" column** — rejected in round 9 after review: as a peer panel it read as the step after *Later*. The same content as a ruled margin outside the column group is the chosen form.

## Consequences

- **ADR 0005's ordering question (#236) is answered: a date outranks an undated Next Move.** A Thread with a Next Move and no **Follow-up** does not appear in **Now**; it leads the unscheduled margin under **Ready to move**. The flat run's "dated upcoming Follow-ups before undated Threads with Next Moves" rule is retired along with the run itself.
- **Follow-up is no longer read-only on the Dashboard.** ADR 0014's read-only stance is reversed: a card carries a rail — complete the **Next Move**, set or change the **Follow-up** — that appears on hover or keyboard focus, and a **Standalone Note** carries the same for its **Attention Date** plus done. A board that states what needs attention but cannot clear it is always slightly wrong, because every correction happens elsewhere.
- **The Next Move leads the card**; the **Thread** title sits under it. Where there is no move the title leads and there is no second line, because the **Area** name in that slot reads as a title. The Area is a Condition-coloured glyph, never a word.
- **Dates are tokens, never sentences** — `−6d`, `Today`, `Tue`, `12d`, `Mar 4` — since the column already says roughly when.
- **Standalone Notes appear on the board in the Note grammar** shared with `NoteCard` and `ThreadNoteCard`, and a dated Note sits in the column its **Attention Date** earns, beside Threads. The Notes synopsis of ADR 0014 is retired. **Thread Notes** never appear here.
- **The Area Condition strip becomes status rather than a reason list.** Each Area is its icon in its Condition colour, its name, and its share of the board; healthy Areas go grey. The per-Area reason text is dropped — every card already says what to do. Activating an Area still opens the **Area Quick Panel** (ADR 0013), unchanged.
- **Quiet age is dropped from the Dashboard.** ADR 0014's `quiet Nd` annotation does not survive the density budget. Nothing replaces it; "Stale Thread" still does not enter the domain model.
- **Summary and last-activity text leave the Dashboard.** They remain in **Thread** detail and in the **Area** inventory.
- The **Area** inventory's attention lanes (ADR 0009) are untouched; only the Dashboard changes.
- The prototype that produced this decision is preserved on the `worktree-prototype-314-dashboard` branch, out of `main`.
