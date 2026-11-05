import { cn } from "@vita-os/ui/lib/utils";

/** The dog-eared sheet that marks a Note wherever it is listed. */
export function NoteMarker({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block h-2.5 w-2 rounded-[1.5px] border border-muted-foreground/60 [clip-path:polygon(0_0,55%_0,100%_40%,100%_100%,0_100%)]",
        className,
      )}
    />
  );
}
