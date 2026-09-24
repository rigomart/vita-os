import { createContext, useContext } from "react";

export interface ThreadLocation {
  areaSlug: string;
  threadSlug: string;
}

export interface ThreadPaneNav {
  /**
   * Called when the open thread's location changes from within the pane
   * (title rename changes the thread slug, moving the thread changes the
   * area). The pane host decides how to reflect it: update the `?thread`
   * search param in place, or replace the /$areaSlug/$threadSlug URL.
   */
  onThreadLocationChange: (location: ThreadLocation) => void;
}

export const ThreadPaneNavContext = createContext<ThreadPaneNav | null>(null);

export function useThreadPaneNav(): ThreadPaneNav {
  const nav = useContext(ThreadPaneNavContext);
  if (!nav) {
    throw new Error("useThreadPaneNav must be used within ThreadDetailView");
  }
  return nav;
}
