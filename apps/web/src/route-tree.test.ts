import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "./routeTree.gen";

function createTestRouter() {
  return createRouter({
    routeTree,
    history: createMemoryHistory(),
  });
}

describe("route tree", () => {
  it.each([
    ["/", ["__root__", "/_authenticated", "/_authenticated/"]],
    [
      "/family-health",
      [
        "__root__",
        "/_authenticated",
        "/_authenticated/$areaSlug",
        "/_authenticated/$areaSlug/",
      ],
    ],
    [
      "/family-health/annual-checkup",
      [
        "__root__",
        "/_authenticated",
        "/_authenticated/$areaSlug",
        "/_authenticated/$areaSlug/$threadSlug",
      ],
    ],
    ["/inbox", ["__root__", "/_authenticated", "/_authenticated/inbox"]],
    [
      "/sign-in",
      ["__root__", "/_unauthenticated", "/_unauthenticated/sign-in"],
    ],
    [
      "/sign-up",
      ["__root__", "/_unauthenticated", "/_unauthenticated/sign-up"],
    ],
  ])("matches %s to the expected route chain", (path, expectedRouteIds) => {
    const matches = createTestRouter().matchRoutes(path);

    expect(matches.map((match) => match.routeId)).toEqual(expectedRouteIds);
  });

  it("preserves Area and Thread slug parameters on deep links", () => {
    const matches = createTestRouter().matchRoutes(
      "/family-health/annual-checkup",
    );

    expect(matches.at(-1)?.params).toEqual({
      areaSlug: "family-health",
      threadSlug: "annual-checkup",
    });
  });

  it.each([
    "/_authenticated",
    "/_authenticated/",
    "/_authenticated/inbox",
    "/_authenticated/$areaSlug",
    "/_authenticated/$areaSlug/",
    "/_authenticated/$areaSlug/$threadSlug",
  ] as const)("keeps an error component on %s", (routeId) => {
    const router = createTestRouter();

    expect(router.routesById[routeId].options.errorComponent).toBeDefined();
  });
});
