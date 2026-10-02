import type { ApplicationClient, Note } from "@vita-os/contracts";

import { QueryClient } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ApplicationClientProvider } from "@vita-os/application";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { StrictMode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { pendingShareKey, receiveSharedNote } from "./pending-share";
import { SharedNoteCapture } from "./shared-note-capture";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function mountCapture(createNote: ApplicationClient["createNote"]) {
  render(
    <StrictMode>
      <ApplicationClientProvider
        client={{ createNote } as ApplicationClient}
        queryClient={
          new QueryClient({ defaultOptions: { mutations: { retry: false } } })
        }
      >
        <FeedbackProvider>
          <SharedNoteCapture>
            <p>Dashboard ready</p>
          </SharedNoteCapture>
        </FeedbackProvider>
      </ApplicationClientProvider>
    </StrictMode>,
  );
}

const note = {
  _id: "note-shared",
  body: "Shared thought",
  state: "open",
  createdAt: 1,
  updatedAt: 1,
} as Note;

describe("shared Note capture", () => {
  it("keeps an earlier unsaved share when another share arrives", async () => {
    sessionStorage.setItem(pendingShareKey, JSON.stringify(["First thought"]));
    window.history.replaceState(null, "", "/share-target?text=Second+thought");
    receiveSharedNote();
    const bodies: string[] = [];
    mountCapture(async (input) => {
      bodies.push(input.body);
      return { ok: true, value: { ...note, body: input.body } };
    });
    await screen.findByText("Dashboard ready");
    expect(bodies).toEqual(["First thought", "Second thought"]);
    expect(sessionStorage.getItem(pendingShareKey)).toBeNull();
  });
  it("saves once even with Strict Mode and clears the pending share only after success", async () => {
    sessionStorage.setItem(pendingShareKey, JSON.stringify(["Shared thought"]));
    const bodies: string[] = [];
    mountCapture(async (input) => {
      bodies.push(input.body);
      return { ok: true, value: note };
    });
    await screen.findByText("Dashboard ready");
    await waitFor(() =>
      expect(sessionStorage.getItem(pendingShareKey)).toBeNull(),
    );
    expect(bodies).toEqual(["Shared thought"]);
  });

  it("preserves failed text and lets the user retry", async () => {
    sessionStorage.setItem(pendingShareKey, JSON.stringify(["Shared thought"]));
    let attempts = 0;
    mountCapture(async () => {
      attempts += 1;
      return attempts === 1
        ? {
            ok: false,
            error: {
              code: "unavailable",
              message: "Network unavailable",
              retryable: true,
            },
          }
        : { ok: true, value: note };
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be saved",
    );
    expect(screen.getByText("Shared thought")).toBeInTheDocument();
    expect(sessionStorage.getItem(pendingShareKey)).toBe(
      JSON.stringify(["Shared thought"]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText("Dashboard ready");
    expect(attempts).toBe(2);
    expect(sessionStorage.getItem(pendingShareKey)).toBeNull();
  });

  it("does not create anything on an ordinary launch", async () => {
    let attempts = 0;
    mountCapture(async () => {
      attempts += 1;
      return { ok: true, value: note };
    });
    expect(await screen.findByText("Dashboard ready")).toBeInTheDocument();
    expect(attempts).toBe(0);
  });
});
