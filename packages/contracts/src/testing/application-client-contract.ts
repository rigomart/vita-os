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
        const focused = await value(
          client.focusTask({
            threadId: thread._id,
            taskId: callClinic,
          }),
        );
        expect(focused.focusedTaskId).toBe(callClinic);

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
        expect(completed).not.toHaveProperty("focusedTaskId");

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
        expect(added.thread).not.toHaveProperty("focusedTaskId");
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
