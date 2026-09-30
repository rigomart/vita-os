import type { ThreadNotePage } from "../packages/contracts/src/models";

export type SeedApiCall = <T>(
  method: string,
  path: string,
  body?: unknown,
) => Promise<T>;

const samples = [
  {
    title: "Dentist follow-up",
    notes: [
      {
        body: `# Consultation — crown follow-up

Sample consultation notes for trying the Note view.

## What we discussed
- The lower left crown still feels high.
- Bring the previous treatment summary to the next appointment.

| Topic | Notes |
| --- | --- |
| Appointment | Ask the clinic for the next available slot |
| Records | Bring the treatment summary |
| Questions | Discuss the fit and a night guard |

## Before the appointment
- [ ] Call the clinic
- [ ] Write down the questions

> Keep the appointment details here when the clinic confirms.

[Example appointment portal](https://example.com/appointments)`,
      },
      { body: "Called the clinic\nWaiting for a reply" },
      {
        body: "## Previous visit\nCollected the treatment summary and saved the clinic's contact details.",
        done: true,
      },
    ],
  },
  {
    title: "Quarterly review prep",
    notes: [
      {
        body: `## Wins to bring to the review
- Shipped the onboarding update.
- Helped unblock the release.
  - Wrote down the rollout steps.

## Questions
1. What should I focus on next quarter?
2. Which work had the biggest impact?

**Bring concrete examples**, including feedback from the team.`,
      },
    ],
  },
];

/** Add examples only to uniquely matched, empty sample Threads. Never edit
 * existing content or recreate Threads someone has removed or renamed. */
export async function seedThreadNotes(call: SeedApiCall): Promise<number> {
  const threads = await call<{ _id: string; title: string }[]>(
    "GET",
    "/v1/threads",
  );
  let added = 0;
  for (const sample of samples) {
    const matches = threads.filter((thread) => thread.title === sample.title);
    if (matches.length !== 1) continue;
    const thread = matches[0];
    const open = await call<unknown[]>(
      "GET",
      `/v1/threads/${thread._id}/notes`,
    );
    const done = await call<ThreadNotePage>(
      "GET",
      `/v1/threads/${thread._id}/notes/done?limit=1`,
    );
    if (open.length || done.entries.length) continue;
    for (const note of sample.notes) {
      const created = await call<{ _id: string }>(
        "POST",
        `/v1/threads/${thread._id}/notes`,
        { body: note.body },
      );
      if ("done" in note && note.done) {
        await call("PATCH", `/v1/thread-notes/${created._id}/state`, {
          state: "done",
        });
      }
      added++;
    }
  }
  return added;
}
