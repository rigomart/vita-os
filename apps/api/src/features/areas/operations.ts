import type {
  AreaDetail,
  AreaId,
  AreaSummary,
  CommandAcknowledgement,
  CreateAreaInput,
  OperationResult,
  UpdateAreaInput,
} from "@vita-os/contracts";

import { commandAcknowledged } from "@vita-os/contracts";
import { generateSlug, validateAreaName } from "@vita-os/core";

import type { RequestScope } from "../../platform/request-scope";
import type { AreaChanges } from "./storage";

import { changeConflict, failed, succeeded } from "../../platform/operation";
import { areaHasThreads, areaNotFound } from "./errors";
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

export async function getAreaDetail(
  scope: RequestScope,
  input: { slug: string },
): Promise<OperationResult<AreaDetail>> {
  const detail = await areaStorage(scope).findDetail(input.slug);
  return detail === null ? failed(areaNotFound) : succeeded(detail);
}

export async function createArea(
  scope: RequestScope,
  input: CreateAreaInput,
): Promise<OperationResult<AreaSummary>> {
  const areas = areaStorage(scope);
  const name = validateAreaName(input.name);

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    try {
      const area = await areas.insert({
        ...input,
        name,
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
 * Rename, restandardize, recondition, or re-icon an Area. A rename mints a new
 * slug, so the caller reads the slug back rather than assuming its own route
 * still resolves.
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
      ...(requested.standard === undefined
        ? {}
        : { standard: requested.standard }),
      ...(requested.condition === undefined
        ? {}
        : { condition: requested.condition }),
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

/**
 * Delete an empty Area. The delete itself refuses both a missing Area and one
 * that still holds Threads, so a second read tells the two apart.
 */
export async function removeArea(
  scope: RequestScope,
  input: { areaId: AreaId },
): Promise<OperationResult<CommandAcknowledgement>> {
  const areas = areaStorage(scope);
  if (await areas.removeIfEmpty(input.areaId)) {
    return succeeded(commandAcknowledged);
  }

  return (await areas.exists(input.areaId))
    ? failed(areaHasThreads)
    : failed(areaNotFound);
}
