import type { AreaFormValue } from "./types";

import { useCreateArea as useCreateAreaCommand } from "../hooks";

export function useCreateArea() {
  const createArea = useCreateAreaCommand();

  return (value: AreaFormValue) =>
    createArea.mutateAsync({
      name: value.name,
      ...(value.standard === undefined ? {} : { standard: value.standard }),
      condition: value.condition,
      icon: value.icon,
    });
}
