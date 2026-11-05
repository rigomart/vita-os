# How the Activity Log reads

**Status:** Accepted. Amends [ADR 0053](./0053-the-activity-log-tells-the-threads-story.md): a Thread started from a Note no longer has a separate "Started from a note" line, and a Note line reads the Note itself, not its opening words. Settles the design lab round that ADR 0053 left open. Spec: issue #524.
**Date:** 2026-11-04

ADR 0053 gave the **Activity Log** the lines a story needs: Started, Thread Notes, Tasks added and removed, and folded rhythms. It left open how the story reads. Every line had one weight, so a Note read as "Note added: <first line>" beside "Added <task>", and a Thread's beginning, ending and long silences looked like everything else. A design lab round on seven Thread stories (a surgery and rehab, a tax letter, a roof claim, a job change, a check-up twice a year, a pet's daily tablet, and a Thread that only started) settled how it reads.

Nothing stored changes: no migration, no contract change. Every decision here is a reading on the client.

## Decision

The log stays newest first, in pages, under day headings, as its own tab beside Notes. Started still waits for the oldest page.

| Decision | Settled |
| --- | --- |
| Note lines lead | A Thread Note's line is the Note itself, at full weight and size, up to four lines and then cut off, on the Dashboard's dog-eared sheet glyph. Choosing it opens the **Note view**. |
| A completion with a Note | Reads as the Note, with a small "Completed <task>" caption above it. |
| The Note a Thread was started from | Reads as the Note, with the caption "Started the Thread from this note". The Thread's Started line is merged into it, so there is no separate "Started from a note" line. |
| Turning points | Started, Resolved, Reopened and Area changes keep a ringed node and a full-size sentence. A resolution note reads at a Note's size with a left border, under its Resolved line. |
| Every other line | Small and muted: Tasks added and removed, completions without a Note, lines from former names. |
| A deleted Note | Its line reads "Note added, since deleted" and opens nothing. A completion whose Note was deleted reads "Completed <task>, with a note since deleted". A Thread whose starting Note was deleted reads "Started from a note, since deleted", as a turning point. |
| A Note older than its Thread | A Note backfilled by migration `0010` at a creation time before the Thread's reads below Started, with the caption "Written before the Thread started". |
| Quiet | Three weeks or more between two days or stretches of the log reads as a muted italic line, the only italic in the log, with the rail dashed through it: "6 months quiet". An Open Thread quiet that long reads "Quiet for 7 weeks" at the top. A Resolved Thread gets no quiet for the time since it ended. No colour, no warning words. |
| How long quiet reads | Every unit rounds to the nearest whole one: days under 2 weeks, weeks up to 7 (14 to 48 days), months up to 11 (49 to 350 days), then years. |
| Headings | A day or stretch heading shows the year whenever it isn't this year. "Today" follows the app's clock. |
| A folded stretch of completions | Says its rhythm under the line, in words: "Every day around 8:10 PM · none on Mon, Sep 21", "Every week, on Saturdays around 11:30 AM", or "On 9 days" when it has no rhythm. A stretch within one day says none. Choosing the line opens it to its days grouped by month, a day with none drawn dashed among them. |
| "Added N Tasks" | Choosing it opens it to each Task, in the order they were added, each with its time only when they don't all share a minute. |
| Times | Every time sits in one column at the line's right edge, whether a fold is open or closed. |
| Words left out | No streak, no "missed", no count of days with none beyond a plain fact. |

A fold is a button with `aria-expanded`, so it opens from the keyboard. Folding across pages works as ADR 0053 set it: a stretch grows as "Show earlier" loads.

**A rhythm is read from the stretch's days.** The gap between days that comes at least twice and holds at least half the time is its step; with none, the stretch has no rhythm, so two or three days rarely have one. A day the step expected one and none came is a day with none; for a step of about a month, it falls on the same date of the month. One or two are named, more are counted. The usual time is given when every completion falls within an hour of the others.

## Considered Options

- **Notes at the same weight as other lines** (as shipped by ADR 0053). Notes carry most of a story, and as "Note added: <first line>" they read like system lines.
- **A Started line under the Note the Thread began from.** Two lines at the same instant for one event.
- **Quiet as a coloured gap, or a warning.** A colour or a warning makes quiet read as a problem to fix; the spec treats it as information.

## Consequences

- At phone width, a completion with a Note and a folded stretch both begin with a small "Completed …", so they look alike until the Note under the first.
- Spans read by rounding, so 48 days reads "7 weeks" and 49 reads "2 months".
- A list-like Note's bullets read as plain lines, as they do in the Notes tab.
- Out of scope for this round: logging title or Summary changes, a strip of marks for a rhythm, and a history view across Threads.
- A rhythm is guessed from days, so a monthly Task whose gaps vary from 28 to 31 days may read "On N days" when no one gap holds half the time.
- A stretch folds across any gap, as ADR 0053 set it, so weeks between two of its completions read in its heading and its rhythm, not as a quiet line.
