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
import { useStableQuery } from "@/hooks/use-stable-query";

import { AreaNotFound } from "./area-not-found";

interface AreaDetailScreenProps {
  areaSlug: string;
}

export function AreaDetailScreen({ areaSlug }: AreaDetailScreenProps) {
  const area = useStableQuery(api.areas.getBySlug, { slug: areaSlug });
  const areas = useQuery(api.areas.list);
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showCreateThread, setShowCreateThread] = useState(false);

  useDocumentTitle(area?.name ?? "Area");

  if (area === undefined) return <AreaDetailSkeleton />;
  if (area === null) return <AreaNotFound />;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 border-t-2 border-brand-gold-strong/55 pt-3">
      <div>
        <AreaHeaderSection
          areaSlug={areaSlug}
          onEdit={() => setShowEdit(true)}
        />
        <div className="min-h-8 max-w-2xl">
          <AreaStandardCardSection areaSlug={areaSlug} />
        </div>
      </div>

      <AreaThreadsSection
        areaSlug={areaSlug}
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
