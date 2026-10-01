# Later starts folded; dated columns group by when

**Status:** Accepted
**Date:** 2026-10-01

Two complaints about the **Dashboard** from ADR 0017. **Later** took a full column for things that are already scheduled and need no attention today. And **This week** was hard to read: its cards were sorted soonest-first, but nothing marked where one day ended and the next began, so an item due tomorrow and one due in five days looked alike until you read each card's small date token and worked out the weekday.

## Decision

**Later starts folded at every size.** At `xl` it is a narrow rail between **This week** and the **No date** tray, which keeps the columns in time order. The rail's heading sits on the lanes' rule — `Later 8 ›` — with when the soonest item arrives under it (`next 11d`, in the accent), and below that a **horizon**: a scale from a week out to the end of the month nine weeks out, banded like the open column's groups (`1w`, `2w`, `3w`, then months). Each item is a short mark at its day: solid for a **Thread**, outlined for a **Note**, the soonest in the accent, and items due the same day side by side. Hovering a mark names it and its date. Items past the scale's end are counted at its foot (`+1 later`). Below `xl` Later is one ruled heading spanning the row, with the count and the `next` token and no horizon. Activating either unfolds it into a full column; its heading folds it again. While folded, **This week** takes the width Later gives up. The fold is held for the visit: it survives opening and closing a **Thread** or **Note**, and every fresh load starts folded. When a date change sends a card into a folded Later, its count pops, so the card does not seem to vanish.

The horizon is how a folded Later earns its height. Calendars left the **Dashboard** (ADR 0014) because the board is for reading rather than rearranging, and because a calendar spends its space evenly on time, so long quiet stretches became empty space that needed collapsing machinery of its own. A horizon ribbon was turned down for a different reason: the idea was good, but nothing on the board gave it a natural place. The folded Later is that place. It shows only what is already scheduled past this week, it is read-only, it lives where an empty strip stood, and it hands off to the full column for anything more than a glance.

**Every dated column groups its cards by when they come due**, and the grain widens with distance:

- **Now**: `Late`, then `Today`.
- **This week**: one heading per day that has something due: `Tomorrow · Friday`, then `Sunday · 3d`, `Wednesday · 6d`. Days with nothing due get no heading, since the distance already shows the gap.
- **Later**: `In 1 week`, `In 2 weeks`, `In 3 weeks`, each with its span (`Oct 8–14`), then calendar months (`November`, or `January 2027` across a year).

A group heading reads like a lane heading and a **No date** run heading: label, count, then a quiet hint flush right. Nearer headings read louder, and `Late` takes the late colour. At `xl` the headings stay pinned as their column scrolls.

Where a heading names a single day (`Today` and each day of **This week**), its cards drop their date token: the heading already says exactly when. The date stays one click away as a calendar control, revealed on hover or keyboard focus, as it already is on undated cards. Under `Late` and Later's week and month groups, a card keeps its token, because the heading only gives the range.

## Considered Options

- **Later as a header button that opens a separate panel**: takes Later off the time axis, so you have to go and look for it. ADR 0017 round 4 already rejected time somewhere you consult rather than somewhere you are.
- **A bordered rail with only the count and next date** (the first build): a full-height box with five short lines at its top read as a column that failed to load, and its border matched neither the ruled lanes nor the filled tray.
- **A spine**, the column turned on its side as Linear and Trello collapse one: still a full-height strip with nothing to show, and rotated text reads slower.
- **Later as the last line of This week, or as a heading over the No date tray**: the quietest forms and the least to build, but one line is easy to overlook, and over the tray it sits on unscheduled work. Both throw away the shape of what is coming.
- **A six-day strip with dots above This week**: a miniature calendar over the part of the board you read card by card.
- **Relative tokens (`+1d`, `+5d`) and no groups**: cheaper, but you still read the week one card at a time instead of seeing its shape.
- **Splitting This week into Tomorrow and the rest**: an arbitrary cut that adds a column when the aim is fewer.

## Consequences

- Amends ADR 0017 and `CONTEXT.md`'s "Nothing is capped or hidden." A folded Later hides its cards but not that they exist: every item still has exactly one place, the rail always states the count and the next date, and each item walks into **This week** on its own once it is six days out. Folding is never a filter.
- Amends ADR 0017's "Dates are tokens" consequence: under a heading that names one day, the heading carries the date and the card does not.
- Revisits ADR 0014's rejected horizon ribbon and admits it in one place only: the folded Later rail. ADR 0014's thesis stands; nothing on the horizon can be dragged or edited, and no other surface grows a timeline.
- The phone-only fold of Later from ADR 0017 becomes the rule at every size. The **No date** tray still folds only on a phone.
- Below `xl`, Later and the **No date** tray each span the row, so a folded Later never leaves a hole beside the tray.
