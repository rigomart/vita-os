# Condition color ramp

The three condition tokens (`--condition-healthy`, `--condition-attention`, `--condition-critical`) had drifted apart: each carried its own lightness and chroma, healthy was so desaturated (chroma 0.052) it read as gray at swatch size, attention failed WCAG AA as text on light surfaces (3.3:1), and no token had a paired foreground — so solid critical fills hardcoded `text-white` (2.99:1 in dark mode) and the delete-confirm button referenced a `--destructive-foreground` that did not exist. The original hues were also too close to tell apart at a glance: critical (hue 20) and attention (hue 46) were 26° apart at low chroma, so both read as warm brown. We normalized the triad into one ramp with wider hue spacing and higher chroma — red 25, amber 58, green 145 — and added `-foreground` pairs for all three conditions plus `--destructive`, mapping to `--brand-cream` in light mode and `--brand-ink` in dark mode. Attention stops at hue 58 because `--brand-gold-strong` sits at hue 69; pushing further would make warnings read as brand accent.

Chroma sits at the sRGB gamut edge for each hue so the colors read saturated
rather than washed out; amber carries the least chroma in light mode because a
dark vivid orange does not exist in sRGB — that is a physical ceiling, not a
style choice.

Values (light / dark):

- `--condition-healthy`: `oklch(0.52 0.15 145)` / `oklch(0.72 0.16 145)`
- `--condition-attention`: `oklch(0.55 0.135 56)` / `oklch(0.78 0.15 56)`
- `--condition-critical`: `oklch(0.52 0.19 25)` / `oklch(0.7 0.17 25)`

Those base tokens are text-safe (≥4.5:1 on their surfaces) and therefore
mid-dark in light mode — which means they can never look vivid, and low-alpha
tints of them disappear into the app's warm cream surfaces. Signal *surfaces*
instead use a second set of vivid, theme-invariant fill tokens paired with a
fixed foreground:

- `--condition-healthy-fill`: `oklch(0.7 0.13 148)`, foreground `--brand-ink`
- `--condition-attention-fill`: `oklch(0.75 0.125 62)`, foreground `--brand-ink`
- `--condition-critical-fill`: `oklch(0.56 0.155 27)`, foreground `--brand-cream`

Fill chroma sits deliberately below the sRGB gamut edge (~0.125–0.155): at full
saturation the fills read as traffic-light candy against the warm muted brand;
these values keep the blocks unmistakable while staying in the app's register
(honey amber, brick red, sage green).

Every text usage clears 4.5:1 on its surface, every `-foreground` clears 4.5:1 on its solid fill, and swatch dots clear 3:1 as non-text marks. All values stay inside the sRGB gamut. Dark-mode attention sits brighter than its siblings (0.78 vs 0.70–0.72) because it renders as text over its own 12% tint, which caps achievable contrast.

## Considered Options

- **Keep `text-white` and add only `--destructive-foreground`**: Fixes the visible bug but leaves the next solid condition fill to reinvent its foreground; rejected in favor of symmetric pairs.
- **Uniform lightness across all three hues per mode**: Cleaner on paper, but orange turns muddy below L 0.55 and fails the self-tint contrast ceiling in dark mode; the ramp allows a small per-hue offset instead.

## Consequences

- Division of labor: `-fill` tokens color signal surfaces (dashboard tiles, condition pills, the overdue date chip) and always pair with their `-fill-foreground`; the base `condition-*` tokens color text and icons sitting directly on app surfaces (state labels, dropdown option icons). Low-alpha condition tints are reserved for hover/affordance states, not primary signals.
- Solid fills never hardcode a foreground (`text-white` is gone); every fill token ships with its foreground pair, verified ≥4.5:1.
- Lateness still uses `condition-attention` rather than `destructive`, per ADR 0005.
- Condition is never signaled by color alone: `apps/web/src/features/areas/condition-presentation.ts` pairs each condition with an icon (`CircleCheck` / `TriangleAlert` / `OctagonAlert`) and provides the pill treatment (solid fill for critical, tint for the others) used by the area header's condition select. That file is the home for condition Tailwind strings; `convex/lib/condition.ts` keeps only the domain vocabulary and labels.
