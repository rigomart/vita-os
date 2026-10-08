import type { UpdateAreaInput } from "@vita-os/contracts";
import type * as v from "valibot";

import { UpdateAreaBody } from "@vita-os/contracts";

/** Only present fields enter the domain patch; absence leaves them alone. */
export function normalizeAreaChange(
  input: v.InferOutput<typeof UpdateAreaBody>,
): Omit<UpdateAreaInput, "areaId"> {
  return {
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.icon === undefined ? {} : { icon: input.icon }),
  };
}
