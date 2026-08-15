/**
 * PROTOTYPE (issue #280) — throwaway mock data + local state for the
 * thread-view "Up Next" redesign variants. Nothing here touches Convex.
 *
 * All variants share `useMockThread` so the domain rules are identical in
 * each: while Up Next is non-empty the Next Move slot is always filled;
 * completing or clearing the Next Move promotes the front upcoming move,
 * and the promotion rides the existing log entry (no separate entry);
 * editing Up Next itself is silent (no log entries).
 */
import { useCallback, useState } from "react";

export interface MockUpcomingMove {
  /** Local-only key for React lists/reorder; the real feature stores plain strings. */
  id: string;
  text: string;
}

export interface MockThread {
  title: string;
  summary?: string;
  state: "open" | "resolved";
  nextMove?: string;
  followUp?: number;
  lastActivityAt: number;
  createdAt: number;
}

export interface MockArea {
  name: string;
  condition: "healthy" | "needs_attention" | "critical";
}

export interface MockLogEntry {
  id: string;
  type:
    | "note"
    | "next_action_change"
    | "state_change"
    | "follow_up_change"
    | "area_move";
  content: string;
  previousValue?: string;
  newValue?: string;
  createdAt: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const now = Date.now();

export const MOCK_AREA: MockArea = {
  name: "Admin & Paperwork",
  condition: "healthy",
};

const INITIAL_THREAD: MockThread = {
  title: "Renew passport before the Lisbon trip",
  summary:
    "Expires in June; the trip is late September so any normal processing window works. Old passport needs to be surrendered at the appointment.",
  state: "open",
  nextMove: "Get biometric photos taken at the print shop",
  followUp: now + 12 * DAY,
  lastActivityAt: now - 2 * HOUR,
  createdAt: now - 9 * DAY,
};

const INITIAL_UP_NEXT: MockUpcomingMove[] = [
  { id: "m1", text: "Book renewal appointment at the civil registry" },
  { id: "m2", text: "Fill in the renewal form and gather old passport" },
  { id: "m3", text: "Attend appointment and pay the fee" },
  { id: "m4", text: "Collect the new passport once notified" },
];

const INITIAL_LOG: MockLogEntry[] = [
  {
    id: "l1",
    type: "note",
    content:
      "Checked the registry site — walk-ins are gone, appointment only. Photos must be under 6 months old, so redoing them anyway.",
    createdAt: now - 2 * HOUR,
  },
  {
    id: "l2",
    type: "next_action_change",
    content: "Next move set",
    newValue: "Get biometric photos taken at the print shop",
    createdAt: now - 5 * HOUR,
  },
  {
    id: "l3",
    type: "follow_up_change",
    content: "Follow-up set",
    newValue: "in 12 days",
    createdAt: now - 1 * DAY - 3 * HOUR,
  },
  {
    id: "l4",
    type: "note",
    content:
      "Flights to Lisbon are booked for Sep 24. That fixes the deadline: passport in hand by mid-September at the latest.",
    createdAt: now - 1 * DAY - 6 * HOUR,
  },
  {
    id: "l5",
    type: "next_action_change",
    content: "Next move completed",
    previousValue: "Dig out the old passport and check the expiry date",
    createdAt: now - 3 * DAY,
  },
  {
    id: "l6",
    type: "note",
    content: "Started this after noticing the expiry while filing taxes.",
    createdAt: now - 9 * DAY,
  },
];

let nextId = 100;
const freshId = (prefix: string) => `${prefix}${nextId++}`;

export interface MockThreadState {
  thread: MockThread;
  area: MockArea;
  upNext: MockUpcomingMove[];
  log: MockLogEntry[];
}

export interface MockThreadActions {
  /** Complete the current Next Move: logs it, promotes the front upcoming move. */
  completeNextMove: () => void;
  /** Clear the current Next Move without completing: logs it, promotes the front upcoming move. */
  clearNextMove: () => void;
  /** Set/replace the Next Move text directly (logs a change). */
  setNextMove: (text: string) => void;
  addUpcomingMove: (text: string) => void;
  editUpcomingMove: (id: string, text: string) => void;
  removeUpcomingMove: (id: string) => void;
  /** Move an upcoming move to a new index (clamped). */
  reorderUpcomingMove: (id: string, toIndex: number) => void;
  setFollowUp: (timestamp: number | null) => void;
  updateThread: (patch: Partial<Pick<MockThread, "title" | "summary">>) => void;
  addNote: (content: string) => void;
}

interface MockData {
  thread: MockThread;
  upNext: MockUpcomingMove[];
  log: MockLogEntry[];
}

const INITIAL_DATA: MockData = {
  thread: INITIAL_THREAD,
  upNext: INITIAL_UP_NEXT,
  log: INITIAL_LOG,
};

function withLog(
  data: MockData,
  entry: Omit<MockLogEntry, "id" | "createdAt">,
): MockData {
  const at = Date.now();
  return {
    ...data,
    thread: { ...data.thread, lastActivityAt: at },
    log: [{ ...entry, id: freshId("l"), createdAt: at }, ...data.log],
  };
}

/** Complete/clear share the promotion: front of Up Next fills the slot. */
function releaseNextMove(data: MockData, content: string): MockData {
  if (!data.thread.nextMove) return data;
  const [front, ...rest] = data.upNext;
  const logged = withLog(data, {
    type: "next_action_change",
    content,
    previousValue: data.thread.nextMove,
    newValue: front?.text,
  });
  return {
    ...logged,
    thread: { ...logged.thread, nextMove: front?.text },
    upNext: rest,
  };
}

export function useMockThread(): MockThreadState & MockThreadActions {
  const [data, setData] = useState(INITIAL_DATA);

  const completeNextMove = useCallback(() => {
    setData((prev) => releaseNextMove(prev, "Next move completed"));
  }, []);

  const clearNextMove = useCallback(() => {
    setData((prev) => releaseNextMove(prev, "Next move cleared"));
  }, []);

  const setNextMove = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setData((prev) => {
      const logged = withLog(prev, {
        type: "next_action_change",
        content: prev.thread.nextMove ? "Next move changed" : "Next move set",
        previousValue: prev.thread.nextMove,
        newValue: trimmed,
      });
      return { ...logged, thread: { ...logged.thread, nextMove: trimmed } };
    });
  }, []);

  const addUpcomingMove = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setData((prev) => ({
      ...prev,
      upNext: [...prev.upNext, { id: freshId("m"), text: trimmed }],
    }));
  }, []);

  const editUpcomingMove = useCallback((id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setData((prev) => ({
      ...prev,
      upNext: prev.upNext.map((move) =>
        move.id === id ? { ...move, text: trimmed } : move,
      ),
    }));
  }, []);

  const removeUpcomingMove = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      upNext: prev.upNext.filter((move) => move.id !== id),
    }));
  }, []);

  const reorderUpcomingMove = useCallback((id: string, toIndex: number) => {
    setData((prev) => {
      const from = prev.upNext.findIndex((move) => move.id === id);
      if (from === -1) return prev;
      const clamped = Math.max(0, Math.min(prev.upNext.length - 1, toIndex));
      if (clamped === from) return prev;
      const upNext = [...prev.upNext];
      const [moved] = upNext.splice(from, 1);
      upNext.splice(clamped, 0, moved);
      return { ...prev, upNext };
    });
  }, []);

  const setFollowUp = useCallback((timestamp: number | null) => {
    setData((prev) => {
      const logged = withLog(prev, {
        type: "follow_up_change",
        content: timestamp ? "Follow-up set" : "Follow-up cleared",
      });
      return {
        ...logged,
        thread: { ...logged.thread, followUp: timestamp ?? undefined },
      };
    });
  }, []);

  const updateThread = useCallback(
    (patch: Partial<Pick<MockThread, "title" | "summary">>) => {
      setData((prev) => ({ ...prev, thread: { ...prev.thread, ...patch } }));
    },
    [],
  );

  const addNote = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    setData((prev) => withLog(prev, { type: "note", content: trimmed }));
  }, []);

  return {
    ...data,
    area: MOCK_AREA,
    completeNextMove,
    clearNextMove,
    setNextMove,
    addUpcomingMove,
    editUpcomingMove,
    removeUpcomingMove,
    reorderUpcomingMove,
    setFollowUp,
    updateThread,
    addNote,
  };
}
