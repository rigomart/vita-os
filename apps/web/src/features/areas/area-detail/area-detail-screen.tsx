import { api } from "@convex/_generated/api";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { useState } from "react";

import { EditAreaDialog } from "@/features/areas/area-form/edit-area-dialog";
import { AreaDetailSkeleton } from "@/features/areas/components/area-detail-skeleton";
import { AreaHeaderSection } from "@/features/areas/components/area-header-section";
import { AreaStandardCardSection } from "@/features/areas/components/area-standard-card-section";
import { AreaThreadsSection } from "@/features/areas/components/area-threads-section";
import { CreateThreadDialog } from "@/features/threads/thread-form/create-thread-dialog";
import { useDocumentTitle } from "@/hooks/use-document-title";

import { AreaNotFound } from "./area-not-found";

interface AreaDetailScreenProps {
  areaSlug: string;
}

export function AreaDetailScreen({ areaSlug }: AreaDetailScreenProps) {
  const detail = useQuery(api.areas.detailBySlug, { slug: areaSlug });
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateThread, setShowCreateThread] = useState(false);

  // Picker data for the create-thread dialog only; the page itself renders
  // from the composite.
  const areas = useQuery(api.areas.list, showCreateThread ? {} : "skip");

  useDocumentTitle(detail?.area.name ?? "Area");

  if (detail === undefined) return <AreaDetailSkeleton />;
  if (detail === null) return <AreaNotFound />;

  const { area, threads } = detail;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 border-t-2 border-brand-gold-strong/55 pt-3">
      <div>
        <AreaHeaderSection area={area} onEdit={() => setShowEdit(true)} />
        <div className="min-h-8 max-w-2xl">
          <AreaStandardCardSection area={area} />
        </div>
      </div>

      <AreaThreadsSection
        threads={threads}
        onCreateThread={() => setShowCreateThread(true)}
      />

      <EditAreaDialog open={showEdit} onOpenChange={setShowEdit} area={area} />

      <CreateThreadDialog
        open={showCreateThread}
        onOpenChange={setShowCreateThread}
        areas={areas ?? []}
        defaultAreaId={area._id}
        onCreated={({ slug }) => {
          navigate({
            to: ".",
            search: (prev) => ({ ...prev, thread: slug }),
          });
        }}
      />
    </div>
  );
}
