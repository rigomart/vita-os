import { format } from "date-fns";
import { CalendarIcon, X } from "lucide-react";
import { useState } from "react";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DatePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <div className={cn("flex items-center gap-1", className)}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              className={cn(
                "h-7 justify-start gap-1.5 px-2 text-xs font-normal",
                !value && "text-muted-foreground",
              )}
            />
          }
        >
          <CalendarIcon className="h-3 w-3" />
          {value ? format(value, "MMM d, yyyy") : placeholder}
        </PopoverTrigger>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            disabled={disabled}
            onClick={() => onChange(undefined)}
            aria-label="Clear date"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange(date);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
