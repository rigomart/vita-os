import { render, screen, waitFor } from "@testing-library/react";
import { useOpenNotes } from "@vita-os/application";
import { describe, expect, it, vi } from "vitest";

import {
  createFakeApplicationClient,
  success,
} from "../../../../packages/application/src/test/fake-application-client";
import { aNote } from "../../../../packages/application/src/test/fixtures";
import { SignedInApplication } from "./signed-in-application";

const session = vi.hoisted(() => ({
  user: { id: "alice", name: "Alice" } as
    | { id: string; name: string }
    | undefined,
}));
vi.mock("../lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: { user: session.user } }),
    signOut: vi.fn(),
  },
}));

function Notes() {
  const notes = useOpenNotes();
  return (
    <div>{notes.data?.map((note) => note.body).join(",") ?? "Loading"}</div>
  );
}

describe("signed-in application", () => {
  it("never shows the previous account's cached notes while the next account loads", async () => {
    session.user = { id: "alice", name: "Alice" };
    const client = createFakeApplicationClient({
      listOpenNotes: () =>
        session.user?.id === "alice"
          ? Promise.resolve(success([aNote({ body: "Alice private note" })]))
          : new Promise(() => {}),
    });
    const view = render(
      <SignedInApplication client={client}>
        <Notes />
      </SignedInApplication>,
    );
    await screen.findByText("Alice private note");
    session.user = { id: "bob", name: "Bob" };
    view.rerender(
      <SignedInApplication client={client}>
        <Notes />
      </SignedInApplication>,
    );
    await waitFor(() =>
      expect(screen.queryByText("Alice private note")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });
});
