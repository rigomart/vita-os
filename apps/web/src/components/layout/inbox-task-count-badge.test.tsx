import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InboxTaskCountBadge } from "./inbox-task-count-badge";

describe("InboxTaskCountBadge", () => {
  it("stays hidden while the task count is loading", () => {
    const { container } = render(<InboxTaskCountBadge taskCount={undefined} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("stays hidden when there are no Open Tasks", () => {
    const { container } = render(<InboxTaskCountBadge taskCount={0} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Open Task count after it loads", () => {
    render(<InboxTaskCountBadge taskCount={3} />);

    expect(screen.getByLabelText("3 Open Tasks")).toHaveTextContent("3");
  });
});
