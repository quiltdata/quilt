---
version: 1
slug: "home"
primary_target: "app/containers/Home/Buckets/Buckets.jsx"
related_targets: ["app/containers/Home/BucketGrid/BucketList.tsx"]
---

# Home — workspace bucket browse

**Mode:** Operate — the visitor completes a task; scanability, consistency, and the real usage scene outrank expression. Brand lives in precise details, not decoration.

## Job & audience

A signed-in scientist or data engineer lands in their workspace mid-task and **browses the buckets they can reach — scanning a wall to find the one they need by feel**: title, `s3://` name, description, tags, icon. This is a **browse/discovery** surface, not a lookup form. (Known-item lookup will ride the global top SearchBar once it resolves to buckets — it does not today — but the home body's job is browse; in-page **filtering is kept** as a browse aid, not the primary path.) Never a casual visit; always mid-analysis. Anonymous OPEN visitors reach the same surface for public buckets.

## Outcome & proof

Primary action: scan the wall → recognize a bucket → open it. Each **card** is the proof object: icon, real title, exact `s3://` name, description, tags, and the collaborator count. Every card is a discrete object to scan, not a strip in a void.

## Selected direction

Inside the committed instrument world (DESIGN.md — midnight chrome, white surface); **no new visual world**. **Responsive card grid** — the operator's ruling (2026-07-24), after a list build + critique (26/40) showed a full-bleed list wastes ~60% of each row on sparse data. Cards consume the width by tiling and serve browse-by-feel; the list is retired.

- **Grid:** `repeat(auto-fill, minmax(~340px, 1fr))`, ~16px gap → **2-up at mid widths, 3-up on wide, 1-up on narrow**. `align-items: stretch` so cards in a row equalize height — no forced-tall empties. Not too tall.
- **Card content, top→bottom:** per-bucket **icon** (~40–48px; `iconUrl`, else the initials-avatar fallback — initials from the title on a muted, palette-legal disc; no glyph library, no arbitrary hex) → **title** (loud, **single line**, ellipsis + `title` tooltip for the rare long one) → **`s3://` name on its own line** (quiet secondary ink — **not** mono; Mono-Identity carve-out) → **description** (small/muted Caption, clamped ~2 lines; collapses cleanly when absent) → **tags** (clickable — max ~4 + "+N"). **Collaborator count:** kept, but off the title line — a **quiet muted footer readout** (PRODUCT mode), not anchoring a prime slot.
- **Assume metadata is present:** design the card for the **enriched** case (real icon, description, tags) as the primary look — that's the intended state, present on many deployments. But it MUST **degrade gracefully** when a field is absent (some deployments are sparse): a card of just icon + title + `s3://` still reads as intentional, never as a broken/empty shell.
- **Clickable tags without a nested-anchor conflict:** the card's **icon + title is the navigation link**; tags are independent `<button>` filter chips; the card body may carry a secondary navigate affordance. (The prior list made the whole row one anchor, which is why tags had to be inert — resolved here.)
- **Controls row above the grid:** the **funnel-filter** field (icon search→funnel, kills the double-magnifier confusion with the top-bar SearchBar), the **tag-shortcut chips moved beside the filter** (not below — wrap under it only at narrow widths), and a **single sort selector** — Relevance / Name A–Z / Name Z–A — **default Relevance** (`relevanceScore` desc + name tiebreak, preserving admin curation; the `relevanceScore >= 0` hide filter unchanged).

**Mono-Identity carve-out (already reconciled in DESIGN.md + sidecar):** the Mono Identity Rule is scoped to identity read/copied exactly (detail views, breadcrumbs, hashes) — **not** a repeated scanning label across a wall of cards, where mono reads heavy. The `s3://` name renders in body type, secondary ink.

## Scope & boundaries

Production-ready; one surface (`/` home body). **Kept from the list build:** funnel filter icon, the sort selector, empty/skeleton states, the admin-only "Add bucket" button beneath the grid, `BucketGrid.tsx` deletion (the new cards are the redesigned `BucketList.tsx` family, not Simon's reverted card grid). **Untouched:** the shell (rail, top bar), pagination (15/page), routing into buckets. **Anti-goals:** consumer-SaaS gloss (no gradient/hero cards), the identical-card-grid slop (icon+heading+text tiles repeated with no product signal), and empty cards that browse worse than a row.

**Page heading — reversed 2026-08-22 (operator ruling).** This brief previously
kept "no 'Explore your buckets' heading" from the list build. The page now
carries a visible `h1` reading **Volumes**. Two things forced the reversal:

- **A11y.** With the heading omitted the page had no top-level heading at all —
  and this is what `/` renders whenever the `front-door` flag is off, so it is
  the landing page for most stacks. No `h1` is a WCAG 1.3.1 / 2.4.6 failure for
  anyone navigating by heading. The omission was a deliberate composition
  decision; its accessibility cost was not weighed at the time.
- **The end-to-end canaries.** `waitForHomePage` (quiltdata/e2e `shared/auth.ts`)
  used the old heading's text as its "login landed" signal, so all four canaries
  failed at `serviceLogin` the moment it disappeared. Fixed properly by keying
  the check to `data-testid="landing-heading"` rather than any wording — the
  anchor is now the contract, so this copy stays free to change. That id is on
  the front door's greeting `h1` too, and deliberately *not* on its error
  fallback: a page that failed to load must not read as a healthy login.

Treatment, so this does not drift back toward the marketing heading it replaces:
`variant="h5" component="h1"` — semantically the page's h1, visually a Headline,
matching FrontDoor's greeting. **Not** the old `variant="h1"` display size, which
the No-Display-Font Rule now forbids. One quiet line above the controls row; it
labels the surface, it is not a hero. Copy is "Volumes", consistent with the rail
nav, the `/buckets` tab title, and the front-door tile ("Bucket" stays the
internal word — routes, `s3://` names). Covered by tests in `Buckets.spec.tsx`.

## States & ranges

Buckets: 1 (first-run) · dozens (typical) · hundreds (paginated 15/page). Cover: **first-run/zero** (teaching empty state — "No buckets yet"; admins get the add path, non-admins a plain line), **no-filter-match**, **loading** (skeleton cards, not a spinner), **sparse card** (missing description/tags/custom icon — must still look intentional), **anonymous OPEN** (public buckets, no add button).

## Interaction & layout

Page order: `h1` ("Volumes") → controls row (filter, tag shortcuts, sort, view toggle) → card grid → admin add path. The heading is the page's only h1; cards carry no heading element, so the document outline stays one level deep and a card title never competes with the page label.

Hierarchy within a card: icon + title loudest; `s3://` quiet beneath; description small/muted; tags a calm interactive band; collaborator count a quiet footer. Funnel-filter narrows live (debounced); tag chips (shortcuts and in-card) quick-filter; sort selector reorders; visible keyboard focus per the Focus Ring Rule on the card link and every chip; reduced motion respected. Card heights equalize per row; titles never wrap.

## Constraints & open decisions

MUI v4 / JSS; conforms to DESIGN.md (no new tokens expected). Initials-avatar treatment: a single quiet palette-legal neutral (give it a touch more presence than the list version so the wall has texture), never a name-hashed rainbow, never arbitrary hex.

Deferred, not invented — the metadata slot: **package/object count** and **last write** are the genuinely valuable per-bucket signals for a browse wall, but neither is readily available today (no cheap field; `lastIndexed` means last-bulk-rescan, not data freshness, and isn't wired on the backend `Bucket` type). Add them to the card when the data supports it (ES max-timestamp aggregation / a new backend field / a count field); until then the collaborator count is the one metadata readout.
