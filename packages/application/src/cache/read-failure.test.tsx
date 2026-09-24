import type { ApplicationError } from "@vita-os/contracts";
import type { ReactNode } from "react";

import { describe, expect, it, vi } from "vitest";

import { DashboardScreen } from "../dashboard/screens/dashboard-screen";
import { AppErrorBoundary } from "../layout/error-boundary";
import {
  createFakeApplicationClient,
  success,
} from "../test/fake-application-client";
import { anArea, aNote, aThread } from "../test/fixtures";
import { render, screen, waitFor } from "../test/render-with-providers";

/**
 * A read that keeps failing has to say so.
 *
 * Before the cloud migration a failed read threw out of the query hook and was
 * caught by the nearest boundary. A screen that instead treats "no data yet" as
 * "still loading" would show a skeleton forever, which is the one failure the
 * person cannot act on — so this guards the behavior rather than the mechanism.
 */
const unavailable: ApplicationError = {
  code: "unavailable",
  message: "The service is temporarily unavailable.",
  retryable: true,
};

// The board links to Areas; the harness still needs the real router around it.
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children?: ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock("../areas/area-form/create-area-dialog", () => ({
  CreateAreaDialog: () => null,
}));

describe("a failed read", () => {
  it("reaches the error boundary instead of showing a skeleton forever", async () => {
    // React logs the boundary's catch; the test is about what the person sees.
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const client = createFakeApplicationClient({
      listAreas: async () => ({ ok: false, error: unavailable }),
      listOpenThreads: async () => success([aThread()]),
      listOpenNotes: async () => success([aNote()]),
    });

    render(
      <AppErrorBoundary>
        <DashboardScreen />
      </AppErrorBoundary>,
      { applicationClient: client },
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /Something went wrong/,
      ),
    );
    expect(
      screen.queryByTestId("dashboard-overview-skeleton"),
    ).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("still shows the screen when every read answers", async () => {
    const client = createFakeApplicationClient({
      listAreas: async () => success([anArea()]),
      listOpenThreads: async () => success([aThread()]),
      listOpenNotes: async () => success([aNote()]),
    });

    render(
      <AppErrorBoundary>
        <DashboardScreen />
      </AppErrorBoundary>,
      { applicationClient: client },
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("dashboard-overview-skeleton"),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
