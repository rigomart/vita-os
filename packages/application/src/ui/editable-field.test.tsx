import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { render, screen } from "../test/render-with-providers";
import { EditableField } from "./editable-field";

describe("EditableField focus", () => {
  for (const key of ["{Enter}", "{Escape}", "{Tab}"]) {
    it(`${key} ${key === "{Tab}" ? "keeps focus on the next control" : "returns focus to the display button"}`, async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <>
          <EditableField value="Thread title" onSave={onSave} />
          <button type="button">Next</button>
        </>,
      );
      await user.click(screen.getByRole("button", { name: "Thread title" }));
      await user.keyboard(` changed${key}`);
      expect(
        screen.getByRole("button", {
          name: key === "{Tab}" ? "Next" : "Thread title",
        }),
      ).toHaveFocus();
      expect(onSave).toHaveBeenCalledTimes(key === "{Escape}" ? 0 : 1);
    });
  }
});
