import { useEffect, useState } from "react";

import { EditableField } from "@/components/ui/editable-field";

interface AreaStandardCardProps {
  standard: string;
  onSave: (standard: string) => void;
}

export function AreaStandardCard({ standard, onSave }: AreaStandardCardProps) {
  const [expanded, setExpanded] = useState(Boolean(standard));
  const [startEditing, setStartEditing] = useState(false);

  useEffect(() => {
    if (standard) {
      setExpanded(true);
    }
  }, [standard]);

  const handleSave = (value: string) => {
    onSave(value);
    if (!value.trim()) {
      setExpanded(false);
    }
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => {
          setExpanded(true);
          setStartEditing(true);
        }}
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        Add standard
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Standard
        <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">
          (optional)
        </span>
      </h2>
      <EditableField
        value={standard}
        onSave={handleSave}
        variant="textarea"
        startEditing={startEditing}
        placeholder="What does 'good enough' look like for this area?"
        className="text-sm leading-relaxed"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        The maintenance threshold, not an aspirational goal.
      </p>
    </div>
  );
}
