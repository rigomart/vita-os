import type { AreaId } from "@vita-os/contracts";

export type ThreadFormValue = {
  title: string;
  summary?: string;
  areaId?: AreaId;
};

export type CreatedThreadResult = {
  slug: string;
};
