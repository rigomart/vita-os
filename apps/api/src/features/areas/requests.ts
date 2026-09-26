import type { CreateAreaInput, UpdateAreaInput } from "@vita-os/contracts";

import { isAreaIcon, isCondition } from "@vita-os/core";

import type { Decoded } from "../../platform/http/decode";

import {
  hasOnlyKeys,
  isClearableString,
  isObject,
} from "../../platform/http/decode";

const AREA_KEYS = ["name", "standard", "condition", "icon"] as const;

export function decodeCreateArea(value: unknown): Decoded<CreateAreaInput> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, AREA_KEYS) ||
    typeof value.name !== "string" ||
    !isCondition(value.condition) ||
    !isAreaIcon(value.icon) ||
    (value.standard !== undefined && typeof value.standard !== "string")
  ) {
    return undefined;
  }

  return {
    name: value.name,
    ...(value.standard === undefined ? {} : { standard: value.standard }),
    condition: value.condition,
    icon: value.icon,
  };
}

export function decodeUpdateArea(
  value: unknown,
): Decoded<Omit<UpdateAreaInput, "areaId">> {
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, AREA_KEYS) ||
    (value.name !== undefined && typeof value.name !== "string") ||
    (Object.hasOwn(value, "standard") && !isClearableString(value.standard)) ||
    (value.condition !== undefined && !isCondition(value.condition)) ||
    (value.icon !== undefined && !isAreaIcon(value.icon))
  ) {
    return undefined;
  }

  return {
    ...(value.name === undefined ? {} : { name: value.name }),
    ...(Object.hasOwn(value, "standard")
      ? { standard: value.standard as string | null }
      : {}),
    ...(value.condition === undefined ? {} : { condition: value.condition }),
    ...(value.icon === undefined ? {} : { icon: value.icon }),
  };
}
