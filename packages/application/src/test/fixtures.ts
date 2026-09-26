import type {
  AreaId,
  AreaSummary,
  Note,
  NoteId,
  Thread,
  ThreadId,
  ThreadNote,
  ThreadNoteId,
} from "@vita-os/contracts";

/** Small, named records the hook tests build their situations from. */

export function anArea(overrides: Partial<AreaSummary> = {}): AreaSummary {
  return {
    _id: "area-1" as AreaId,
    name: "Health",
    slug: "health-0011aabb",
    icon: "HeartPulse",
    order: 0,
    createdAt: 1_000,
    ...overrides,
  };
}

export function aThread(overrides: Partial<Thread> = {}): Thread {
  return {
    _id: "thread-1" as ThreadId,
    title: "Book checkup",
    slug: "book-checkup-0011aabb",
    areaId: "area-1" as AreaId,
    order: 0,
    state: "open",
    createdAt: 2_000,
    revision: 0,
    ...overrides,
  };
}

export function aNote(overrides: Partial<Note> = {}): Note {
  return {
    _id: "note-1" as NoteId,
    body: "Refill prescription",
    state: "open",
    createdAt: 3_000,
    updatedAt: 3_000,
    ...overrides,
  };
}

export function aThreadNote(overrides: Partial<ThreadNote> = {}): ThreadNote {
  return {
    _id: "thread-note-1" as ThreadNoteId,
    body: "Clinic opens at nine",
    state: "open",
    createdAt: 4_000,
    updatedAt: 4_000,
    ...overrides,
  };
}
