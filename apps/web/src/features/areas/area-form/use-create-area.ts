import { api } from "@convex/_generated/api";
import { DEFAULT_CONDITION } from "@convex/lib/condition";
import { useMutation } from "convex/react";

import { optimisticallyCreateArea } from "@/features/areas/optimistic";

import type { AreaFormValue } from "./types";

export function useCreateArea() {
  const createArea = useMutation(api.areas.create).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyCreateArea(localStore, args);
    },
  );

  return (value: AreaFormValue) =>
    createArea({
      name: value.name,
      standard: value.standard,
      condition: value.condition,
    });
}

export function useCreateStarterArea() {
  const createArea = useCreateArea();

  return (name: string) => createArea({ name, condition: DEFAULT_CONDITION });
}
