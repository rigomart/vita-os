import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InboxDeepLinkRedirect } from "./inbox-deep-link-redirect";

const mocks = vi.hoisted(() => ({
  navigateProps: undefined as
    | { replace?: boolean; search: (previous: object) => object; to: string }
    | undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  Navigate: (props: NonNullable<typeof mocks.navigateProps>) => {
    mocks.navigateProps = props;
    return null;
  },
}));

describe("InboxDeepLinkRedirect", () => {
  it("lands on the Dashboard with the Inbox summoned, keeping an open Thread", () => {
    render(<InboxDeepLinkRedirect />);

    expect(mocks.navigateProps?.to).toBe("/");
    expect(mocks.navigateProps?.replace).toBe(true);
    expect(mocks.navigateProps?.search({ thread: "kitchen-faucet" })).toEqual({
      inbox: true,
      thread: "kitchen-faucet",
    });
  });
});
