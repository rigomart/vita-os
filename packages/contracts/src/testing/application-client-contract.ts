import { describe, expect, it } from "vitest";

import type { ApplicationClient, TaskId } from "../index";

/**
 * What every `ApplicationClient` does, whatever is behind it: the HTTP API
 * over D1 and the lab's in-memory client both run it, so the lab can't drift
 * from the product it stands in for.
 *
 * Only what one person sees through the contract belongs here. Ownership,
 * races and storage stay with the API's own tests.
 *
 * `newClient` gives a client for someone with nothing yet.
 */
export function describeApplicationClient(
  name: string,
  newClient: () => Promise<ApplicationClient>,
) {
  describe(`${name}, as an application client`, () => {
    describe("Areas", () => {
      it("creates an Area from the picker, labels a Thread, removes the label, and deletes the Area", async () => {
        const client = await newClient();
        const thread = await value(
          client.createThread({ title: "Book checkup" }),
        );
        expect(thread).not.toHaveProperty("areaId");

        const area = await value(
          client.createArea({ name: "Family Health", icon: "HeartPulse" }),
        );
        expect(area).toMatchObject({
          name: "Family Health",
          icon: "HeartPulse",
          order: 0,
        });
        await expect(
          client.createArea({ name: "family health", icon: "Compass" }),
        ).resolves.toEqual({ ok: true, value: area });

        const labeled = await value(
          client.updateThread({ threadId: thread._id, areaId: area._id }),
        );
        expect(labeled.areaId).toBe(area._id);
        await expect(
          client.getThreadDetail({ slug: thread.slug }),
        ).resolves.toMatchObject({ ok: true, value: { area } });

        const unlabeled = await value(
          client.updateThread({ threadId: thread._id, areaId: null }),
        );
        expect(unlabeled).not.toHaveProperty("areaId");
        const activity = await value(
          client.getThreadActivityPage({ threadId: thread._id, limit: 10 }),
        );
        expect(activity.entries.map((entry) => entry.content)).toEqual([
          'Removed from "Family Health"',
          'Added to "Family Health"',
        ]);

        const renamed = await value(
          client.updateArea({
            areaId: area._id,
            name: "Health",
            icon: "Dumbbell",
          }),
        );
        expect(renamed).toMatchObject({ name: "Health", icon: "Dumbbell" });
        const second = await value(
          client.createArea({ name: "Home", icon: "Home" }),
        );
        await expect(
          client.reorderAreas({ areaIds: [second._id, area._id] }),
        ).resolves.toMatchObject({
          ok: true,
          value: [{ _id: second._id }, { _id: area._id }],
        });

        await expect(client.removeArea({ areaId: area._id })).resolves.toEqual({
          ok: true,
          value: { acknowledged: true },
        });
        await expect(client.listAreas()).resolves.toEqual({
          ok: true,
          value: [{ ...second, order: 0 }],
        });
      });

      it("reports a refused Area name as a validation failure", async () => {
        const client = await newClient();

        await expect(
          client.createArea({ name: "  ", icon: "Compass" }),
        ).resolves.toEqual({
          ok: false,
          error: {
            code: "validation",
            message: "Area name cannot be empty",
            retryable: false,
          },
        });
      });

      it("deletes an Area that still labels a Thread, leaving the Thread unlabeled", async () => {
        const client = await newClient();
        const area = await value(
          client.createArea({
            name: "Health",
            icon: "Compass",
          }),
        );
        const thread = await value(
          client.createThread({ title: "Book checkup", areaId: area._id }),
        );

        await expect(client.removeArea({ areaId: area._id })).resolves.toEqual({
          ok: true,
          value: { acknowledged: true },
        });
        await expect(
          client.getThreadDetail({ slug: thread.slug }),
        ).resolves.toEqual({
          ok: true,
          value: { thread: (({ areaId: _areaId, ...rest }) => rest)(thread) },
        });
      });
    });

    describe("Threads", () => {
      it("runs a Thread from capture to resolution", async () => {
        const client = await newClient();
        const area = await value(
          client.createArea({
            name: "Health",
            icon: "Compass",
          }),
        );

        const thread = await value(
          client.createThread({
            title: "Book checkup",
            summary: "Choose a clinic",
            areaId: area._id,
          }),
        );
        expect(thread).toMatchObject({ state: "open", order: 0 });

        const callClinic = "task-call-clinic" as TaskId;
        const bookSlot = "task-book-slot" as TaskId;
        await value(
          client.addTask({
            threadId: thread._id,
            taskId: callClinic,
            text: "Call clinic",
          }),
        );
        await value(
          client.addTask({
            threadId: thread._id,
            taskId: bookSlot,
            text: "Book appointment",
          }),
        );
        const dated = await value(
          client.setTaskDate({
            threadId: thread._id,
            taskId: bookSlot,
            date: 1_800_000_000_000,
          }),
        );
        expect(dated.tasks?.[1]).toEqual({
          _id: bookSlot,
          text: "Book appointment",
          date: 1_800_000_000_000,
        });

        const completed = await value(
          client.completeTask({
            expectedOccurrence:
              dated.tasks?.find((task) => task._id === callClinic)?.date ??
              null,
            threadId: thread._id,
            taskId: callClinic,
          }),
        );
        expect(completed.tasks).toEqual([
          { _id: bookSlot, text: "Book appointment", date: 1_800_000_000_000 },
        ]);

        const removed = await value(
          client.removeTask({
            threadId: thread._id,
            taskId: bookSlot,
          }),
        );
        expect(removed).not.toHaveProperty("tasks");

        const activity = await value(
          client.getThreadActivityPage({ threadId: thread._id, limit: 20 }),
        );
        expect(activity.entries.map((entry) => entry.content)).toEqual([
          'Completed "Call clinic"',
        ]);

        const resolved = await value(
          client.updateThread({
            threadId: thread._id,
            state: "resolved",
            resolutionNote: "Clinic confirmed",
          }),
        );
        expect(resolved.state).toBe("resolved");
        await expect(client.listOpenThreads()).resolves.toEqual({
          ok: true,
          value: [],
        });

        await expect(
          client.removeThread({ threadId: thread._id }),
        ).resolves.toEqual({ ok: true, value: { acknowledged: true } });
      });

      it("applies a Task command after another Thread edit", async () => {
        const client = await newClient();
        const area = await value(
          client.createArea({
            name: "Health",
            icon: "Compass",
          }),
        );
        const thread = await value(
          client.createThread({ title: "Book checkup", areaId: area._id }),
        );
        await value(
          client.updateThread({
            threadId: thread._id,
            title: "Book a checkup",
          }),
        );

        const added = await value(
          client.addTask({
            threadId: thread._id,
            taskId: "task-current" as TaskId,
            text: "Still useful",
          }),
        );
        expect(added.title).toBe("Book a checkup");
        expect(added.tasks).toEqual([
          { _id: "task-current", text: "Still useful" },
        ]);
      });
    });

    describe("Notes", () => {
      it("captures, edits, completes, pages, reopens, and discards a Note", async () => {
        const client = await newClient();
        const may20 = Date.UTC(2026, 4, 20);

        const note = await value(
          client.createNote({ body: "Refill prescription" }),
        );
        expect(note).toMatchObject({
          body: "Refill prescription",
          state: "open",
        });
        await expect(client.countOpenNotes()).resolves.toEqual({
          ok: true,
          value: 1,
        });

        const edited = await value(
          client.updateNoteBody({ noteId: note._id, body: "Refill both" }),
        );
        expect(edited.body).toBe("Refill both");

        const dated = await value(
          client.updateNoteFollowUp({
            noteId: note._id,
            followUp: may20,
          }),
        );
        expect(dated.followUp).toBe(may20);
        const undated = await value(
          client.updateNoteFollowUp({ noteId: note._id, followUp: null }),
        );
        expect(undated).not.toHaveProperty("when");

        const done = await value(client.markNoteDone({ noteId: note._id }));
        expect(done.state).toBe("done");
        await expect(client.listOpenNotes()).resolves.toEqual({
          ok: true,
          value: [],
        });
        await expect(client.getDoneNotePage({ limit: 20 })).resolves.toEqual({
          ok: true,
          value: { entries: [done] },
        });
        await expect(
          client.getDoneNotePage({ limit: 20, query: done.body.slice(0, 4) }),
        ).resolves.toEqual({ ok: true, value: { entries: [done] } });
        await expect(
          client.getDoneNotePage({ limit: 20, query: "nothing like it" }),
        ).resolves.toEqual({ ok: true, value: { entries: [] } });

        const reopened = await value(client.markNoteOpen({ noteId: note._id }));
        expect(reopened.state).toBe("open");

        await expect(client.removeNote({ noteId: note._id })).resolves.toEqual({
          ok: true,
          value: { acknowledged: true },
        });
        await expect(client.countOpenNotes()).resolves.toEqual({
          ok: true,
          value: 0,
        });
      });
    });

    describe("Thread Notes", () => {
      it("captures, edits, completes, pages, and discards a Thread Note", async () => {
        const client = await newClient();
        const area = await value(
          client.createArea({
            name: "Health",
            icon: "Compass",
          }),
        );
        const thread = await value(
          client.createThread({ title: "Book checkup", areaId: area._id }),
        );

        const note = await value(
          client.createThreadNote({
            threadId: thread._id,
            body: "Clinic opens at nine",
          }),
        );
        await expect(
          client.listOpenThreadNotes({ threadId: thread._id }),
        ).resolves.toEqual({ ok: true, value: [note] });

        const edited = await value(
          client.updateThreadNoteBody({
            threadNoteId: note._id,
            body: "Opens at eight",
          }),
        );
        expect(edited.body).toBe("Opens at eight");

        const done = await value(
          client.markThreadNoteDone({ threadNoteId: note._id }),
        );
        await expect(
          client.getDoneThreadNotePage({ threadId: thread._id, limit: 20 }),
        ).resolves.toEqual({ ok: true, value: { entries: [done] } });

        await value(client.markThreadNoteOpen({ threadNoteId: note._id }));
        await expect(
          client.removeThreadNote({ threadNoteId: note._id }),
        ).resolves.toEqual({ ok: true, value: { acknowledged: true } });
        await expect(
          client.listOpenThreadNotes({ threadId: thread._id }),
        ).resolves.toEqual({ ok: true, value: [] });
      });
    });

    describe("Adding Notes to Threads", () => {
      it("makes a dated Note a Thread Note and a dated Task named by its first line", async () => {
        const client = await newClient();
        const jun1 = Date.UTC(2030, 5, 1, 15, 30);
        const thread = await value(client.createThread({ title: "Checkup" }));
        const note = await value(
          client.createNote({
            body: "# Call back\nabout the scan",
            followUp: jun1,
          }),
        );

        const added = await value(
          client.addNoteToThread({ noteId: note._id, threadId: thread._id }),
        );
        expect(added.thread.tasks).toEqual([
          { _id: expect.any(String), text: "Call back", date: jun1 },
        ]);
        expect(added.threadNote).toMatchObject({
          body: "# Call back\nabout the scan",
          createdAt: note.createdAt,
        });
        await expect(
          client.listOpenThreadNotes({ threadId: thread._id }),
        ).resolves.toEqual({ ok: true, value: [added.threadNote] });
        await expect(client.listOpenNotes()).resolves.toEqual({
          ok: true,
          value: [],
        });
        const activity = await value(
          client.getThreadActivityPage({ threadId: thread._id, limit: 10 }),
        );
        expect(activity.entries).toEqual([]);
      });

      it("starts a Thread from a Note", async () => {
        const client = await newClient();
        const may20 = Date.UTC(2030, 4, 20);
        const note = await value(
          client.createNote({ body: "Dentist\nCall Monday", followUp: may20 }),
        );

        const added = await value(
          client.createThreadFromNote({
            noteId: note._id,
            title: "  Dentist  ",
          }),
        );
        expect(added.thread).toMatchObject({
          title: "Dentist",
          state: "open",
          tasks: [{ _id: expect.any(String), text: "Dentist", date: may20 }],
        });
        await expect(
          client.getThreadDetail({ slug: added.thread.slug }),
        ).resolves.toEqual({ ok: true, value: { thread: added.thread } });
        await expect(client.listOpenNotes()).resolves.toEqual({
          ok: true,
          value: [],
        });
      });
    });

    describe("Repeating Tasks", () => {
      it("skips without a trace and completes into the Activity Log, keeping the Task", async () => {
        const client = await newClient();
        const day = 24 * 60 * 60 * 1000;
        const first = Date.UTC(2030, 4, 20, 15, 30);
        const taskId = "task-water-plants" as TaskId;
        const thread = await value(client.createThread({ title: "Plants" }));
        await value(
          client.addTask({
            threadId: thread._id,
            taskId,
            text: "Water plants",
            date: first,
          }),
        );
        const repeating = await value(
          client.setTaskRepeat({
            threadId: thread._id,
            taskId,
            repeat: { kind: "days", every: 3 },
            timeZone: "UTC",
          }),
        );
        expect(repeating.tasks?.[0]).toMatchObject({
          date: first,
          repeat: { kind: "days", every: 3 },
        });

        const skipped = await value(
          client.skipTask({
            threadId: thread._id,
            taskId,
            expectedOccurrence: first,
            timeZone: "UTC",
          }),
        );
        expect(skipped.tasks?.[0]?.date).toBe(first + 3 * day);
        expect(
          (
            await value(
              client.getThreadActivityPage({ threadId: thread._id, limit: 10 }),
            )
          ).entries,
        ).toEqual([]);

        const completed = await value(
          client.completeTask({
            threadId: thread._id,
            taskId,
            expectedOccurrence: first + 3 * day,
            timeZone: "UTC",
          }),
        );
        expect(completed.tasks).toEqual([
          {
            _id: taskId,
            text: "Water plants",
            date: first + 6 * day,
            repeat: { kind: "days", every: 3 },
          },
        ]);
        const activity = await value(
          client.getThreadActivityPage({ threadId: thread._id, limit: 10 }),
        );
        expect(activity.entries.map((entry) => entry.content)).toEqual([
          'Completed "Water plants"',
        ]);
        await expect(
          client.completeTask({
            threadId: thread._id,
            taskId,
            expectedOccurrence: first + 3 * day,
            timeZone: "UTC",
          }),
        ).resolves.toMatchObject({ ok: false, error: { code: "conflict" } });
      });

      it("repeats monthly on the date's day, falling to a short month's end and following a changed date", async () => {
        const client = await newClient();
        const jan31 = Date.UTC(2031, 0, 31, 9);
        const taskId = "task-pay-rent" as TaskId;
        const thread = await value(client.createThread({ title: "Home" }));
        await value(
          client.addTask({
            threadId: thread._id,
            taskId,
            text: "Pay rent",
            date: jan31,
          }),
        );
        for (const day of [0, 32, 1.5]) {
          await expect(
            client.setTaskRepeat({
              threadId: thread._id,
              taskId,
              repeat: { kind: "monthly", day },
              timeZone: "UTC",
            }),
          ).resolves.toMatchObject({
            ok: false,
            error: { code: "validation" },
          });
        }
        const repeating = await value(
          client.setTaskRepeat({
            threadId: thread._id,
            taskId,
            repeat: { kind: "monthly", day: 31 },
            timeZone: "UTC",
          }),
        );
        expect(repeating.tasks?.[0]).toEqual({
          _id: taskId,
          text: "Pay rent",
          date: jan31,
          repeat: { kind: "monthly", day: 31 },
        });

        const skipped = await value(
          client.skipTask({
            threadId: thread._id,
            taskId,
            expectedOccurrence: jan31,
            timeZone: "UTC",
          }),
        );
        expect(skipped.tasks?.[0]?.date).toBe(Date.UTC(2031, 1, 28, 9));
        const moved = await value(
          client.setTaskDate({
            threadId: thread._id,
            taskId,
            date: Date.UTC(2031, 2, 12, 9),
            timeZone: "UTC",
          }),
        );
        expect(moved.tasks?.[0]).toEqual({
          _id: taskId,
          text: "Pay rent",
          date: Date.UTC(2031, 2, 12, 9),
          repeat: { kind: "monthly", day: 12 },
        });
        await expect(
          client.getThreadDetail({ slug: thread.slug }),
        ).resolves.toMatchObject({ ok: true, value: { thread: moved } });
      });
    });

    describe("Repeating Notes", () => {
      const nov5 = Date.UTC(2030, 10, 5, 9);
      const monthly5 = { kind: "monthly", day: 5 } as const;

      it("sets a Repeat on a dated Note, snapping and following its date, and clearing the date clears it", async () => {
        const client = await newClient();
        const undated = await value(
          client.createNote({ body: "Pay the utility bill" }),
        );
        await expect(
          client.setNoteRepeat({
            noteId: undated._id,
            repeat: monthly5,
            timeZone: "UTC",
          }),
        ).resolves.toMatchObject({ ok: false, error: { code: "validation" } });

        const note = await value(
          client.createNote({ body: "Pay the utility bill", followUp: nov5 }),
        );
        expect(note).not.toHaveProperty("repeat");
        const weekly = await value(
          client.setNoteRepeat({
            noteId: note._id,
            repeat: { kind: "weekly", weekdays: [4] },
            timeZone: "UTC",
          }),
        );
        expect(weekly).toMatchObject({
          followUp: Date.UTC(2030, 10, 7, 9),
          repeat: { kind: "weekly", weekdays: [4] },
        });
        await expect(
          client.updateNoteFollowUp({ noteId: note._id, followUp: nov5 }),
        ).resolves.toMatchObject({ ok: false, error: { code: "validation" } });

        const snapped = await value(
          client.updateNoteFollowUp({
            noteId: note._id,
            followUp: nov5,
            timeZone: "UTC",
          }),
        );
        expect(snapped.followUp).toBe(Date.UTC(2030, 10, 7, 9));
        await value(
          client.setNoteRepeat({
            noteId: note._id,
            repeat: null,
            timeZone: "UTC",
          }),
        );
        await value(
          client.updateNoteFollowUp({ noteId: note._id, followUp: nov5 }),
        );
        const repeating = await value(
          client.setNoteRepeat({
            noteId: note._id,
            repeat: monthly5,
            timeZone: "UTC",
          }),
        );
        expect(repeating).toMatchObject({ followUp: nov5, repeat: monthly5 });
        const moved = await value(
          client.updateNoteFollowUp({
            noteId: note._id,
            followUp: Date.UTC(2030, 10, 12, 9),
            timeZone: "UTC",
          }),
        );
        expect(moved).toMatchObject({
          followUp: Date.UTC(2030, 10, 12, 9),
          repeat: { kind: "monthly", day: 12 },
        });
        expect(await value(client.listOpenNotes())).toContainEqual(moved);

        const cleared = await value(
          client.updateNoteFollowUp({ noteId: note._id, followUp: null }),
        );
        expect(cleared).not.toHaveProperty("followUp");
        expect(cleared).not.toHaveProperty("repeat");

        await value(
          client.updateNoteFollowUp({ noteId: note._id, followUp: nov5 }),
        );
        await value(
          client.setNoteRepeat({
            noteId: note._id,
            repeat: monthly5,
            timeZone: "UTC",
          }),
        );
        const oneOff = await value(
          client.setNoteRepeat({
            noteId: note._id,
            repeat: null,
            timeZone: "UTC",
          }),
        );
        expect(oneOff.followUp).toBe(nov5);
        expect(oneOff).not.toHaveProperty("repeat");
      });

      it("creates a Note with its Repeat, snapping a weekly one, and refuses one without a date or zone", async () => {
        const client = await newClient();
        await expect(
          client.createNote({
            body: "Pay the utility bill",
            repeat: monthly5,
            timeZone: "UTC",
          }),
        ).resolves.toMatchObject({ ok: false, error: { code: "validation" } });
        await expect(
          client.createNote({
            body: "Pay the utility bill",
            followUp: nov5,
            repeat: monthly5,
          }),
        ).resolves.toMatchObject({ ok: false, error: { code: "validation" } });

        const monthly = await value(
          client.createNote({
            body: "Pay the utility bill",
            followUp: nov5,
            repeat: monthly5,
            timeZone: "UTC",
          }),
        );
        expect(monthly).toMatchObject({ followUp: nov5, repeat: monthly5 });
        const weekly = await value(
          client.createNote({
            body: "Water the plants",
            followUp: nov5,
            repeat: { kind: "weekly", weekdays: [4] },
            timeZone: "UTC",
          }),
        );
        expect(weekly).toMatchObject({
          followUp: Date.UTC(2030, 10, 7, 9),
          repeat: { kind: "weekly", weekdays: [4] },
        });
        expect(await value(client.listOpenNotes())).toEqual(
          expect.arrayContaining([monthly, weekly]),
        );
      });

      it("completes to the next occurrence, once, recording nothing", async () => {
        const client = await newClient();
        const note = await value(
          client.createNote({ body: "Pay the utility bill", followUp: nov5 }),
        );
        await value(
          client.setNoteRepeat({
            noteId: note._id,
            repeat: monthly5,
            timeZone: "UTC",
          }),
        );

        const completed = await value(
          client.completeNote({
            noteId: note._id,
            expectedOccurrence: nov5,
            timeZone: "UTC",
          }),
        );
        expect(completed).toMatchObject({
          _id: note._id,
          state: "open",
          followUp: Date.UTC(2030, 11, 5, 9),
          repeat: monthly5,
        });
        expect(completed).not.toHaveProperty("completedAt");
        await expect(
          client.completeNote({
            noteId: note._id,
            expectedOccurrence: nov5,
            timeZone: "UTC",
          }),
        ).resolves.toMatchObject({ ok: false, error: { code: "conflict" } });
        await expect(client.listOpenNotes()).resolves.toMatchObject({
          ok: true,
          value: [{ _id: note._id, followUp: Date.UTC(2030, 11, 5, 9) }],
        });

        const oneOff = await value(
          client.createNote({ body: "Call the bank", followUp: nov5 }),
        );
        await expect(
          client.completeNote({
            noteId: oneOff._id,
            expectedOccurrence: nov5,
            timeZone: "UTC",
          }),
        ).resolves.toMatchObject({ ok: false, error: { code: "validation" } });
      });

      it("collapses missed occurrences into the first not before today", async () => {
        const client = await newClient();
        const missed = Date.UTC(2020, 0, 5, 9);
        const note = await value(
          client.createNote({ body: "Replace the filter", followUp: missed }),
        );
        await value(
          client.setNoteRepeat({
            noteId: note._id,
            repeat: monthly5,
            timeZone: "UTC",
          }),
        );
        const day = 24 * 60 * 60 * 1000;
        const today = Math.floor(Date.now() / day) * day;

        const completed = await value(
          client.completeNote({
            noteId: note._id,
            expectedOccurrence: missed,
            timeZone: "UTC",
          }),
        );
        const next = new Date(completed.followUp!);
        expect(next.getUTCDate()).toBe(5);
        expect(next.getUTCHours()).toBe(9);
        expect(completed.followUp).toBeGreaterThanOrEqual(today);
        expect(completed.followUp).toBeLessThan(today + 32 * day);
      });

      it("keeps the date and Repeat while archived, and refuses to complete an archived Note", async () => {
        const client = await newClient();
        const note = await value(
          client.createNote({ body: "Pay the utility bill", followUp: nov5 }),
        );
        await value(
          client.setNoteRepeat({
            noteId: note._id,
            repeat: monthly5,
            timeZone: "UTC",
          }),
        );

        const archived = await value(client.markNoteDone({ noteId: note._id }));
        expect(archived).toMatchObject({
          state: "done",
          followUp: nov5,
          repeat: monthly5,
        });
        await expect(
          client.completeNote({
            noteId: note._id,
            expectedOccurrence: nov5,
            timeZone: "UTC",
          }),
        ).resolves.toMatchObject({ ok: false, error: { code: "not_found" } });

        const unarchived = await value(
          client.markNoteOpen({ noteId: note._id }),
        );
        expect(unarchived).toMatchObject({
          state: "open",
          followUp: nov5,
          repeat: monthly5,
        });
      });

      it("gives a Thread a Task carrying the Repeat, added or started from the Note", async () => {
        const client = await newClient();
        const thread = await value(client.createThread({ title: "Home" }));
        const bill = await value(
          client.createNote({
            body: "Pay the utility bill\nAccount 0042",
            followUp: nov5,
          }),
        );
        await value(
          client.setNoteRepeat({
            noteId: bill._id,
            repeat: monthly5,
            timeZone: "UTC",
          }),
        );
        const added = await value(
          client.addNoteToThread({ noteId: bill._id, threadId: thread._id }),
        );
        expect(added.thread.tasks).toEqual([
          {
            _id: expect.any(String),
            text: "Pay the utility bill",
            date: nov5,
            repeat: monthly5,
          },
        ]);

        const filter = await value(
          client.createNote({ body: "Water filter", followUp: nov5 }),
        );
        await value(
          client.setNoteRepeat({
            noteId: filter._id,
            repeat: { kind: "days", every: 90 },
            timeZone: "UTC",
          }),
        );
        const started = await value(
          client.createThreadFromNote({ noteId: filter._id, title: "Filter" }),
        );
        expect(started.thread.tasks).toEqual([
          {
            _id: expect.any(String),
            text: "Water filter",
            date: nov5,
            repeat: { kind: "days", every: 90 },
          },
        ]);
      });
    });
  });
}

/** The value of an operation that must have succeeded. */
async function value<T>(
  operation: Promise<{ ok: true; value: T } | { ok: false; error: unknown }>,
): Promise<T> {
  const result = await operation;
  if (!result.ok) {
    throw new Error(`Operation failed: ${JSON.stringify(result.error)}`);
  }
  return result.value;
}
