import {
  createContext,
  useContext,
  type ComponentType,
  type PropsWithChildren,
} from "react";

/**
 * What a host puts in front of the product's screens.
 *
 * Who is here is the host's question — Better Auth in the browser, something
 * else on a desktop. This wraps every authenticated screen and renders
 * `children` once somebody is signed in.
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
