# The Dashboard as one list under the sky

**Status:** Accepted. Supersedes [ADR 0017](./0017-dashboard-time-columns.md) and [ADR 0018](./0018-floating-chrome.md). Amends [ADR 0006](./0006-palette-first-navigation.md), [ADR 0014](./0014-attention-first-dashboard.md), [ADR 0021](./0021-areas-as-optional-labels.md), [ADR 0026](./0026-folded-later-and-dated-groups.md) and [ADR 0031](./0031-notes-on-the-dashboard-and-history.md). Amended by [ADR 0038](./0038-board-cards-as-sheets.md): every card is a sheet on its group's fill, two cards in a row end together, and a Standalone Note's sheet is dog-eared.
**Date:** 2026-10-09

The **Dashboard** of ADR 0017 laid dated items in three side-by-side columns (**Now**, **This week**, **Later**) beside a margin for everything undated, under chrome that floated in three clusters and a dock (ADR 0018). It used a desktop's width well, but it read across rather than down: Today and the days after it sat in different columns, and Later hid behind a fold with a horizon of its own (ADR 0026). On a phone the columns stacked into one long page with the margin and Later folded away. The chrome floated over the board at every size and carried little beyond the date and the actions.

## Decision

**The Dashboard is one list, attention first.** Every dated item is in one column, grouped by when it comes due, with the grain widening with distance: Late, Today, Tomorrow, each day of the coming week, then weeks, then months. The placement rules are unchanged; the model still sorts items into its Now, This week and Later buckets, and the list reads them in that order.

**Each group is a file tab.** Its heading sits on a tab joined to a filled body, with an inverted corner where they meet. Nearer groups read louder: Today sits on the strongest fill, the next three days on a lighter one, the rest lighter still, and Late on a warm fill, the attention colour faintly over the page. Headings step down in size and weight with distance, and Late's heading takes the attention colour. Groups stand 16px apart, so the shape of the coming days reads before any card does. A late card drops its own tint on Late's fill, since the fill already says it.

**Cards sit two to a row** once the list is 42rem wide, so a wide screen still shows a lot. From next week on an item is a single line: a dot (solid for a **Thread**, outlined for a **Note**), its title or a Note's first line, and its date. The whole line opens it.

**No date keeps its three runs** (Ready to move, Open, Notes) and its cards. From `lg` it is an aside beside the list, pinned to the top as the page scrolls and scrolling on its own. Below `lg` it leads the list, folded to one line that names the first two items "and N more"; tapping it opens the runs in place. With nothing undated it is not shown.

**The filter moves onto the board.** It is one pill group at the top of the list, sticky as the page scrolls: All, each **Area** with its count, No area, then **Notes** set apart, then Edit areas, which opens **Manage areas**. It never wraps or scrolls: options that do not fit fold, in order, into an "N more" menu, which also offers Edit areas. The selected option always stays in view, taking the last place if it would have folded, and Notes always shows. The URL parameters, `1..9` and `0`, and the filter model are unchanged. The phone dropdown is gone, because the folding row works at every width.

**The chrome becomes the sky.** The page's header sits in the page flow and scrolls away. Its background is the sky at the current hour, blended from keyframes and updated by the minute: a pale sun on a low arc from 6:30 to 19:00, a moon and a fixed scatter of stars at night. Dawn and dusk lean rose and mauve rather than amber, and the ink switches between dark and light by the sky's luminance. The header holds the logo and the date. From `lg` it also holds search (opening the palette, with its shortcut), New note (`Q`), New thread and the account menu. Below `lg` the header keeps only the account menu, and the actions move to a floating bar at the bottom: a search field filling the bar, New thread, and a filled Note button, clear of the home indicator.

## Why

The columns answered ADR 0014's density problem by spending the desktop's width on more of the board. They split the reading, though. "What is asking, then what comes next" is one question read downward, and three columns made it three questions read across. A single list puts Today directly over Tomorrow. File tabs and graded fills show distance without a column for it, and the one-line rows keep the far groups short, so Later no longer needs a fold to stay out of the way.

The filter belongs over the thing it filters. In the header it competed for room with search and the actions and sat apart from the list it changed. On the board it has the list's full width and sticks above it.

The sky gives the page one honest piece of orientation, the time of day, in place of chrome that floated over the board without saying anything. It is ambient on purpose. Colour on the board still belongs only to time and lateness (ADR 0021, Principle 5): the sky shows no items and no times, and its warm tones are kept clear of the attention amber. Today's timed items were deliberately kept off it. A timed item orders its day but never becomes an appointment (ADR 0026, ADR 0027), and drawing it on a sky that moves with the clock would turn it into one.

## Considered Options

The decision came out of a prototype in the design lab, over the product's own cards, models and scenarios, in rounds. The prototype was removed once this shipped, so it would not drift from the product it copies; its final round is commit `0c27cbc` in the pull request that added this ADR (`git log` on this file finds it). The earlier rounds were replaced as they were decided and were not kept:

- **Whole-page directions**: *Daylight*, *Approach* and *Runway*. Daylight, the sky as the header over one list, won and the later rounds refined it.
- **Filter in the header vs on the board**: the board won. It has room to show most Areas, and it sits over what it filters.
- **Grouping**: headings, a bracket, a gutter and panels; then fills, bands, file tabs and strips. File tabs won: each day reads as one shape with its heading attached, and the fill's strength can carry distance.
- **No date on a phone**: in a sheet opened from the bar, or folded at the top of the list. Folded won: it is seen on first view, and it costs one line.

## Consequences

- **Overview density is given up.** ADR 0017's main argument was that columns spend a desktop's width on more of the board. A single list shows less at once on a wide screen. Two cards per row at 42rem, one-line rows from next week on, and No date beside the list soften this. They do not remove it: a busy week now scrolls where the columns did not.
- **Later's horizon and fold are gone** (ADR 0026). Weeks and months are short one-line groups instead. ADR 0014's rejected horizon ribbon is rejected again.
- **The floating chrome and dock are gone** (ADR 0018). Palette-first navigation stands (ADR 0006): the palette is still the only way to jump, reached from the header's search on a wide screen and the bar's search field on a phone. The logo still leads home.
- **The filter row of ADR 0021 and ADR 0031** keeps its options, its parameters and its keys. It loses its phone dropdown and its separating rule, and Manage areas is now the Edit areas button after Notes.
- **"Tabs" here are file tabs that group a day.** They switch nothing. Principle 8 ("one board, no tabs") is about tabs that switch views, and it stands.
- **The open Thread pane covers the header's right-hand actions on a wide screen**, as it covers the right of the page (ADR 0023). The palette, `Q` and the pane's own controls still work. This is accepted for now and left for a later change.
- **The header shows the sky of the device's clock** and takes no override. Users who keep the page open see it change through the day, a minute at a time.
- `CONTEXT.md` retires **Now**, **This week**, **Later** and "the margin" as Dashboard terms. The model's buckets keep those names in code.
