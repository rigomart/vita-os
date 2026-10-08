import * as v from "valibot";
import { describe, expect, it } from "vitest";

import {
  AddTaskBody,
  ApplicationErrorSchema,
  AreaSummarySchema,
  CommandAckSchema,
  CompleteTaskBody,
  CreateNoteBody,
  FocusTaskBody,
  NoteFollowUp,
  NoteSchema,
  PageQuery,
  SetTaskRepeatBody,
  SkipTaskBody,
  TaskSchema,
  ThreadDetailSchema,
  ThreadSchema,
  UpdateThreadBody,
} from "./index";

const note = {
  _id: "opaque;note",
  body: "Call clinic",
  state: "open",
  createdAt: 1,
};
const thread = {
  _id: "opaque;thread",
  title: "Checkup",
  slug: "checkup",
  order: 0,
  state: "open",
  createdAt: 1,
};

describe("shared response schemas", () => {
  it("keeps opaque IDs and omitted optional fields", () => {
    expect(v.parse(NoteSchema, note)).toEqual(note);
    expect(Object.hasOwn(v.parse(NoteSchema, note), "followUp")).toBe(false);
    expect(v.parse(ThreadDetailSchema, { thread })).toEqual({ thread });
  });

  it("strips unknown response fields at every object boundary", () => {
    expect(
      v.parse(ThreadDetailSchema, {
        thread: { ...thread, privateOwner: "secret" },
        internal: true,
      }),
    ).toEqual({ thread });
  });

  it("rejects null where stored optional values use absence", () => {
    expect(v.safeParse(NoteSchema, { ...note, followUp: null }).success).toBe(
      false,
    );
    expect(v.safeParse(ThreadSchema, { ...thread, areaId: null }).success).toBe(
      false,
    );
    expect(
      v.safeParse(TaskSchema, { _id: "task", text: "Call", repeat: null })
        .success,
    ).toBe(false);
  });

  it("reads integer legacy dates outside new-write bounds", () => {
    expect(
      v.parse(TaskSchema, { _id: "task", text: "Call", date: -1 }).date,
    ).toBe(-1);
    expect(
      v.parse(NoteSchema, { ...note, followUp: 253402300800000 }).followUp,
    ).toBe(253402300800000);
    expect(
      v.safeParse(TaskSchema, { _id: "task", text: "Call", date: 0.5 }).success,
    ).toBe(false);
  });

  it("rejects invalid identities, state, icon, and nested shapes", () => {
    expect(v.safeParse(NoteSchema, { ...note, _id: "" }).success).toBe(false);
    expect(
      v.safeParse(NoteSchema, { ...note, state: "resolved" }).success,
    ).toBe(false);
    expect(
      v.safeParse(ThreadSchema, { ...thread, tasks: [{ _id: "task" }] })
        .success,
    ).toBe(false);
    expect(
      v.safeParse(AreaSummarySchema, {
        _id: "area",
        name: "Health",
        slug: "health",
        icon: "Unknown",
        order: 0,
        createdAt: 1,
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(TaskSchema, {
        _id: "task",
        text: "Call",
        repeat: { kind: "monthly" },
      }).success,
    ).toBe(false);
  });

  it("checks complete errors and command acknowledgements", () => {
    expect(
      v.safeParse(ApplicationErrorSchema, {
        code: "not_found",
        message: "Missing",
        retryable: false,
      }).success,
    ).toBe(true);
    expect(
      v.safeParse(ApplicationErrorSchema, {
        code: "teapot",
        message: "Missing",
        retryable: false,
      }).success,
    ).toBe(false);
    expect(v.safeParse(CommandAckSchema, { acknowledged: false }).success).toBe(
      false,
    );
  });
});

describe("shared request shapes", () => {
  it("preserves an absent patch key and accepts explicit clearing", () => {
    expect(v.parse(UpdateThreadBody, {})).toEqual({});
    expect(v.parse(UpdateThreadBody, { areaId: null, summary: null })).toEqual({
      areaId: null,
      summary: null,
    });
    expect(v.parse(FocusTaskBody, { taskId: null })).toEqual({ taskId: null });
    expect(v.safeParse(FocusTaskBody, {}).success).toBe(false);
    expect(v.parse(NoteFollowUp, { followUp: null })).toEqual({
      followUp: null,
    });
    expect(
      v.safeParse(CreateNoteBody, { body: "Call", followUp: null }).success,
    ).toBe(false);
  });

  it("rejects unknown JSON keys, including inside nested request objects", () => {
    expect(
      v.safeParse(AddTaskBody, { taskId: "task", text: "Call", surprise: true })
        .success,
    ).toBe(false);
    expect(
      v.safeParse(CompleteTaskBody, {
        expectedOccurrence: null,
        note: { id: "note", body: "Done", private: true },
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(SetTaskRepeatBody, {
        repeat: { kind: "days", every: 1, private: true },
        timeZone: "UTC",
      }).success,
    ).toBe(false);
  });

  it("keeps occurrence identity safe and permits legacy occurrence dates", () => {
    expect(v.parse(CompleteTaskBody, { expectedOccurrence: -1 })).toEqual({
      expectedOccurrence: -1,
    });
    expect(
      v.parse(SkipTaskBody, {
        expectedOccurrence: 253402300800000,
        timeZone: "UTC",
      }).expectedOccurrence,
    ).toBe(253402300800000);
    expect(
      v.safeParse(CompleteTaskBody, {
        expectedOccurrence: Number.MAX_SAFE_INTEGER + 1,
      }).success,
    ).toBe(false);
    expect(
      v.safeParse(SkipTaskBody, { expectedOccurrence: null, timeZone: "UTC" })
        .success,
    ).toBe(false);
    expect(
      v.safeParse(AddTaskBody, { taskId: "task", text: "Call", date: 0.5 })
        .success,
    ).toBe(false);
  });

  it("keeps the first repeated query value and rejects empty query arrays", () => {
    expect(
      v.parse(PageQuery, { limit: ["20", "5"], cursor: "opaque;cursor" }),
    ).toEqual({ limit: "20", cursor: "opaque;cursor" });
    expect(v.parse(PageQuery, {})).toEqual({});
    expect(v.safeParse(PageQuery, { limit: [] }).success).toBe(false);
  });
});
