# PROTOTYPE — throwaway

Three variants of the dashboard, switchable via `?variant=` on the existing `/` route,
answering: **should Plan be the default view, and what happens to the area health section?**

Flip with the floating bottom bar or `←`/`→`:

- _(no param)_ — **Current**: Overview default, area health above the tabs.
- `?variant=a` — **Scoped tabs**: Plan default; area health moves inside the Overview tab;
  Plan lanes gain area-page links and always-visible condition labels.
- `?variant=b` — **Fully integrated**: Plan default; area health deleted; links, condition
  pills, filter glyphs, and the all-clear line absorbed into the Plan canvas.
- `?variant=c` — **Plan-first single surface**: no tabs; Plan is the dashboard; condition
  compressed to a one-line strip; Inbox + Recent activity demoted to a slim rail.

Everything in this folder plus `src/components/prototype-switcher.tsx`, the `variant`
search param in `routes/_authenticated/route.tsx`, and the wiring in
`screens/dashboard-screen.tsx` is throwaway — fold the winner into the real code and
drop the rest on this branch.
