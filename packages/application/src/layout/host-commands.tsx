import { createContext, type PropsWithChildren, useContext } from "react";

/** What a host's own chrome, like the desktop's menu bar, can ask of the shell. */
export type HostCommand = "new-note" | "new-thread" | "search";

/** Calls `listener` with each command the host sends; returns how to stop. */
export type HostCommands = (
  listener: (command: HostCommand) => void,
) => () => void;

const HostCommandsContext = createContext<HostCommands | null>(null);

/** Without one, as on the web, the shell hears only its own chrome. */
export function HostCommandsProvider({
  subscribe,
  children,
}: PropsWithChildren<{ subscribe: HostCommands }>) {
  return (
    <HostCommandsContext value={subscribe}>{children}</HostCommandsContext>
  );
}

export function useHostCommands(): HostCommands | null {
  return useContext(HostCommandsContext);
}
