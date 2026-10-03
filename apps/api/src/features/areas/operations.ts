import type {
  AreaId,
  AreaSummary,
  CommandAcknowledgement,
  CreateAreaInput,
  UpdateAreaInput,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { generateSlug, slugify, validateAreaName } from "@vita-os/core";
import { Effect } from "effect";

import type { RequestRefusal } from "../../platform/http/errors";
import type { AreaChanges } from "./storage";

import {
  attempt,
  changeConflict,
  database,
  failed,
  succeeded,
} from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { areaNotFound, areaOrderMismatch } from "./errors";
import { areaStorage, isAreaSlugTaken } from "./storage";

/** Three total attempts; only slug collisions and concurrent renames retry. */
const ATTEMPTS = 3;

export function listAreas(): Effect.Effect<
  AreaSummary[],
  RequestRefusal,
  RequestContext
> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* database(() => areaStorage(scope).list());
  });
}

/** A name that reads as an existing slug selects the owner's existing Area. */
export function createArea(
  input: CreateAreaInput,
): Effect.Effect<AreaSummary, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const areas = areaStorage(scope);
    const name = yield* attempt(() => validateAreaName(input.name));
    const base = yield* attempt(() => slugify(name));
    const listed = yield* database(() => areas.list());
    const existing = yield* attempt(() =>
      listed.find((area) => slugify(area.name) === base),
    );
    if (existing !== undefined) return existing;

    for (let execution = 0; execution < ATTEMPTS; execution += 1) {
      const slug = yield* attempt(() => generateSlug(name));
      const area = yield* database(() =>
        areas.insert({ name, icon: input.icon, slug }),
      ).pipe(
        Effect.catch((error) =>
          isAreaSlugTaken(error.cause)
            ? succeeded(undefined)
            : Effect.fail(error),
        ),
      );
      if (area === undefined) continue;
      if (area === null) return yield* failed(changeConflict);
      return area;
    }
    return yield* failed(changeConflict);
  });
}

/** Re-read before every conditional rename so concurrent changes are decided again. */
export function updateArea({
  areaId,
  ...requested
}: UpdateAreaInput): Effect.Effect<
  AreaSummary,
  RequestRefusal,
  RequestContext
> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const areas = areaStorage(scope);
    for (let execution = 0; execution < ATTEMPTS; execution += 1) {
      const existing = yield* database(() => areas.find(areaId));
      if (existing === null) return yield* failed(areaNotFound);
      const name =
        requested.name === undefined
          ? undefined
          : yield* attempt(() => validateAreaName(requested.name!));
      const slug =
        name !== undefined && name !== existing.name
          ? yield* attempt(() => generateSlug(name))
          : undefined;
      const changes: AreaChanges = {
        ...(name === undefined ? {} : { name }),
        ...(slug === undefined ? {} : { slug }),
        ...(requested.icon === undefined ? {} : { icon: requested.icon }),
      };
      if (Object.keys(changes).length === 0) return existing;
      const updated = yield* database(() =>
        areas.update(areaId, existing.name, changes),
      ).pipe(
        Effect.catch((error) =>
          isAreaSlugTaken(error.cause) ? succeeded(null) : Effect.fail(error),
        ),
      );
      if (updated !== null) return updated;
    }
    return yield* failed(changeConflict);
  });
}

/** The order must name exactly the owner's Areas, each once. */
export function reorderAreas(input: {
  areaIds: AreaId[];
}): Effect.Effect<AreaSummary[], RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const areas = areaStorage(scope);
    const listed = yield* database(() => areas.list());
    const owned = new Set(listed.map((area) => area._id));
    const requested = new Set(input.areaIds);
    if (
      requested.size !== input.areaIds.length ||
      requested.size !== owned.size ||
      input.areaIds.some((areaId) => !owned.has(areaId))
    ) {
      return yield* failed(areaOrderMismatch);
    }
    yield* database(() => areas.reorder(input.areaIds));
    return yield* database(() => areas.list());
  });
}

/** Native D1 keeps Area deletion and removal of its Thread labels atomic. */
export function removeArea(input: {
  areaId: AreaId;
}): Effect.Effect<CommandAcknowledgement, RequestRefusal, RequestContext> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const removed = yield* database(() =>
      areaStorage(scope).removeClearingLabels(input.areaId),
    );
    return yield* removed
      ? succeeded(commandAcknowledged)
      : failed(areaNotFound);
  });
}
