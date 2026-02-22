import { useQuery } from "convex-helpers/react/cache/hooks";
import { useRef } from "react";

export const useStableQuery = ((query, ...args) => {
  const result = useQuery(query, ...args);
  const stored = useRef(result);

  // Only overwrite when we have real data, not while loading
  if (result !== undefined) {
    stored.current = result;
  }

  // - First load: undefined
  // - Param changes: keep old data until new data arrives
  return stored.current;
}) as typeof useQuery;
