# Floating chrome

The app chrome stops being a bar. The top bar and the mobile tab bar are replaced by three **floating clusters** over the page: identity and status at the top-left, the personal controls at the top-right, and a dock at the bottom-centre. Nothing spans the width, so the board reads to the top edge of the viewport at every size.

The clusters carry the same content the bar did, regrouped by what each thing is for rather than by where it fits in a row:

- **Top-left — where you are.** The mark, today's date, and the **Area** strip. The strip absorbs the **Condition** status the **Dashboard** used to state a second time in its own header: **Condition** is now the hexagon's own colour rather than a dot beside it, and a corner badge carries that **Area**'s open **Thread** count. Healthy **Areas** stay grey, so the only colour in the chrome belongs to the parts of life that are slipping.
- **Top-right — what is waiting for you.** **Notes** with its count, and the account menu.
- **Bottom-centre — what you can do.** The palette keeps its full field, because it is the primary way to go anywhere and an icon would hide the shortcut that says so; **New note**, **New thread** and **New area** follow it as tooltipped icons.

One chrome serves every width. The dock is the mobile tab bar and the desktop actions at once, so the tab bar is retired rather than maintained beside it.

Four candidate forms were compared as switchable chrome over the real app on branch `worktree-prototype-header-float`, the method ADR 0006 established: the anchored bar as the control, a floating island, three split clusters, and a perimeter dock. The dock won the frame and the clusters won the top-left, which is the form recorded here.

## Considered Options

- **Keep the anchored bar**: cheapest and unambiguous — an edge-to-edge line reads as "this is the app, that is your work" — but it is the same bar as every other tool, and it spends a full row of every page on chrome that is mostly idle.
- **Floating island**: the same single object lifted off the edges. The softest change, since the layout is untouched, but it still reserves a band the content can never occupy, so it buys depth without buying room.
- **Split clusters everywhere**: lightest at the top, but the identity capsule widens with the **Area** list and pushes the centred palette field off its axis.
- **Perimeter dock with a split top**: chosen. The top of the board is left alone, the actions sit where the pointer and the thumb already are, and one chrome covers both widths.

## Consequences

- `AppChrome` replaces `AppTopBar`, and `MobileTabBar` is deleted. Its four destinations survive: **Dashboard** is the mark, search and **New note** are in the dock, **Notes** is top-right.
- The clusters are `position: fixed` and would otherwise sit under the **Thread** rail (ADR 0007, `z-30`), so the right-hand cluster and the dock offset themselves by the rail's own width and borrow its easing. `<main>` carries the padding that keeps content clear of chrome that no longer occupies layout space.
- The **Dashboard** header is gone. Its date and **Area** status moved into the chrome, which states them on every page rather than only this one, and its attention counts are stated by the lanes that own them — the count that matters now sits on the column the work is actually in, and **Now** carries the alarm colour when it is non-empty.
- The strip subscribes to `threads:list` for its counts. This is the cache the **Dashboard** and palette already hold, so the counts cost a read of state the client has rather than a new query.
- The **Area Quick Panel**'s **Dashboard** trigger is retired with that header (ADR 0013). The panel itself is unchanged and still opens from the palette's **Area** rows; **Condition** is still edited there and on the **Area** page. Re-attaching a trigger to the strip's hexagons is deliberately left open — the hexagon is a one-click jump (ADR 0011), and two targets in one 32px control is not a trade worth making blind.
