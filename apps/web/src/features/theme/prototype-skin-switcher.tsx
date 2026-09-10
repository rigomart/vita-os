/*
  PROTOTYPE — throwaway. Delete with the rest of the design-style prototype.

  Floating bar that swaps the whole app between candidate design skins.
  Reads `?variant=` on load so a skin is shareable and reload-stable, and
  mirrors the choice into localStorage so it survives in-app navigation
  (the authenticated route's `validateSearch` drops unknown params).
*/

import { useCallback, useEffect, useState } from "react";

const SKINS = [
  { key: "current", label: "Current — warm gold & cream", attr: null },
  {
    key: "graphite",
    label: "A — Graphite (cool mono, indigo focus)",
    attr: "graphite",
  },
  {
    key: "cobalt",
    label: "B — Cobalt (paper white, saturated blue)",
    attr: "cobalt",
  },
  { key: "moss", label: "C — Moss (sage paper, serif headings)", attr: "moss" },
] as const;

type SkinKey = (typeof SKINS)[number]["key"];

const STORAGE_KEY = "vita-os:proto-skin";

function isSkinKey(value: string | null): value is SkinKey {
  return SKINS.some((skin) => skin.key === value);
}

function readInitialSkin(): SkinKey {
  const fromUrl = new URLSearchParams(window.location.search).get("variant");
  if (isSkinKey(fromUrl)) return fromUrl;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isSkinKey(stored)) return stored;
  } catch {
    // Fall through to the default skin when storage is unavailable.
  }
  return "current";
}

export function PrototypeSkinSwitcher() {
  const [skinKey, setSkinKey] = useState<SkinKey>(readInitialSkin);

  useEffect(() => {
    const attr = SKINS.find((skin) => skin.key === skinKey)?.attr;
    if (attr) {
      document.documentElement.dataset.protoSkin = attr;
    } else {
      delete document.documentElement.dataset.protoSkin;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, skinKey);
    } catch {
      // The in-memory choice still applies without storage.
    }

    const url = new URL(window.location.href);
    url.searchParams.set("variant", skinKey);
    window.history.replaceState(window.history.state, "", url);
  }, [skinKey]);

  const cycle = useCallback((step: number) => {
    setSkinKey((current) => {
      const index = SKINS.findIndex((skin) => skin.key === current);
      const next = (index + step + SKINS.length) % SKINS.length;
      return SKINS[next].key;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      cycle(event.key === "ArrowRight" ? 1 : -1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycle]);

  const label = SKINS.find((skin) => skin.key === skinKey)?.label ?? skinKey;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "6px 6px 6px 10px",
        borderRadius: 999,
        background: "#111",
        color: "#fff",
        border: "1px solid #444",
        boxShadow: "0 8px 24px rgb(0 0 0 / 35%)",
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
      }}
    >
      <button type="button" onClick={() => cycle(-1)} style={arrowStyle}>
        ←
      </button>
      <span style={{ padding: "0 8px", whiteSpace: "nowrap" }}>{label}</span>
      <button type="button" onClick={() => cycle(1)} style={arrowStyle}>
        →
      </button>
    </div>
  );
}

const arrowStyle = {
  background: "#333",
  color: "#fff",
  border: "none",
  borderRadius: 999,
  width: 24,
  height: 24,
  cursor: "pointer",
  fontSize: 13,
  lineHeight: 1,
} as const;
