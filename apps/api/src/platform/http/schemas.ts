import type { ApplicationError, PageRequest } from "@vita-os/contracts";

import { Result } from "better-result";

import { invalidPagination } from "../d1/page-cursor";
import { decodeLimit, type PageSize } from "./decode";
import { RequestRefusal } from "./errors";

export function pageRequest(
  query: { readonly limit?: string; readonly cursor?: string },
  size: PageSize,
  invalid: ApplicationError = invalidPagination,
): Result<PageRequest, RequestRefusal> {
  const limit = decodeLimit(query.limit, size);
  if (limit === undefined) return Result.err(new RequestRefusal(invalid));
  return Result.ok({
    limit,
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
  });
}
