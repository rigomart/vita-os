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
        variant="ghost"
        size="sm"
        className="h-auto px-0 py-1 text-sm text-muted-foreground hover:bg-transparent hover:text-foreground"
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
      className="min-h-0 max-h-[4.5rem] overflow-y-auto border-0 py-0 text-sm leading-relaxed hover:border-0 hover:bg-transparent focus-visible:border-0 focus-visible:bg-transparent"
      displayClassName="border-0 text-muted-foreground hover:border-0 hover:bg-transparent"
      editorClassName="border-0 hover:border-0 hover:bg-transparent focus-visible:border-0 focus-visible:bg-transparent"
      textareaRows={1}
      inputAriaLabel="Area Standard"
    />
  );
}
