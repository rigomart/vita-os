import { describe, expect, it } from "vitest";

import { getActivityLogEntryLabel } from "./activity-log-entry";

describe("getActivityLogEntryLabel", () => {
  it("uses user-facing labels instead of implementation type names", () => {
    expect(getActivityLogEntryLabel("note")).toBe("Note");
    expect(getActivityLogEntryLabel("next_action_change")).toBe("Next move");
    expect(getActivityLogEntryLabel("state_change")).toBe("Lifecycle");
    expect(getActivityLogEntryLabel("area_move")).toBe("Area");
    expect(getActivityLogEntryLabel("follow_up_change")).toBe("Follow-up");
  });
});
