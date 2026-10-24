# Scroll a thread on a phone

On a phone the Thread drawer scrolls as one: the header, the Tasks, the `Notes`/`Activity` tabs and `Write a note…` share one scroll region, so many Tasks never push Notes and Activity out of reach. `Thread actions` and `Close thread` stay above it. The side pane from 1280px keeps its header and Tasks fixed and scrolls only its body under the tabs.

## Entry points and variants

- The drawer at 390×844
- The side pane at 1440×900

## Preconditions

- A Thread with 8 Tasks, added through `Add a task` at any width, then open at 390×844 with the drawer's animations ended.

## Checks

Read the scroll regions with
`eval "(d => { const r = [...d.querySelectorAll('*')].filter(e => /auto|scroll/.test(getComputedStyle(e).overflowY)); const part = {header: d.querySelector('[role=banner][aria-label=\"Thread header\"]'), tasks: d.querySelector('[aria-label=\"Thread attention\"]'), tabs: d.querySelector('[role=tablist]'), write: [...d.querySelectorAll('button')].find(b => b.innerText.trim() === 'Write a note…')}; return JSON.stringify({regions: r.length, contains: Object.fromEntries(Object.entries(part).map(([k, v]) => [k, !!v && !!r[0]?.contains(v)])), scrollTop: r[0]?.scrollTop, clientHeight: r[0]?.clientHeight, scrollHeight: r[0]?.scrollHeight}); })(document.querySelector('[data-vaul-drawer], [data-slot=thread-detail-pane]'))"`.

1. At 390×844 the drawer has exactly one scroll region, and it holds all four parts: `{"regions":1,"contains":{"header":true,"tasks":true,"tabs":true,"write":true},"scrollTop":0,…}`, with `scrollHeight` greater than `clientHeight`. The tabs start below the screen (the `[role=tablist]` top is greater than `innerHeight`).
2. A swipe or a wheel over a Task (a point where `document.elementFromPoint(x, y).closest('[data-task-id]')` is a Task; see the `mouse wheel` trap in SKILL.md) scrolls that region: `scrollTop` reaches `scrollHeight - clientHeight`, the tablist and `Write a note…` end within `innerHeight`, the header's bottom is above the drawer's top, and the drawer is still open at the same top.
3. At 1440×900 the side pane has exactly one scroll region, the body under the tabs: `{"regions":1,"contains":{"header":false,"tasks":false,"tabs":false,"write":true},…}`. A wheel over a Task moves neither the header nor the tablist (their `getBoundingClientRect().top` is unchanged).

## Traps

- `mouse wheel` and `scroll` do not prove check 2: the first fires at (0,0) and scrolls nothing, the second sets `scrollTop` with no wheel or touch event. Use CDP as the `mouse wheel` trap in SKILL.md says.
- With 8 Tasks and no Notes, the side pane's body has nothing to scroll (`scrollHeight` equals `clientHeight`); check 3 is about which region scrolls, not that it overflows.
