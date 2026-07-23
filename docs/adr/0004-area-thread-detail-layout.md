# Area and Thread detail layout

On wide desktop viewports, opening a **Thread** from an **Area** should preserve the Area as context without covering it with a modal surface. Thread detail will use a full-height right rail that pushes the Area content into the remaining workspace. Below 1280px, Thread detail will continue to use the near-full-height bottom Drawer.

## Considered Options

- **Integrated pane below the app header**: keeps the Thread inside the page content region, but feels visually less decisive and depends on the Area route's vertical layout.
- **Inset card inside the Area page**: clearly separates the Thread, but adds unnecessary framing and makes the working surface feel smaller.
- **Full-height right rail**: creates a stable, professional workspace boundary and keeps Thread scrolling independent from the Area; selected after comparing all three treatments in the real Area route.

## Consequences

- Desktop Thread detail is a non-modal complementary region rather than a Sheet; the Area stays visible and interactive.
- The rail reserves matching horizontal space so it pushes rather than covers Area content.
- The rail width remains responsive between 28rem and 34rem, preserving useful Area width with the desktop sidebar open.
- Mobile and narrower desktop layouts retain the bottom Drawer and its existing close behavior.
