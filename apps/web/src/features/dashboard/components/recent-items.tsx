import { api } from "@convex/_generated/api";
import { useQuery } from "convex-helpers/react/cache/hooks";
import { RecentItemsList } from "./recent-items-list";

export function RecentItems() {
  const items = useQuery(api.items.list);

  return <RecentItemsList items={items ?? []} />;
}
