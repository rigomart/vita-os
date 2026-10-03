import { useNavigate } from "@tanstack/react-router";

import type { ProductSearch } from "./search-params";

/** Open a Thread's pane over the current page (ADR 0007). */
export function useOpenThreadInPlace() {
  const navigate = useNavigate();

  return (slug: string) => {
    void navigate({
      to: ".",
      search: (prev: ProductSearch): ProductSearch => ({
        ...prev,
        thread: slug,
      }),
    });
  };
}
