import { act, render, screen } from "@testing-library/react";
import { Suspense, type ComponentType } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useConvexAuth: vi.fn(),
}));

vi.mock("convex/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("convex/react")>()),
  useConvexAuth: mocks.useConvexAuth,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Navigate: ({ to }: { to: string }) => (
    <div data-testid="redirect" data-to={to} />
  ),
  Outlet: () => <div data-testid="outlet" />,
}));

import { Route as AuthenticatedRoute } from "../routes/_authenticated/route";
import { Route as UnauthenticatedRoute } from "../routes/_unauthenticated/route";

const AuthenticatedLayout = AuthenticatedRoute.options
  .component as ComponentType;
const UnauthenticatedLayout = UnauthenticatedRoute.options
  .component as ComponentType;

type PreloadableComponent = ComponentType & { preload?: () => Promise<void> };

beforeAll(async () => {
  await Promise.all(
    [AuthenticatedLayout, UnauthenticatedLayout].map((Component) =>
      (Component as PreloadableComponent).preload?.(),
    ),
  );
});

async function renderRoute(Component: ComponentType) {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <Component />
      </Suspense>,
    );
  });
}

describe("authentication routes", () => {
  it("keeps authenticated content private while the session is checked", async () => {
    mocks.useConvexAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
    });

    await renderRoute(AuthenticatedLayout);

    expect(
      await screen.findByText("Checking your session..."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("redirect")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated visitors to sign in", async () => {
    mocks.useConvexAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    await renderRoute(AuthenticatedLayout);

    expect(await screen.findByTestId("redirect")).toHaveAttribute(
      "data-to",
      "/sign-in",
    );
  });

  it("redirects authenticated visitors away from sign-in routes", async () => {
    mocks.useConvexAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });

    await renderRoute(UnauthenticatedLayout);

    expect(await screen.findByTestId("redirect")).toHaveAttribute(
      "data-to",
      "/",
    );
  });

  it("renders unauthenticated routes for signed-out visitors", async () => {
    mocks.useConvexAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    await renderRoute(UnauthenticatedLayout);

    expect(await screen.findByTestId("outlet")).toBeInTheDocument();
    expect(screen.queryByTestId("redirect")).not.toBeInTheDocument();
  });
});
