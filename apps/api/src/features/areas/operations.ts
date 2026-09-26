import type {
  AreaId,
  AreaSummary,
  CommandAcknowledgement,
  CreateAreaInput,
  OperationResult,
  UpdateAreaInput,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { generateSlug, slugify, validateAreaName } from "@vita-os/core";

import type { RequestScope } from "../../platform/request-scope";
import type { AreaChanges } from "./storage";

import { changeConflict, failed, succeeded } from "../../platform/operation";
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

export async function listAreas(
  scope: RequestScope,
): Promise<OperationResult<AreaSummary[]>> {
  return succeeded(await areaStorage(scope).list());
}

/**
 * Create an Area, or return the owner's existing Area whose name reads as the
 * same slug. That is what lets a picker create on type: typing "health" when
 * "Health" exists picks it instead of adding a duplicate.
 */
export async function createArea(
  scope: RequestScope,
  input: CreateAreaInput,
): Promise<OperationResult<AreaSummary>> {
  const areas = areaStorage(scope);
  const name = validateAreaName(input.name);

  const base = slugify(name);
  const existing = (await areas.list()).find(
    (area) => slugify(area.name) === base,
  );
  if (existing !== undefined) return succeeded(existing);

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const area = await areas.insert({
        name,
        icon: input.icon,
        slug: generateSlug(name),
      });
      if (area === null) return failed(changeConflict);

      return succeeded(area);
    } catch (error) {
      if (!isAreaSlugTaken(error)) throw error;
    }
  }

  return failed(changeConflict);
}

/**
 * Rename or re-icon an Area. A rename mints a new slug, so the caller reads
 * the slug back rather than assuming an old link still names it.
 *
 * Whether a change is a rename depends on the name as read, so the write is
 * conditional on that name and a concurrent rename is decided again.
 */
export async function updateArea(
  scope: RequestScope,
  { areaId, ...requested }: UpdateAreaInput,
): Promise<OperationResult<AreaSummary>> {
  const areas = areaStorage(scope);

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const existing = await areas.find(areaId);
    if (existing === null) return failed(areaNotFound);

    const name =
      requested.name === undefined
        ? undefined
        : validateAreaName(requested.name);
    const changes: AreaChanges = {
      ...(name === undefined ? {} : { name }),
      ...(name !== undefined && name !== existing.name
        ? { slug: generateSlug(name) }
        : {}),
      ...(requested.icon === undefined ? {} : { icon: requested.icon }),
    };
    if (Object.keys(changes).length === 0) return succeeded(existing);

    try {
      const updated = await areas.update(areaId, existing.name, changes);
      if (updated !== null) return succeeded(updated);
    } catch (error) {
      if (!isAreaSlugTaken(error)) throw error;
    }
  }

  return failed(changeConflict);
}

/** Put the owner's Areas in the given order. The list must name each once. */
export async function reorderAreas(
  scope: RequestScope,
  input: { areaIds: AreaId[] },
): Promise<OperationResult<AreaSummary[]>> {
  const areas = areaStorage(scope);
  const owned = new Set((await areas.list()).map((area) => area._id));
  const requested = new Set(input.areaIds);
  if (
    requested.size !== input.areaIds.length ||
    requested.size !== owned.size ||
    input.areaIds.some((areaId) => !owned.has(areaId))
  ) {
    return failed(areaOrderMismatch);
  }

  await areas.reorder(input.areaIds);
  return succeeded(await areas.list());
}

/**
 * Delete an Area. It never waits on its Threads: they lose the label and stay
 * as they are.
 */
export async function removeArea(
  scope: RequestScope,
  input: { areaId: AreaId },
): Promise<OperationResult<CommandAcknowledgement>> {
  return (await areaStorage(scope).removeClearingLabels(input.areaId))
    ? succeeded(commandAcknowledged)
    : failed(areaNotFound);
}
