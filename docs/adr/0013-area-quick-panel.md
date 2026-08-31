# Area Quick Panel

Status: Amended by ADR 0014 — the Dashboard Condition strip replaces the retired Plan lane header as the panel trigger; the top-bar Area strip remains pure navigation. An absent Standard now contributes no section, and the scoped capture button is labeled "New Thread."

The **Dashboard** could show **Area** state but never touch it: the status bar names the Area and the reason, **Plan** lanes carry the **Condition**, yet recording the judgment that awareness just produced — downgrading an Area after handling the reason, escalating another, checking what "healthy" even means there, or capturing a **Thread** prompted by the state — required leaving for the Area page and finding the way back. Left-clicking a Plan lane header now opens an **Area Quick Panel** over the Dashboard instead of navigating: the Condition as a segmented control with all three states one tap away, the Area's **Standard** as read-only text (a quiet empty state pointing at the Area page when unwritten), a "New Thread in {Area}" action that pre-scopes the existing create flow and opens the created Thread in place in the Thread rail (ADR 0007), and the panel's title itself linking through to the Area page, a trailing arrow marking the jump. The command palette gains a drill-in per Area row offering the same action set, with Enter still jumping straight to the Area page. One shared **Area Actions model** defines that set and its handlers, so the surfaces cannot drift apart. This is the Areas instance of the app's anti-navigation arc — ADR 0006 (palette-first), ADR 0007 (in-place Thread rail), ADR 0011 (top-bar Area strip), ADR 0012 (in-place Inbox).

## Considered Options

- **Keep the header a link to the Area page**: the status quo. Every response to what the Dashboard just said cost a page trip and the user's place in the Plan.
- **Make every Area representation actionable app-wide**: strip hexagons, status-bar entries, and lane headers all growing an action affordance. Rejected: it turns multiple representations into decision points, taxing the glance-and-go path that ADR 0011 exists to make instant, and spreads the action set across surfaces with no single owner.
- **A hover-revealed action button in the header**: keeps the header a link and adds a button beside it. Rejected: two click targets inside one small header invite mis-clicks, and a hover-dependent affordance is invisible to keyboard users and on touch.
- **Right-click to summon**: leaves left-click navigating. Rejected: undiscoverable without a prior hint, and it collides with the native context menu users rely on in a browser.
- **Left-click the header opens the panel** (chosen): one target, one gesture, discoverable by the same click users already aim at the header, and fully keyboard-operable — open from the focused header, trap focus, Escape closes and returns focus.

## Constraints this records

- **Condition stays audit-silent by design.** Making the judgment cheap to change does not turn it into an event: Condition changes are logged nowhere, in **Thread** **Activity Logs** or otherwise. Condition is the user's current judgment, not a tracked stream, and reversal is an ordinary re-set.
- **The panel is summoned; it adds zero ambient state.** Nothing new stands on screen. The standing "no second awareness surface" rule (ADRs 0006, 0011, 0012) holds — the Dashboard remains the only place Area state is ambiently readable.
- **The response set only crosses over.** Set Condition, read Standard, capture a Thread scoped here, open the Area. Rename, icon change, Standard *editing*, and delete stay deliberate Area-page actions; the Area page keeps its full-inventory role (ADR 0009) untouched.
- **Removing the header's link role is safe because the route is redundant.** Since ADR 0011 the Dashboard has carried two same-screen one-click routes to any Area page — the strip (plus its `1..9` keys) and the palette. The strip keeps that pure-navigation role.

## Consequences

- Plan lane headers stop navigating and become the panel's trigger. They remain excluded from drag as both sources and targets, so a drag never opens the panel and a drop never lands on a header.
- The Dashboard projection carries the Area's **Standard**, which it currently drops before reaching the UI. No backend or schema change: the existing Area update mutation covers Condition, the existing optimistic-update helpers make the lane tint, status bar, and strip dot agree immediately, and Thread creation is untouched.
- Thread capture wires the create flow's existing default-Area channel, which no caller outside the Area page passes today. No second creation path exists to keep in sync.
- The palette gains its first nested page: an Area row drills in to the shared action set. Enter on the row still navigates, so the jump the palette is relied on for never slows down.
- Condition is presented with the established condition tokens and never by color alone (ADR 0008); the panel's segmented control reuses those tokens — icon plus label on every segment, the vivid fill on the active one — rather than restating the ramp. The Area page keeps its select pill; the two controls share the same vocabulary and write through the same mutation.
- Mobile is unaffected — the small-screen Plan has no lane headers. The rule binds any future mobile Area representation rather than describing one that exists.
