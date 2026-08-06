# Condition color ramp

The three condition tokens (`--condition-healthy`, `--condition-attention`, `--condition-critical`) had drifted apart: each carried its own lightness and chroma, healthy was so desaturated (chroma 0.052) it read as gray at swatch size, attention failed WCAG AA as text on light surfaces (3.3:1), and no token had a paired foreground — so solid critical fills hardcoded `text-white` (2.99:1 in dark mode) and the delete-confirm button referenced a `--destructive-foreground` that did not exist. We normalized the triad into one ramp — hues stay where they were (green 132, orange 46, red 20), lightness and chroma are aligned per mode — and added `-foreground` pairs for all three conditions plus `--destructive`, mapping to `--brand-cream` in light mode and `--brand-ink` in dark mode.

Values (light / dark):

- `--condition-healthy`: `oklch(0.54 0.09 132)` / `oklch(0.74 0.09 132)`
- `--condition-attention`: `oklch(0.55 0.12 46)` / `oklch(0.78 0.12 46)`
- `--condition-critical`: `oklch(0.53 0.12 20)` / `oklch(0.72 0.12 20)`

Every text usage clears 4.5:1 on its surface, every `-foreground` clears 4.5:1 on its solid fill, and swatch dots clear 3:1 as non-text marks. Dark-mode attention sits slightly brighter than its siblings (0.78 vs 0.72–0.74) because it renders as text over its own 12% tint, which caps achievable contrast.

## Considered Options

- **Keep `text-white` and add only `--destructive-foreground`**: Fixes the visible bug but leaves the next solid condition fill to reinvent its foreground; rejected in favor of symmetric pairs.
- **Uniform lightness across all three hues per mode**: Cleaner on paper, but orange turns muddy below L 0.55 and fails the self-tint contrast ceiling in dark mode; the ramp allows a small per-hue offset instead.

## Consequences

- The tinted-chip recipe is `bg-condition-*/12` everywhere (the dashboard previously used `/15`, the attention rail `/12`). At 12%, condition text on its own tint clears 4.5:1 in light mode and 4.4:1 in dark mode.
- Solid condition or destructive fills always pair with their `-foreground` token (`bg-condition-critical text-condition-critical-foreground`); hardcoded `text-white` on status fills is no longer used.
- Lateness still uses `condition-attention` rather than `destructive`, per ADR 0005.
