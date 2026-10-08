import type { SetTaskRepeatInput, UpdateThreadInput } from "@vita-os/contracts";

import {
  AddTaskBody as ContractAddTaskBody,
  CompleteTaskBody as ContractCompleteTaskBody,
  RequestRepeatSchema,
  SetTaskDateBody as ContractSetTaskDateBody,
  SetTaskRepeatBody as ContractSetTaskRepeatBody,
  SkipTaskBody as ContractSkipTaskBody,
  UpdateThreadBody,
  Timestamp,
} from "@vita-os/contracts";
import {
  MAX_TASK_DATE,
  MIN_TASK_DATE,
  requireRepeat,
  requireTaskId,
  requireTimeZone,
} from "@vita-os/core";
import * as v from "valibot";

/** New dates use core's whole-millisecond 1970–9999 bounds. */
export const TaskDateSchema = v.pipe(
  Timestamp,
  v.minValue(MIN_TASK_DATE),
  v.maxValue(MAX_TASK_DATE),
);
const TimeZoneSchema = v.pipe(
  v.string(),
  v.check((value) => {
    try {
      requireTimeZone(value);
      return true;
    } catch {
      return false;
    }
  }),
);
export const AddTaskBody = v.strictObject({
  ...ContractAddTaskBody.entries,
  date: v.optional(TaskDateSchema),
});
export const SetTaskDateBody = v.strictObject({
  ...ContractSetTaskDateBody.entries,
  date: v.nullable(TaskDateSchema),
  timeZone: v.optional(TimeZoneSchema),
});
export const CompleteTaskBody = v.strictObject({
  ...ContractCompleteTaskBody.entries,
  timeZone: v.optional(TimeZoneSchema),
  note: v.optional(
    v.strictObject({
      ...ContractCompleteTaskBody.entries.note.wrapped.entries,
      id: v.pipe(
        ContractCompleteTaskBody.entries.note.wrapped.entries.id,
        v.check((value) => {
          try {
            requireTaskId(value);
            return true;
          } catch {
            return false;
          }
        }),
      ),
    }),
  ),
});
export const RepeatSchema = v.pipe(
  RequestRepeatSchema,
  v.check((value) => {
    try {
      requireRepeat(value);
      return true;
    } catch {
      return false;
    }
  }),
);
export const SetTaskRepeatBody = v.strictObject({
  ...ContractSetTaskRepeatBody.entries,
  repeat: v.nullable(RepeatSchema),
  timeZone: TimeZoneSchema,
});
export const SkipTaskBody = v.strictObject({
  ...ContractSkipTaskBody.entries,
  timeZone: TimeZoneSchema,
});

export function normalizeSetTaskRepeat(
  input: v.InferOutput<typeof SetTaskRepeatBody>,
): Omit<SetTaskRepeatInput, "threadId" | "taskId"> {
  return {
    ...input,
    repeat: input.repeat === null ? null : requireRepeat(input.repeat),
  };
}
/** Only present clearable fields enter the patch; absent fields stay unchanged. */
export function normalizeThreadChange(
  input: v.InferOutput<typeof UpdateThreadBody>,
): Omit<UpdateThreadInput, "threadId"> {
  return {
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(Object.hasOwn(input, "summary") ? { summary: input.summary } : {}),
    ...(Object.hasOwn(input, "areaId") ? { areaId: input.areaId } : {}),
    ...(input.state === undefined ? {} : { state: input.state }),
    ...(input.resolutionNote === undefined
      ? {}
      : { resolutionNote: input.resolutionNote }),
  };
}
