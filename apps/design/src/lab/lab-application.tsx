import {
  ApplicationClientProvider,
  clock,
  ViewerProvider,
} from "@vita-os/application";
import { toast } from "@vita-os/ui/lib/toast";
import {
  createContext,
  type PropsWithChildren,
  Suspense,
  use,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createInMemoryApplicationClient } from "./in-memory-application-client";
import { findScenario, type ScenarioId } from "./scenarios";

/** How long every operation takes, to see loading and optimistic states. */
export const latencies = {
  instant: 0,
  realistic: 350,
  slow: 1500,
} as const;
export type Latency = keyof typeof latencies;

export interface LabSettings {
  scenarioId: ScenarioId;
  latency: Latency;
  /** The moment the clock is set to, or the real time when absent. */
  at?: number | undefined;
}

interface LabControls extends LabSettings {
  change: (settings: Partial<LabSettings>) => void;
  /** Throw away every change and start the scenario again. */
  reset: () => void;
}

const STORAGE_KEY = "vita-os:lab";
const DEFAULT_SETTINGS: LabSettings = {
  scenarioId: "sample",
  latency: "instant",
};

const LabContext = createContext<LabControls | null>(null);

export function useLab(): LabControls {
  const lab = useContext(LabContext);
  if (lab === null) throw new Error("LabApplication is missing.");
  return lab;
}

/**
 * The product's surroundings in the lab: an in-memory client seeded from the
 * chosen scenario, a made-up person signed in, and the product's clock set to
 * the chosen moment. Changing the scenario or resetting builds a new client
 * and a new cache, so nothing leaks between runs. Setting the clock keeps the
 * data, so the same situation can be seen at another time; a reset seeds it
 * again around the moment set.
 */
export function LabApplication({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState(() => {
    const stored = readSettings();
    // Before the first seed, which dates its items from the clock.
    clock.set(stored.at);
    return stored;
  });
  const [generation, setGeneration] = useState(0);
  const latency = useRef(latencies[settings.latency]);
  latency.current = latencies[settings.latency];

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const run = useMemo(() => {
    let seeded = false;
    const client = createInMemoryApplicationClient({
      latencyMs: () => (seeded ? latency.current : 0),
    });
    const ready = findScenario(settings.scenarioId)
      .seed(client)
      .then(() => {
        seeded = true;
      });
    return { key: `${settings.scenarioId}:${generation}`, client, ready };
  }, [settings.scenarioId, generation]);

  const controls: LabControls = {
    ...settings,
    change: (changes) => {
      if ("at" in changes) clock.set(changes.at);
      setSettings((current) => ({ ...current, ...changes }));
    },
    reset: () => setGeneration((current) => current + 1),
  };

  return (
    <LabContext value={controls}>
      <ApplicationClientProvider key={run.key} client={run.client}>
        <ViewerProvider
          viewer={{ name: "Lab Person", email: "lab@vita.test" }}
          signOut={() => toast("Signing out does nothing in the lab.")}
        >
          <Suspense>
            <Seeded ready={run.ready}>{children}</Seeded>
          </Suspense>
        </ViewerProvider>
      </ApplicationClientProvider>
    </LabContext>
  );
}

/** Suspends until the scenario is seeded; a refused seed reaches the boundary. */
function Seeded({
  ready,
  children,
}: PropsWithChildren<{ ready: Promise<void> }>) {
  use(ready);
  return children;
}

/** The last settings used, or the defaults where they no longer apply. */
function readSettings(): LabSettings {
  let stored: Partial<LabSettings> = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    // Unreadable settings are as good as none.
  }
  return {
    scenarioId: findScenario(stored.scenarioId ?? "").id as ScenarioId,
    latency:
      stored.latency !== undefined && Object.hasOwn(latencies, stored.latency)
        ? stored.latency
        : DEFAULT_SETTINGS.latency,
    ...(typeof stored.at === "number" && Number.isFinite(stored.at)
      ? { at: stored.at }
      : {}),
  };
}
