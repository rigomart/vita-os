import { useCreateArea as useCreateAreaCommand } from "@vita-os/application";

import type { AreaFormValue } from "./types";

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
