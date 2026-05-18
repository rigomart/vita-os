# Surface scale design tokens

Neutral fills were duplicated across `--background`, `--card`, `--popover`, and related variables, so palette tweaks were easy to miss and light-mode cards sat visually flush with the page. We introduced a three-step neutral ramp (`--surface-1` through `--surface-3`) as the only source for those layers, mapped semantic roles (`--card`, `--popover`, `--sidebar`, `--muted`, `--accent`, `--sidebar-accent`) onto those steps, and dropped `--background` in favor of treating the page as `surface-1`. `--secondary`, `--border`, and `--input` stay independent: secondary keeps its tint, and border/input keep their own jobs (outline vs. control chrome), including dark-mode alpha treatments that should not be derived from the surface ramp.

## Considered Options

- **Keep `--background` as an alias of `--surface-1`**: Less churn for class names, but two tokens for one layer invites drift; we chose a single vocabulary for base fills.
- **Derive `--border` / `--input` from surfaces**: Would couple every outline to the fill ramp and fight intentional white-alpha inputs in dark mode; rejected.

## Consequences

- Cards, popovers, and the sidebar chrome sit on `--surface-2` above `--surface-1`; muted and accent-style surfaces use `--surface-3`.
- Tailwind picks up `bg-surface-*`, `text-surface-*`, `ring-surface-*`, etc. from `@theme`; former `bg-background` / `text-background` / `ring-background` usage moves to `surface-1` or a semantic token where intent matters.
- `apps/web/src/index.css` was unused (the shell imports `@vita-os/ui/globals.css`); it was removed and `apps/web/components.json` now points at the shared package stylesheet for shadcn tooling.
