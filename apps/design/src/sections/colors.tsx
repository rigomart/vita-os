import { useEffect, useState } from "react";

import { Section } from "@/components/section";
import {
  collectTokens,
  groupToken,
  TOKEN_GROUP_ORDER,
  tokenStyleVars,
  type TokenEntry,
  type TokenGroup,
} from "@/lib/tokens";

function TokenCard({ token }: { token: TokenEntry }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      <div
        className="h-12 w-full rounded-md border"
        style={{ background: `var(${token.name})` }}
      />
      <div className="space-y-0.5">
        <p className="truncate font-mono text-xs font-medium">{token.name}</p>
        {token.light ? (
          <p
            className="truncate font-mono text-[11px] text-muted-foreground"
            title={token.light}
          >
            {token.light}
          </p>
        ) : null}
        {token.dark && token.dark !== token.light ? (
          <p
            className="truncate font-mono text-[11px] text-muted-foreground"
            title={token.dark}
          >
            dark: {token.dark}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TokenGroupGrid({
  group,
  tokens,
}: {
  group: TokenGroup;
  tokens: TokenEntry[];
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {group}
      </h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tokens.map((token) => (
          <TokenCard key={token.name} token={token} />
        ))}
      </div>
    </div>
  );
}

export function ColorsSection() {
  const [tokens, setTokens] = useState<TokenEntry[]>([]);

  useEffect(() => {
    setTokens(collectTokens());
  }, []);

  const colorTokens = tokens.filter((token) => groupToken(token.name) !== null);
  const groups = TOKEN_GROUP_ORDER.map((group) => ({
    group,
    tokens: colorTokens.filter((token) => groupToken(token.name) === group),
  })).filter((entry) => entry.tokens.length > 0);

  const lightStyle = tokenStyleVars(colorTokens, "light");
  const darkStyle = tokenStyleVars(colorTokens, "dark");

  return (
    <Section
      id="colors"
      title="Colors"
      description="Every custom property declared on :root and .dark in globals.css, enumerated at runtime and grouped by prefix."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div
          className="space-y-8 rounded-xl border bg-surface-1 p-6 text-foreground"
          style={lightStyle}
        >
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Light
          </p>
          {groups.map(({ group, tokens: groupTokens }) => (
            <TokenGroupGrid key={group} group={group} tokens={groupTokens} />
          ))}
        </div>
        <div
          className="dark space-y-8 rounded-xl border bg-surface-1 p-6 text-foreground"
          style={darkStyle}
        >
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Dark
          </p>
          {groups.map(({ group, tokens: groupTokens }) => (
            <TokenGroupGrid key={group} group={group} tokens={groupTokens} />
          ))}
        </div>
      </div>
    </Section>
  );
}
