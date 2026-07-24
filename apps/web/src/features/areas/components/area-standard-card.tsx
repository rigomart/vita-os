import { Button } from "@vita-os/ui/components/button";
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
      <Button
        variant="secondary"
        size="xs"
        className="mt-1"
        onClick={() => {
          setExpanded(true);
          setStartEditing(true);
        }}
      >
        Add a Standard…
      </Button>
    );
  }

  return (
    <EditableField
      value={standard}
      onSave={handleSave}
      variant="textarea"
      startEditing={startEditing}
      placeholder="What does 'good enough' look like for this Area?"
      className="text-sm leading-relaxed"
      displayClassName="text-muted-foreground"
      textareaRows={2}
      inputAriaLabel="Area Standard"
    />
  );
}
