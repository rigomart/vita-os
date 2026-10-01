import { expect, test } from "bun:test";

import { type SeedApiCall, seedThreadNotes } from "./seed-thread-notes";

type Note = { _id: string; body: string; state: "open" | "done" };

// Replace only HTTP transport. Reads reflect writes, so the second run tests
// duplicate prevention instead of receiving a canned empty response again.
function fixture({
  threads = [
    { _id: "dentist", title: "Dentist follow-up" },
    { _id: "review", title: "Quarterly review prep" },
  ],
  notes = new Map<string, Note[]>(),
} = {}) {
  const writes: { method: string; path: string; body: unknown }[] = [];
  const call: SeedApiCall = async <T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> => {
    if (method === "GET" && path === "/v1/threads") return threads as T;
    const route = /^\/v1\/threads\/([^/]+)\/notes(\/done\?limit=1)?$/.exec(
      path,
    );
    if (route) {
      const existing = notes.get(route[1]) ?? [];
      if (method === "GET") {
        return (
          route[2]
            ? {
                entries: existing.filter((note) => note.state === "done"),
              }
            : existing.filter((note) => note.state === "open")
        ) as T;
      }
      if (method === "POST") {
        const note: Note = {
          _id: `note-${writes.length}`,
          body: (body as { body: string }).body,
          state: "open",
        };
        notes.set(route[1], [...existing, note]);
        writes.push({ method, path, body });
        return note as T;
      }
    }
    const state = /^\/v1\/thread-notes\/([^/]+)\/state$/.exec(path);
    if (method === "PATCH" && state) {
      const note = [...notes.values()]
        .flat()
        .find((item) => item._id === state[1]);
      if (!note) throw new Error("Unknown Note");
      note.state = (body as { state: "done" }).state;
      writes.push({ method, path, body });
      return note as T;
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  };
  return { call, writes, notes };
}

test("adds readable Markdown and completed history to empty sample Threads", async () => {
  const { call, writes, notes } = fixture();
  expect(await seedThreadNotes(call)).toBe(4);
  expect(notes.get("dentist")).toHaveLength(3);
  expect(notes.get("review")).toHaveLength(1);
  expect(
    notes.get("dentist")?.filter((note) => note.state === "done"),
  ).toHaveLength(1);
  const consultation = notes.get("dentist")?.[0].body;
  expect(consultation).toContain("# Consultation");
  expect(consultation).toContain("| Topic | Notes |");
  expect(consultation).toContain("- [ ]");
  expect(writes.filter((write) => write.method === "PATCH")).toHaveLength(1);
});

test("rerunning does not duplicate sample Notes", async () => {
  const { call, writes } = fixture();
  await seedThreadNotes(call);
  const before = structuredClone(writes);
  expect(await seedThreadNotes(call)).toBe(0);
  expect(writes).toEqual(before);
});

for (const state of ["open", "done"] as const) {
  test(`preserves existing ${state} Notes and skips that Thread`, async () => {
    const existing: Note = {
      _id: "personal-note",
      body: "My edited content",
      state,
    };
    const { call, writes, notes } = fixture({
      threads: [{ _id: "dentist", title: "Dentist follow-up" }],
      notes: new Map([["dentist", [existing]]]),
    });
    expect(await seedThreadNotes(call)).toBe(0);
    expect(writes).toEqual([]);
    expect(notes.get("dentist")).toEqual([existing]);
  });
}

test("does not recreate removed Threads or choose between duplicate titles", async () => {
  const { call, writes } = fixture({
    threads: [
      { _id: "one", title: "Dentist follow-up" },
      { _id: "two", title: "Dentist follow-up" },
      { _id: "personal", title: "My own Thread" },
    ],
  });
  expect(await seedThreadNotes(call)).toBe(0);
  expect(writes).toEqual([]);
});
