import { useEffect, useState } from "react";

import { Section } from "@/components/section";
import { collectTokens, type TokenEntry } from "@/lib/tokens";

const RADIUS_SCALE = [
  "rounded-sm",
  "rounded-md",
  "rounded-lg",
  "rounded-xl",
  "rounded-2xl",
  "rounded-3xl",
  "rounded-4xl",
];

export function RadiiSection() {
  const [tokens, setTokens] = useState<TokenEntry[]>([]);

  useEffect(() => {
    setTokens(collectTokens());
  }, []);

  const radius = tokens.find((token) => token.name === "--radius");

  return (
    <Section
      id="radii"
      title="Radii"
      description={
        radius?.light
          ? `Radius scale, derived in @theme inline from the base --radius token (${radius.light}).`
          : "Radius scale, derived in @theme inline from the base --radius token."
      }
    >
      <div className="flex flex-wrap gap-6">
        {RADIUS_SCALE.map((className) => (
          <div key={className} className="flex flex-col items-center gap-2">
            <div className={`h-20 w-20 border bg-surface-3 ${className}`} />
            <p className="font-mono text-xs text-muted-foreground">
              {className}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
