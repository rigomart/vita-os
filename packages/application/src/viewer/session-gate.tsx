import {
  createContext,
  useContext,
  type ComponentType,
  type PropsWithChildren,
} from "react";

/**
 * What a host puts in front of the product's screens.
 *
 * Whether somebody is signed in, what to show while that is still being
 * established, and where to send somebody who is not, are all the host's
 * questions — the browser answers them with Better Auth and its own sign-in
 * address, a desktop host with something else entirely. The shared application
 * only needs to know where the answer goes: this component wraps every
 * authenticated screen and renders `children` once somebody is here.
 */
export type SessionGate = ComponentType<PropsWithChildren>;

const SessionGateContext = createContext<SessionGate | null>(null);

export function SessionGateProvider({
  gate,
  children,
}: PropsWithChildren<{ gate: SessionGate }>) {
  return (
    <SessionGateContext.Provider value={gate}>
      {children}
    </SessionGateContext.Provider>
  );
}

export function useSessionGate(): SessionGate {
  const gate = useContext(SessionGateContext);
  if (gate === null) {
    throw new Error("SessionGateProvider is missing.");
  }
  return gate;
}
