import { Button } from "@vita-os/ui/components/button";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { ColorsSection } from "./sections/colors";
import { ComponentsSection } from "./sections/components";
import { RadiiSection } from "./sections/radii";
import { TypographySection } from "./sections/typography";

const NAV_ITEMS = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "radii", label: "Radii" },
  { id: "components", label: "Components" },
];

function useDarkMode() {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return { dark, toggle: () => setDark((value) => !value) };
}

export function App() {
  const { dark, toggle } = useDarkMode();

  return (
    <div className="min-h-svh">
      <header className="sticky top-0 z-10 border-b bg-surface-1/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-6 px-6">
          <span className="font-heading text-sm font-bold tracking-tight">
            Vita OS Design
          </span>
          <nav className="flex flex-1 items-center gap-4">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {dark ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl space-y-16 px-6 py-12">
        <ColorsSection />
        <TypographySection />
        <RadiiSection />
        <ComponentsSection />
      </main>
    </div>
  );
}
