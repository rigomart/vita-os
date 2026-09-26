import type {
  AreaId,
  CreateAreaInput,
  UpdateAreaInput,
} from "@vita-os/contracts";

import { isAreaIcon } from "@vita-os/core";

import type { Decoded } from "../../platform/http/decode";

import {
  hasOnlyKeys,
  isNonEmptyString,
  isObject,
} from "../../platform/http/decode";

const AREA_KEYS = ["name", "icon"] as const;

export function decodeCreateArea(value: unknown): Decoded<CreateAreaInput> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, AREA_KEYS) ||
    typeof value.name !== "string" ||
    !isAreaIcon(value.icon)
  ) {
    return undefined;
  }

  return { name: value.name, icon: value.icon };
}

export function decodeUpdateArea(
  value: unknown,
): Decoded<Omit<UpdateAreaInput, "areaId">> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, AREA_KEYS) ||
    (value.name !== undefined && typeof value.name !== "string") ||
    (value.icon !== undefined && !isAreaIcon(value.icon))
  ) {
    return undefined;
  }

  return {
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(value.icon === undefined ? {} : { icon: value.icon }),
  };
}

export function decodeAreaOrder(
  value: unknown,
): Decoded<{ areaIds: AreaId[] }> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["areaIds"]) ||
    !Array.isArray(value.areaIds) ||
    !value.areaIds.every(isNonEmptyString)
  ) {
    return undefined;
  }

  return { areaIds: value.areaIds as AreaId[] };
}
