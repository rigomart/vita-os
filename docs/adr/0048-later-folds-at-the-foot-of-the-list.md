# Later folds at the foot of the list

**Status:** Accepted. Amends [ADR 0037](./0037-one-list-under-the-sky.md) ("Later's horizon and fold are gone") and [ADR 0045](./0045-the-list-graded-by-attention.md) (the weeks and months on the list at rest).
**Date:** 2026-10-21

The Dashboard's list opens everything, from Late out to the months. ADR 0037 dropped ADR 0026's folded Later on the grounds that one-line rows kept the far groups short, and ADR 0045 made them small and faint. They still had to be scrolled past, every visit, to reach nothing that asks for anything yet: what is two weeks out is known about, not read.

## Decision

**From a week out on, the list folds into one Later line at its foot.** Late, Today and the six days after them read as they ship. Every item a week or more away, the weeks and months, is behind one ruled line: `Later`, how many it holds, `next` and the token for when the soonest comes due, then the first two by name ("Insurance, Renew the passport and 8 more"), named by what they are about, a **Thread**'s title or a **Note**'s first line. The line is one button: opening it shows the weeks and months under it as they ship, and its heading folds them again.

The cut is the list's own seam: day headings stop at six days out (ADR 0026), and `In 1 week` starts the far groups. An item walks out of Later and under its weekday on its own once it is six days out, so nothing in Later is close enough to need attention.

**The fold is held for the visit.** It stays as set while the Dashboard is open, through opening a **Thread** or a **Note**, changing the filter, and the board's writes, and every load starts folded.

**Nothing vanishes silently.** When a date sends an item into a folded Later, its count pops. The Later line is a stop for the keyboard cursor: `↓`/`j` reach it after the last day, and Enter opens it. With nothing a week or more away there is no Later line; with nothing nearer, the list says "Nothing this week." over it.

## Considered Options

The decision came out of a prototype in the design lab on the Busy and Several dated Tasks scenarios. The prototype was removed when this shipped; every variant is commit `69ba4c8` in the pull request that added this ADR (`git log` on this file finds it).

- **Later folds**: chosen. The smallest change that takes the far end off the first read, at the seam the list already has.
- **Far groups fold**: every week and month keeps its heading and folds its lines into a line of names. It keeps the shape of the coming months, but a far group of one or two items takes the same room folded, so it saves little.
- **Today first**: only Late, Today and Tomorrow open, the rest of the week as one fold and Later as another. It shortened Busy the most, from about 2,200px to 1,400px, but hides the week, which is what the list is for after today.
- **A "This week / Everything" switch over the list**: a tab that switches views, against Principle 8.
- **A cap with Show all** (issue #235): hides whichever items fall past the count, which ranks them without the person asking.
- **ADR 0026's horizon on the folded line**: rejected by ADR 0037 and not revived; the line names items instead of drawing them.

## Consequences

- On a busy board most of the height is Late and the coming week, not the far groups, so the fold shortens it less than it calms it. If the week still reads too long in use, Today first is the measured next step.
- A date set on a deadline rather than on when to start is in Later until six days before. The Later line names the next item and the count, but the fold makes that habit costlier than it was.
- "Nothing is capped" stands with the No date fold's rule: a fold hides lines, never that they exist.
- The fold's state lives on the Dashboard page, so a reload folds Later again.
- `CONTEXT.md` names **Later** for the fold, moves it out of "Former and rejected terms", and describes the list as open out to the end of the coming week.
