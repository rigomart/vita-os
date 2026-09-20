import type { PropsWithChildren } from "react";

import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { FeedbackProvider } from "@vita-os/ui/lib/feedback";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApplicationClientProvider } from "../application-client-provider";
import { createQuietApplicationClient } from "../test/fake-application-client";
import { createTestQueryClient } from "../test/render-with-providers";
import { ThemeProvider } from "../theme/theme-provider";
import { SessionGateProvider, type SessionGate } from "../viewer/session-gate";
import { ViewerProvider } from "../viewer/viewer-context";
import { authenticatedRouteTree, productRootRoute } from "./product-route-tree";

// jsdom has no viewport or scrolling; exercise the desktop's side-by-side surfaces.
vi.mock("../hooks/use-thread-pane-viewport", () => ({
  useThreadPaneViewport: () => true,
}));
window.scrollTo = vi.fn();

function AllowSession({ children }: PropsWithChildren) {
  return children;
}

afterEach(cleanup);

async function mountProduct(path: string, gate: SessionGate = AllowSession) {
  const client = createQuietApplicationClient();
  const listAreas = vi.spyOn(client, "listAreas");
  const getThreadDetail = vi.spyOn(client, "getThreadDetail");
  const router = createRouter({
    routeTree: productRootRoute.addChildren([authenticatedRouteTree]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();

  render(
    <ApplicationClientProvider
      client={client}
      queryClient={createTestQueryClient()}
    >
      <ViewerProvider viewer={{ name: "Test Viewer" }} signOut={() => {}}>
        <ThemeProvider>
          <FeedbackProvider>
            <SessionGateProvider gate={gate}>
              <RouterProvider router={router} />
            </SessionGateProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </ViewerProvider>
    </ApplicationClientProvider>,
  );

  return { router, listAreas, getThreadDetail };
}

describe("shared product routes", () => {
  it("mounts the Dashboard without browser authentication or a host route generator", async () => {
    await mountProduct("/");

    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Life Area" }),
    ).toBeInTheDocument();
  });

  it("leaves product reads behind the host's session gate", async () => {
    const { listAreas } = await mountProduct("/", () => (
      <p>Checking session</p>
    ));

    expect(screen.getByText("Checking session")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
    expect(listAreas).not.toHaveBeenCalled();
  });

  it("renders missing Areas through the Area screen", async () => {
    await mountProduct("/missing-area");

    expect(await screen.findByText("Area not found.")).toBeInTheDocument();
  });

  it("opens a Thread deep link and leaves the child route when the pane closes", async () => {
    const { router, getThreadDetail } = await mountProduct("/kitchen/faucet");

    expect(await screen.findByText("Thread not found.")).toBeInTheDocument();
    expect(getThreadDetail).toHaveBeenCalledWith({ slug: "faucet" });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/kitchen"),
    );
    expect(screen.queryByText("Thread not found.")).not.toBeInTheDocument();
  });

  it("lets a search Thread override a deep link and clears both sources on close", async () => {
    const { router, getThreadDetail } = await mountProduct(
      "/kitchen/faucet?thread=roof",
    );

    expect(await screen.findByText("Thread not found.")).toBeInTheDocument();
    expect(getThreadDetail).toHaveBeenCalledWith({ slug: "roof" });
    expect(getThreadDetail).not.toHaveBeenCalledWith({ slug: "faucet" });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/kitchen"),
    );
    expect(router.state.location.search).not.toHaveProperty("thread");
    expect(screen.queryByText("Thread not found.")).not.toBeInTheDocument();
  });

  it.each(["/inbox", "/notes"])(
    "redirects %s to the Notes surface and preserves an open Thread",
    async (path) => {
      const { router } = await mountProduct(`${path}?thread=roof`);

      await waitFor(() => expect(router.state.location.pathname).toBe("/"));
      expect(router.state.location.search).toEqual({
        thread: "roof",
        inbox: true,
      });
      expect(
        await screen.findByRole("dialog", { name: "Notes" }),
      ).toBeInTheDocument();
    },
  );
});
