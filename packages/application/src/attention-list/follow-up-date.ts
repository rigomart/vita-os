/** One name and explanation wherever a Thread or standalone Note resurfaces. */
export const followUpDateLabels = {
  name: "Follow-up date",
  set: "Set follow-up date",
  change: "Change follow-up date",
  clear: "Clear follow-up date",
  hint: "Bring this back into view around this date.",
} as const;

/** A Task's date, set from its row in Thread detail and from a card's date token. */
export const taskDateLabels = {
  set: "Set date",
  change: "Change date",
  clear: "Clear date",
} as const;
