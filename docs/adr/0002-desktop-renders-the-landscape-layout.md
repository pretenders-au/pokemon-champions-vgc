# ADR-0002 — `portrait` stays two-valued; desktop renders the landscape layout

- **Status**: Accepted
- **Date**: 2026-07-28
- **Affects**: `src/features/teams/components/mobile/ArenaAddTeam.tsx`,
  `src/features/teams/components/mobile/ArenaReviewMon.tsx`,
  `src/features/scan/ArenaPlayerScanReview.tsx`

## Context

`7a34a34` made `portrait` a required prop on these three components so a host decides the
layout instead of a leaf consulting a media query. Desktop's `/teams/new` route passes
`portrait={false}`, so it renders the landscape branch. That commit deliberately left the
follow-up open: making desktop *different* is design work, not refactoring.

The proposed shape was `layout: 'portrait' | 'landscape' | 'desktop'`, giving every branch a
third value. That is **14 `portrait ?` ternaries across seven style blocks**:

| Site | Ternaries | Properties |
|---|---|---|
| `ArenaAddTeam.tsx:231` | 1 | `gridTemplateColumns` |
| `ArenaPlayerScanReview.tsx:208` | 1 | `gridTemplateColumns` |
| `ArenaReviewMon.tsx:216` (body) | 2 | `flexDirection`, `overflowY` |
| `ArenaReviewMon.tsx:218` (moves column) | 4 | `width`, `overflowY`, `borderRight`, `borderBottom` |
| `ArenaReviewMon.tsx:387` (stats column) | 3 | `width`, `flex`, `overflowY` |
| `ArenaReviewMon.tsx:451` (footer) | 2 | `flexWrap`, `justifyContent` |
| `ArenaReviewMon.tsx:452` (label) | 1 | `display` |

`useViewportMode()` already returns exactly those three values and both hosts already hold the
mode, so the plumbing would have been free.

The premise of that follow-up was that the landscape branch is "a layout designed for a ~800px
phone held sideways, shown on a 1440px desktop". Measured in the running app, it is not. The
host is `h-[calc(100vh_-_8rem)] max-w-5xl mx-auto` (`src/pages/Teams/index.tsx:259`), so the
panel is `min(1024px, window)` — it stops widening at 1024 no matter how wide the window gets.
Both ends of the desktop range were measured, because `useViewportMode` returns `'desktop'`
from 768px up, not from 1024:

| Surface | Desktop @ 1440 | Desktop @ 800 (narrowest) | Phone landscape @ 812 |
|---|---|---|---|
| `add-team-preview-grid` | 992px grid, three **325px** cards, 3×2 | 736px grid, **239px** cards | 748px grid, **243px** cards |
| `scan-glance-grid` | 960px grid, **314px** cards | 704px grid, **229px** cards | not measured |
| `review-mon-body` | `row`, **492 / 532px**, 648px tall, neither column scrolls | `row`, **369 / 399px**, neither scrolls | `row`, **374 / 406px**, **both columns scroll** |

Every figure above is a `getBoundingClientRect()` reading from the running app, not arithmetic.
The two grids differ by 32px because the glance grid sits one padding level deeper —
`ArenaAddTeam.tsx:176` pads the body `14px 16px`, then `ArenaPlayerScanReview.tsx:207` pads
again `11px 16px`. Card *content* is near-identical; the container is not.

Nothing truncates and nothing overflows horizontally at any of the three widths. The last row
is the most telling: on a phone held sideways both review columns genuinely scroll, and on
desktop neither does. The per-column `overflowY: auto` that the landscape branch sets is a
phone affordance that costs desktop nothing — the same branch serves both because the
scrolling only engages where the height is actually short.

The 3×2 grid reads as the natural shape for a six-mon team rather than as a stretched phone
layout, and side-by-side moves/stats is the *better* desktop choice too — it fits without
scrolling, which a stacked portrait layout would not.

## Decision

**`portrait` stays a boolean. Desktop renders the landscape branch, deliberately.**

All 14 ternaries would take the landscape value on desktop, so a third `layout` value would
add a branch to every one of them and a third case to three test suites while changing nothing
a user sees.

## Consequences

- The three layout test suites keep two cases each (portrait / not portrait). There is no
  desktop case to write, because there is no desktop value to assert.
- `portrait={false}` at a desktop call site is the honest reading, not a shortcut: desktop is
  genuinely "not portrait", and the layout it selects was chosen on its merits.
- The decision is coupled to the host container at the **wide** end only. `max-w-5xl` is what
  stops three-across from stretching; the narrow end needs no protection, since 768px desktop
  already lands within 4px of the phone-landscape card width. See *Do not re-suggest*.

## Do not re-suggest

Replacing `portrait: boolean` with a three-valued `layout` prop **on the strength of viewport
width alone**. It has been considered and measured, and desktop wants what landscape already
renders.

Two changes *would* reopen it, and neither is about the leaves:

- **The host stops capping the width.** If `/teams/new` ever drops `max-w-5xl` and runs
  full-bleed, three cards stretch past the width the design was drawn for. That is the grid's
  column rule to fix, not a reason for a third layout value.
- **The desktop panel gets materially shorter.** `ArenaReviewMon`'s columns currently fit in
  648px with room to spare; if the host's `h-[calc(100vh_-_8rem)]` shrinks enough that they
  overflow, the landscape choice to scroll each column independently is already the right
  behaviour — that is a host-height question, not a layout-branch question. Phone landscape
  proves it works: the columns scroll there today.
