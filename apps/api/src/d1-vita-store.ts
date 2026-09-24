import { newRecordId } from "@vita-os/core";

import type { WorkerEnv } from "./env";
import type { StoreClock, VitaStore } from "./store";

import { D1AreaStore } from "./d1-area-store";
import { D1NoteStore } from "./d1-note-store";
import { D1ThreadNoteStore } from "./d1-thread-note-store";
import { D1ThreadStore } from "./d1-thread-store";

/** Real time and real randomness, for everything that is not a test. */
export const systemClock: StoreClock = {
  now: () => Date.now(),
  newId: () => newRecordId(),
};

export function createD1VitaStore(
  database: WorkerEnv["DB"],
  clock: StoreClock = systemClock,
): VitaStore {
  return {
    areas: new D1AreaStore(database, clock),
    threads: new D1ThreadStore(database, clock),
    notes: new D1NoteStore(database, clock),
    threadNotes: new D1ThreadNoteStore(database, clock),
  };
}
