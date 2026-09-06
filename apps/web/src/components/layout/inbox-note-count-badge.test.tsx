import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InboxNoteCountBadge } from "./inbox-note-count-badge";

describe("InboxNoteCountBadge", () => {
  it("stays hidden while the note count is loading", () => {
    const { container } = render(<InboxNoteCountBadge noteCount={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when there are no Open Notes", () => {
    const { container } = render(<InboxNoteCountBadge noteCount={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Open Note count after it loads", () => {
    render(<InboxNoteCountBadge noteCount={3} />);

    expect(screen.getByLabelText("3 Open Notes")).toHaveTextContent("3");
  });
});
