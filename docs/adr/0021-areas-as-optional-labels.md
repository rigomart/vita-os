# Areas as optional labels

**Status:** Accepted
**Date:** 2026-09-26

An **Area** stops being an entity with state of its own and becomes an optional label on a **Thread**: a name and an **Area Icon**, nothing more. A Thread has zero or one Area, and capturing a Thread needs only a title. The Area's **Condition** and **Standard** are removed, along with every surface that existed to show or maintain them: the Area page and its attention lanes, the top-bar Area strip, the Area Quick Panel and its shared Area Actions model, the Condition colour role, and the palette's per-Area drill-in pages. Issue #371 is the specification.

In daily use the Threads did the work and the Areas got in the way. Every Thread had to belong to exactly one Area, so capture always asked "which part of life is this?" before the Thread could exist. Condition asked the user to judge a whole life domain on demand; nothing prompted that judgment and nothing derived it, so it was either stale or a chore. The **Dashboard** already took its urgency from **Follow-ups** and **Attention Dates**, not from Condition. Around that judgment sat a lot of navigation and state the user did not use, and it cost maintenance on every change.

This supersedes ADRs 0008 (Condition colour ramp, as a Condition role), 0009 (Area attention lanes), 0011 (top-bar Area strip) and 0013 (Area Quick Panel). It amends ADRs 0003, 0004, 0014 and 0017.

## Considered Options

- **Keep Areas and derive Condition** from their Threads' dates. Rejected: it would restate what the Dashboard columns already say, and it keeps the Area page, lanes and strip alive as a second board.
- **Multiple free-form tags per Thread.** Rejected for now: it needs a join table, multi-select filtering and a tag-management story, and one label already answers "which part of life is this" at a glance. Moving to several labels stays possible if one proves limiting.
- **Remove Areas entirely.** Rejected: the word still does a job. Filtering the board to one part of life is useful, and existing labels are worth keeping.

## Decision

- A **Thread's Area is optional** everywhere: on the model, on Thread detail and on creation. Updating a Thread sets, changes or clears it with the usual clearable-field convention (`areaId: null` clears).
- An **`area_move` Activity Log entry** covers three cases, each with its own wording: `Added to "Home"`, `Moved from "Health" to "Home"`, `Removed from "Health"`. The entry type does not change.
- **Creating an Area whose name reads as the same slug** as one of the owner's Areas returns that Area instead of a duplicate. Slugs carry a random suffix, so the match is on the slugified name. This is what makes create-on-type in the picker safe.
- **Deleting an Area always succeeds for its owner.** In one D1 batch it clears the label from every Thread that carries it, open or resolved, and deletes the Area. It writes no Activity Log entries and moves no revisions: the label disappearing is not a change the user made to each Thread.
- **Areas can be reordered** as a whole list (`PUT /v1/areas/order`); the list must name each of the owner's Areas once.
- **One Area picker** serves the new-Thread dialog and the Thread detail header: search, pick, create by typing a new name, and remove when an Area is set.
- **The Dashboard gains a filter row** above the board: `All · each Area with its Open Thread count · No area`, in the user's Area order, with empty Areas kept but muted. The choice lives in the URL as `?area=<slug>` or `?area=none`, survives the in-place Thread pane and Notes surface, and falls back to All for an unknown Area. Any filter hides Standalone Notes. The board components receive already-filtered input; the rules live in one pure model (`dashboard-filter-model`). On a phone the row folds into one dropdown.
- **The Area tag on a Thread card is neutral** — icon and name in the card's muted ink. Colour on the board belongs to time.
- **`1..9` select the matching Area filter and `0` returns to All**, keeping the old jump keys useful. The palette offers "Filter: {Area}", "Clear filter" and "Manage areas".
- **A Manage areas dialog**, opened from the palette and the user menu, renames, re-icons, reorders, deletes and adds Areas. The delete confirmation states how many open Threads will lose the label.
- **Thread links lose the Area segment**: `/threads/$threadSlug`, with the Dashboard underneath the pane. `/$areaSlug/$threadSlug` redirects there, and `/$areaSlug` redirects to `/?area=<slug>`, both as replace navigations. The static `threads` segment wins over any Area slug.

## Consequences

- **D1 migration 0004** drops Condition and Standard from `areas` and makes `threads.area_id` nullable, keeping every Thread's Area. SQLite cannot relax `NOT NULL` in place, so `threads` is rebuilt. D1 enforces foreign keys, and dropping a parent table deletes its rows first, which would cascade through `activity_log_entries` and `thread_notes`. The migration therefore rebuilds both child tables against the new `threads` table before dropping the old one. A migration test applies the schema step by step and checks that Areas, Threads, Activity Log entries and Thread Notes all survive.
- The Convex import tool targets the schema as it stood at the cutover (migrations 0001–0003); later migrations run over imported data.
- The `--condition-*` colour tokens stay in the stylesheet: the attention token still colours lateness on the board. They no longer describe an Area.
- The dock's "New area" action is gone. Areas are created from the picker or from Manage areas.
- ADR 0003's "Condition replaces Health status" consequence and ADR 0004's Area page layout no longer apply. ADR 0014's Area Condition strip and ADR 0017's "Area Conditions as status" row and Condition-coloured glyph are replaced by the filter row and the neutral tag.

## Further Notes

- **What is given up.** The glossary described Vita OS as holding "the inventory of life domains". Without Condition, the app no longer shows a neglected domain that has no Threads. The product becomes a Thread-and-Notes tool with light grouping, which matches how it is actually used. If a part of life needs a periodic look, a Thread with a Follow-up ("Review finances", in two weeks) does that with the mechanism the user already trusts.
- **The No area filter** exists so unlabeled Threads are easy to find. It can be dropped if it proves noisy.
- **Interplay with #366.** #366 renames the Area lane label and changes card lead lines. This decision deletes the Area inventory, so #366 drops its lane work. #366 had reserved ADR 0020, which the API layering decision has since taken; it needs a new number.
