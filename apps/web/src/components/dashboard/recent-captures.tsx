import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { CaptureRow } from "@/components/captures/capture-row";
import { ProcessCaptureDialog } from "@/components/captures/process-capture-dialog";
import { Badge } from "@/components/ui/badge";

const MAX_VISIBLE = 5;

export function RecentCaptures() {
  const captures = useQuery(api.captures.list);
  const areas = useQuery(api.areas.list);
  const projects = useQuery(api.projects.list);
  const processCapture = useMutation(api.captures.process);

  const [processingCapture, setProcessingCapture] = useState<
    Doc<"captures"> | undefined
  >(undefined);

  if (!captures || captures.length === 0) return null;

  const visible = captures.slice(0, MAX_VISIBLE);
  const hasMore = captures.length > MAX_VISIBLE;

  const handleProcess = async (
    captureId: Id<"captures">,
    action:
      | {
          type: "create_project";
          name: string;
          areaId: Id<"areas">;
          description?: string;
          definitionOfDone?: string;
        }
      | { type: "add_to_project"; projectId: Id<"projects"> }
      | { type: "discard" },
  ) => {
    await processCapture({ id: captureId, action });
    setProcessingCapture(undefined);
  };

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-medium">Recent Captures</h2>
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {captures.length}
        </Badge>
      </div>
      <div className="rounded-lg border">
        {visible.map((capture) => (
          <CaptureRow
            key={capture._id}
            capture={capture}
            onProcess={setProcessingCapture}
          />
        ))}
      </div>
      {hasMore && (
        <div className="mt-2 flex justify-end">
          <Link
            to="/inbox"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {processingCapture && (
        <ProcessCaptureDialog
          open={!!processingCapture}
          onOpenChange={(open) => {
            if (!open) setProcessingCapture(undefined);
          }}
          capture={processingCapture}
          areas={areas ?? []}
          projects={projects ?? []}
          onProcess={handleProcess}
        />
      )}
    </div>
  );
}
