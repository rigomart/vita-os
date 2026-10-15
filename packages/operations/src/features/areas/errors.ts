import { NotFound, RefusedByState } from "../../platform/failures";

export const areaNotFound = () => new NotFound({ message: "Area not found." });

/**
 * A reorder names the owner's whole Area list. A list that has since gained or
 * lost an Area would silently misplace it, so it is refused instead.
 */
export const areaOrderMismatch = () =>
  new RefusedByState({
    message: "The Area order must name every Area exactly once.",
  });
