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

import type { Operation } from "../../platform/operation";
import type { AreaChanges } from "./storage";

import { ChangeConflict } from "../../platform/failures";
import { attempt, database } from "../../platform/operation";
import { RequestContext } from "../../platform/request-scope";
import { areaNotFound, areaOrderMismatch } from "./errors";
import { areaStorage, isAreaSlugTaken } from "./storage";

/**
 * How many times a create or change re-mints a slug, or re-reads an Area that
 * moved underneath it, before giving up.
 *
 * Slugs carry eight hex characters of randomness and are unique per owner, so a
 * collision is already improbable; retrying twice makes it unreachable in
 * practice without leaving the uniqueness invariant to chance.
 */
const ATTEMPTS = 3;

export function listAreas(): Operation<AreaSummary[]> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    return yield* database(() => areaStorage(scope).list());
  });
}

/**
 * Create an Area, or return the owner's existing Area whose name reads as the
 * same slug. That is what lets a picker create on type: typing "health" when
 * "Health" exists picks it instead of adding a duplicate.
 */
export function createArea(input: CreateAreaInput): Operation<AreaSummary> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const areas = areaStorage(scope);
    const name = yield* attempt(() => validateAreaName(input.name));

    const base = slugify(name);
    const listed = yield* database(() => areas.list());
    const existing = listed.find((area) => slugify(area.name) === base);
    if (existing !== undefined) return existing;

    for (let execution = 0; execution < ATTEMPTS; execution += 1) {
      const slug = generateSlug(name);
      const area = yield* database(
        () => areas.insert({ name, icon: input.icon, slug }),
        isAreaSlugTaken,
      ).pipe(Effect.catchTag("SlugTaken", () => Effect.succeed(undefined)));
      if (area === undefined) continue;
      if (area === null) return yield* new ChangeConflict();
      return area;
    }
    return yield* new ChangeConflict();
  });
}

/**
 * Rename or re-icon an Area. A rename mints a new slug, so the caller reads
 * the slug back rather than assuming an old link still names it.
 *
 * Whether a change is a rename depends on the name as read, so the write is
 * conditional on that name and a concurrent rename is decided again.
 */
export function updateArea({
  areaId,
  ...requested
}: UpdateAreaInput): Operation<AreaSummary> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const areas = areaStorage(scope);

    for (let execution = 0; execution < ATTEMPTS; execution += 1) {
      const existing = yield* database(() => areas.find(areaId));
      if (existing === null) return yield* areaNotFound();

      const name =
        requested.name === undefined
          ? undefined
          : yield* attempt(() => validateAreaName(requested.name!));
      const changes: AreaChanges = {
        ...(name === undefined ? {} : { name }),
        ...(name !== undefined && name !== existing.name
          ? { slug: generateSlug(name) }
          : {}),
        ...(requested.icon === undefined ? {} : { icon: requested.icon }),
      };
      if (Object.keys(changes).length === 0) return existing;

      const updated = yield* database(
        () => areas.update(areaId, existing.name, changes),
        isAreaSlugTaken,
      ).pipe(Effect.catchTag("SlugTaken", () => Effect.succeed(null)));
      if (updated !== null) return updated;
    }
    return yield* new ChangeConflict();
  });
}

/** Put the owner's Areas in the given order. The list must name each once. */
export function reorderAreas(input: {
  areaIds: AreaId[];
}): Operation<AreaSummary[]> {
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
      return yield* areaOrderMismatch();
    }

    yield* database(() => areas.reorder(input.areaIds));
    return yield* database(() => areas.list());
  });
}

/**
 * Delete an Area. It never waits on its Threads: they lose the label and stay
 * as they are.
 */
export function removeArea(input: {
  areaId: AreaId;
}): Operation<CommandAcknowledgement> {
  return Effect.gen(function* () {
    const scope = yield* RequestContext;
    const removed = yield* database(() =>
      areaStorage(scope).removeClearingLabels(input.areaId),
    );
    if (!removed) return yield* areaNotFound();
    return commandAcknowledged;
  });
}
