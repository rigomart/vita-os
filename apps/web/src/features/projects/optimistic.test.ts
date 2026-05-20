import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
import { getFunctionName } from "convex/server";
import { describe, expect, it } from "vitest";
import {
  buildOptimisticProject,
  completeNextMove,
  optimisticallyUpdateProject,
} from "./optimistic";

function makeProject(
  overrides: Partial<Doc<"projects">> = {},
): Doc<"projects"> {
  return {
    _id: "project1" as Id<"projects">,
    _creationTime: 0,
    userId: "user1",
    name: "Book checkup",
    areaId: "area1" as Id<"areas">,
    order: 0,
    state: "open",
    createdAt: 0,
    ...overrides,
  };
}

function createLocalStore() {
  const entries: Array<{
    query: unknown;
    args: unknown;
    value: unknown;
  }> = [];

  const queryKey = (query: unknown) => getFunctionName(query as never);
  const findEntry = (query: unknown, args: unknown) =>
    entries.find(
      (entry) =>
        entry.query === queryKey(query) &&
        JSON.stringify(entry.args) === JSON.stringify(args),
    );

  return {
    store: {
      getQuery(query: unknown, args: unknown) {
        return findEntry(query, args)?.value;
      },
      setQuery(query: unknown, args: unknown, value: unknown) {
        const entry = findEntry(query, args);
        if (entry) {
          entry.value = value;
        } else {
          entries.push({ query: queryKey(query), args, value });
        }
      },
    } as OptimisticLocalStore,
    set(query: unknown, args: unknown, value: unknown) {
      entries.push({ query: queryKey(query), args, value });
    },
    get(query: unknown, args: unknown) {
      return findEntry(query, args)?.value;
    },
  };
}

describe("Project optimistic updates", () => {
  it("builds optimistic Projects without inventing a slug", () => {
    expect(
      buildOptimisticProject(
        {
          name: "Book checkup",
          definitionOfDone: "Appointment scheduled",
          areaId: "area1" as Id<"areas">,
        },
        { id: "project1" as Id<"projects">, now: 123, order: 4 },
      ),
    ).toEqual({
      _id: "project1",
      _creationTime: 123,
      userId: "",
      name: "Book checkup",
      definitionOfDone: "Appointment scheduled",
      areaId: "area1",
      order: 4,
      state: "open",
      createdAt: 123,
    });
  });

  it("clears the next move when completed", () => {
    const project = makeProject({ nextMove: "Call clinic" });

    expect(completeNextMove(project)).toEqual({
      ...project,
      nextMove: undefined,
    });
  });

  it("resolves Threads out of open lists and clears follow-up details", () => {
    const project = makeProject({
      slug: "book-checkup",
      nextMove: "Call clinic",
      followUp: 123,
    });
    const localStore = createLocalStore();

    localStore.set(api.projects.list, {}, [project]);
    localStore.set(api.projects.listByArea, { areaId: project.areaId }, [
      project,
    ]);
    localStore.set(api.projects.get, { id: project._id }, project);
    localStore.set(api.projects.getBySlug, { slug: "book-checkup" }, project);

    optimisticallyUpdateProject(
      localStore.store,
      {
        id: project._id,
        state: "resolved",
        resolutionNote: "Clinic confirmed no further action",
      },
      { projectSlug: "book-checkup" },
    );

    expect(localStore.get(api.projects.list, {})).toEqual([]);
    expect(
      localStore.get(api.projects.listByArea, { areaId: project.areaId }),
    ).toEqual([]);
    expect(localStore.get(api.projects.get, { id: project._id })).toEqual({
      ...project,
      state: "resolved",
      nextMove: undefined,
      followUp: undefined,
    });
  });
});
