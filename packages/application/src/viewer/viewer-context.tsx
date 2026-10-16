import { createContext, type PropsWithChildren, useContext } from "react";

/**
 * Who is using the application, as the product needs to know them.
 *
 * The shared application shows a name, an avatar, and a way out when there is
 * one; it has no idea how any of that was established. The host fills this in
 * from whatever it authenticates with — Better Auth in the browser, nothing on
 * the local desktop app — which is why nothing here mentions sessions, cookies,
 * or providers.
 */
export interface Viewer {
  name?: string | undefined;
  email?: string | undefined;
  image?: string | null | undefined;
}

export interface ViewerAccess {
  /** Absent while the host is still establishing who is here. */
  viewer?: Viewer | undefined;
  /** Absent when the host has no session to end, as on desktop. */
  signOut?: (() => void) | undefined;
  /**
   * Save all of the person's data as one file. Absent where the host has no
   * download to offer. Rejects when the download failed.
   */
  downloadData?: (() => Promise<void>) | undefined;
}

const ViewerContext = createContext<ViewerAccess | null>(null);

export function ViewerProvider({
  viewer,
  signOut,
  downloadData,
  children,
}: PropsWithChildren<ViewerAccess>) {
  return (
    <ViewerContext.Provider value={{ viewer, signOut, downloadData }}>
      {children}
    </ViewerContext.Provider>
  );
}

export function useViewer(): ViewerAccess {
  const access = useContext(ViewerContext);
  if (access === null) {
    throw new Error("ViewerProvider is missing.");
  }
  return access;
}
