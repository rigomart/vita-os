import type { Id } from "@convex/_generated/dataModel";
import type { Condition } from "@convex/lib/condition";
import type { LucideIcon } from "lucide-react";

import { api } from "@convex/_generated/api";
import { CONDITIONS, conditionLabels } from "@convex/lib/condition";
import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowRight, MessageSquarePlus } from "lucide-react";

import { conditionIcons } from "@/features/areas/condition-presentation";
import { optimisticallyUpdateArea } from "@/features/areas/optimistic";

/**
 * The Area an action set is built for. Deliberately smaller than
 * `ProjectedArea`: every surface that can name an Area — the Dashboard
 * Condition strip, the command palette's drill-in, the Area page itself — already
 * has these four fields, so none of them has to hold a full document to offer
 * the actions.
 */
export interface AreaActionTarget {
  condition: Condition;
  /** The Area's `_id`. Typed as a string so projections can pass theirs. */
  id: string;
  name: string;
  slug: string;
}

export type AreaActionKind = "condition" | "new-thread" | "open-area";

/**
 * One thing a user can do to an Area from anywhere. `run` is already bound to
 * the Area and to the consumer's handlers, so a surface renders the list it is
 * given and calls `run` — it never re-derives what an action means.
 */
export interface AreaAction {
  /** True when the action would leave the Area exactly as it already is. */
  active: boolean;
  /** Set only on `condition` actions: the Condition this action writes. */
  condition?: Condition;
  icon: LucideIcon;
  /** Stable across renders and unique within one Area's set. */
  id: string;
  kind: AreaActionKind;
  /** Names the Area, so the action still reads correctly out of context. */
  label: string;
  /** Extra words a palette can match on beyond the label. */
  keywords: string[];
  run: () => void;
}

/**
 * What a surface must supply to make the action set real. Every handler is
 * required: an action nobody can perform has no business being offered.
 */
export interface AreaActionHandlers {
  newThread: () => void;
  openArea: () => void;
  setCondition: (condition: Condition) => void;
}

/**
 * The Area action set, as data. Pure — no Convex, no router — so a consumer
 * that already owns its own mutation or navigation wiring (a palette, a test)
 * can build the same actions the Quick Panel shows.
 *
 * Condition expands to one action per Condition rather than a single "change
 * condition": a list surface can then offer the three destinations directly,
 * and a select surface can ignore them and drive `setCondition` itself.
 */
export function buildAreaActions(
  area: AreaActionTarget,
  handlers: AreaActionHandlers,
): AreaAction[] {
  return [
    ...CONDITIONS.map((condition) => ({
      active: area.condition === condition,
      condition,
      icon: conditionIcons[condition],
      id: `condition:${condition}`,
      keywords: ["condition", "state", area.name],
      kind: "condition" as const,
      label: `Set ${area.name} to ${conditionLabels[condition]}`,
      run: () => handlers.setCondition(condition),
    })),
    {
      active: false,
      icon: MessageSquarePlus,
      id: "new-thread",
      keywords: ["thread", "capture", "new", area.name],
      kind: "new-thread" as const,
      label: `New Thread in ${area.name}`,
      run: handlers.newThread,
    },
    {
      active: false,
      icon: ArrowRight,
      id: "open-area",
      keywords: ["open", "go to", "area", area.name],
      kind: "open-area" as const,
      label: `Open ${area.name}`,
      run: handlers.openArea,
    },
  ];
}

/**
 * The one place an Area's Condition is written from outside the Area page.
 * Optimistic, so every surface reading `areas.list` — lane tint, status bar,
 * top-bar strip — repaints in the same frame as the click.
 */
export function useSetAreaCondition() {
  const updateArea = useMutation(api.areas.update).withOptimisticUpdate(
    (localStore, args) => {
      optimisticallyUpdateArea(localStore, args);
    },
  );

  return (areaId: string, condition: Condition) => {
    updateArea({ condition, id: areaId as Id<"areas"> });
  };
}

/**
 * The wired action set: Condition writes through the shared mutation, Open
 * navigates to the Area page, and capture is handed back to the host — only
 * the host knows where its create-Thread dialog is mounted.
 */
export function useAreaActions(
  area: AreaActionTarget,
  options: {
    onNewThread: (areaId: string) => void;
    /** Overrides the default navigation, for a host that routes its own way. */
    onOpenArea?: (area: AreaActionTarget) => void;
  },
): { actions: AreaAction[]; setCondition: (condition: Condition) => void } {
  const navigate = useNavigate();
  const setAreaCondition = useSetAreaCondition();

  const setCondition = (condition: Condition) =>
    setAreaCondition(area.id, condition);

  const actions = buildAreaActions(area, {
    newThread: () => options.onNewThread(area.id),
    openArea: () => {
      if (options.onOpenArea) {
        options.onOpenArea(area);
        return;
      }
      void navigate({ params: { areaSlug: area.slug }, to: "/$areaSlug" });
    },
    setCondition,
  });

  return { actions, setCondition };
}
