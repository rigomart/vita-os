import { Button } from "@vita-os/ui/components/button";
import { useState } from "react";

import { STARTER_AREA_NAMES } from "@/features/areas/starter-areas";

interface StarterAreasSuggestionsProps {
  onSelect: (name: string) => Promise<unknown> | unknown;
}

export function StarterAreasSuggestions({
  onSelect,
}: StarterAreasSuggestionsProps) {
  const [pendingName, setPendingName] = useState<string | null>(null);

  const handleSelect = async (name: string) => {
    if (pendingName) return;

    setPendingName(name);
    try {
      await onSelect(name);
    } finally {
      setPendingName(null);
    }
  };

  return (
    <div className="w-full max-w-md space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Starter areas
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {STARTER_AREA_NAMES.map((name) => (
          <Button
            key={name}
            type="button"
            variant="outline"
            size="sm"
            disabled={pendingName !== null}
            aria-busy={pendingName === name}
            onClick={() => void handleSelect(name)}
          >
            {name}
          </Button>
        ))}
      </div>
    </div>
  );
}
