# Later starts folded; dated columns group by when

**Status:** Accepted
**Date:** 2026-10-01

Two complaints about the **Dashboard** from ADR 0017. **Later** took a full column for things that are already scheduled and need no attention today. And **This week** was hard to read: its cards were sorted soonest-first, but nothing marked where one day ended and the next began, so an item due tomorrow and one due in five days looked alike until you read each card's small date token and worked out the weekday.

## Decision

**Later starts folded at every size.** At `xl` it is a narrow rail between **This week** and the **No date** tray, which keeps the columns in time order: its name, how many items wait there, and when the soonest one arrives (`next 11d`). Below `xl` it is one ruled heading spanning the row, with the same count and `next` token. Activating either unfolds it into a full column; its heading folds it again. While folded, **This week** takes the width Later gives up. The fold is held for the visit: it survives opening and closing a **Thread** or **Note**, and every fresh load starts folded. When a date change sends a card into a folded Later, its count pops, so the card does not seem to vanish.

**Every dated column groups its cards by when they come due**, and the grain widens with distance:

- **Now**: `Late`, then `Today`.
- **This week**: one heading per day that has something due: `Tomorrow · Friday`, then `Sunday · 3d`, `Wednesday · 6d`. Days with nothing due get no heading, since the distance already shows the gap.
- **Later**: `In 1 week`, `In 2 weeks`, `In 3 weeks`, each with its span (`Oct 8–14`), then calendar months (`November`, or `January 2027` across a year).

A group heading reads like a lane heading and a **No date** run heading: label, count, then a quiet hint flush right. Nearer headings read louder, and `Late` takes the late colour. At `xl` the headings stay pinned as their column scrolls.

Where a heading names a single day (`Today` and each day of **This week**), its cards drop their date token: the heading already says exactly when. The date stays one click away as a calendar control, revealed on hover or keyboard focus, as it already is on undated cards. Under `Late` and Later's week and month groups, a card keeps its token, because the heading only gives the range.

## Considered Options

- **Later as a header button that opens a separate panel**: takes Later off the time axis, so you have to go and look for it. ADR 0017 round 4 already rejected time somewhere you consult rather than somewhere you are.
- **Later folded into the foot of This week**: puts two grains of time in one column.
- **A six-day strip with dots above This week**: a miniature calendar. ADR 0014 rejected a horizon ribbon for the same reason.
- **Relative tokens (`+1d`, `+5d`) and no groups**: cheaper, but you still read the week one card at a time instead of seeing its shape.
- **Splitting This week into Tomorrow and the rest**: an arbitrary cut that adds a column when the aim is fewer.

## Consequences

- Amends ADR 0017 and `CONTEXT.md`'s "Nothing is capped or hidden." A folded Later hides its cards but not that they exist: every item still has exactly one place, the rail always states the count and the next date, and each item walks into **This week** on its own once it is six days out. Folding is never a filter.
- Amends ADR 0017's "Dates are tokens" consequence: under a heading that names one day, the heading carries the date and the card does not.
- The phone-only fold of Later from ADR 0017 becomes the rule at every size. The **No date** tray still folds only on a phone.
- Below `xl`, Later and the **No date** tray each span the row, so a folded Later never leaves a hole beside the tray.
