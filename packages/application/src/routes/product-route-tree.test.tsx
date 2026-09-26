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

// The first mount loads every lazy route module and its stylesheets. That
// takes ~1.5s alone and exceeded the 5s default while CI tests all packages at
// once, so these tests get room for the cold start.
describe("shared product routes", { timeout: 20_000 }, () => {
  it("mounts the Dashboard without browser authentication or a host route generator", async () => {
    await mountProduct("/");

    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("Nothing is asking for you."),
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

  it("redirects an old Area page to the Dashboard filtered by that Area", async () => {
    const { router } = await mountProduct("/kitchen");

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(router.state.location.search).toEqual({ area: "kitchen" });
    expect(
      await screen.findByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
  });

  it("redirects an old Thread link to the Thread's own address", async () => {
    const { router, getThreadDetail } = await mountProduct("/kitchen/faucet");

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/threads/faucet"),
    );
    expect(await screen.findByText("Thread not found.")).toBeInTheDocument();
    expect(getThreadDetail).toHaveBeenCalledWith({ slug: "faucet" });
  });

  it("opens a Thread deep link over the Dashboard and returns to it on close", async () => {
    const { router, getThreadDetail } = await mountProduct("/threads/faucet");

    expect(await screen.findByText("Thread not found.")).toBeInTheDocument();
    expect(getThreadDetail).toHaveBeenCalledWith({ slug: "faucet" });
    expect(
      screen.getByRole("heading", { name: "Dashboard" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.queryByText("Thread not found.")).not.toBeInTheDocument();
  });

  it("gives the static threads segment precedence over an Area slug", async () => {
    const { router } = await mountProduct("/threads/faucet");

    await screen.findByText("Thread not found.");
    expect(router.state.location.pathname).toBe("/threads/faucet");
    expect(router.state.location.search).toEqual({});
  });

  it("lets a search Thread override a deep link and clears both sources on close", async () => {
    const { router, getThreadDetail } = await mountProduct(
      "/threads/faucet?thread=roof",
    );

    expect(await screen.findByText("Thread not found.")).toBeInTheDocument();
    expect(getThreadDetail).toHaveBeenCalledWith({ slug: "roof" });
    expect(getThreadDetail).not.toHaveBeenCalledWith({ slug: "faucet" });
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(router.state.location.search).not.toHaveProperty("thread");
    expect(screen.queryByText("Thread not found.")).not.toBeInTheDocument();
  });

  it("keeps the Dashboard filter when a Thread opened in place closes", async () => {
    const { router } = await mountProduct("/?area=kitchen&thread=roof");

    expect(await screen.findByText("Thread not found.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close thread" }));

    await waitFor(() =>
      expect(router.state.location.search).not.toHaveProperty("thread"),
    );
    expect(router.state.location.pathname).toBe("/");
    expect(router.state.location.search).toEqual({ area: "kitchen" });
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
