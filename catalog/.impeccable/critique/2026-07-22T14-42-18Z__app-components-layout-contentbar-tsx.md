---
target: top bar (ContentBar) — scoped visual critique, post-midnight-rail
total_score: 16
p0_count: 2
p1_count: 2
timestamp: 2026-07-22T14-42-18Z
slug: app-components-layout-contentbar-tsx
---
# Critique: Top Bar (ContentBar) — scoped, post-midnight-rail context

Method: dual-agent (A: aa2601abeb9d4e10e — design review · B: a5a8e8bd1a9ff4f39 — detector/browser evidence), run sequentially over the shared operator browser, isolated contexts. Pages: :3000 /, /b/example-pharma-data, /search, /queries; :3005 OPEN landing. 1440×900 + 900×800.

Scope note: this is a targeted critique of the top bar only, feeding its visual redesign. It does not supersede the 2026-07-21 full-chrome baseline (25/40, slug app-containers-sidebar); the bar-scoped score below is not comparable to that trend.

## Design Health Score — 16/40 (Poor, scoped to the bar)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of status | 1 | Scope (global/bucket/bound) renders zero pixels at rest; bare "Search" placeholder everywhere; bound mode on /search visually identical |
| 2 | Match to real world | 2 | Honest scope sentences in dropdown; but "ElasticSearch 6.8" leaks implementation; «guillemets» idiosyncratic |
| 3 | User control | 2 | Esc/click-away work; no clear-field (X); Tab force-closes dropdown and blurs |
| 4 | Consistency | 1 | Selection vocabulary splits from rail (amber bracket vs anonymous gray fill); band geometry mutates padded↔flush while keeping rounded corners; two search idioms on OPEN landing |
| 5 | Error prevention | 1 | Silent global↔bucket scope flip invites wrong-corpus searches; Enter commits an unseen first suggestion |
| 6 | Recognition | 2 | Scope recognizable only after focus; keyboard behaviors exist but unadvertised |
| 7 | Flexibility | 1 | `/` and Cmd+K verified dead; no recents; no inline scope switch; home autofocuses the WRONG input (filter, not bar) |
| 8 | Minimalist | 2 | Third depth vocabulary (floating card); 272px dead gap at 1440px; ES version string clutter |
| 9 | Error recovery | 1 | Suggestions render nothing on empty/failure — the bar goes silent |
| 10 | Help | 3 | Docs adjacent; in-dropdown "advanced search syntax" link genuinely good |

## Anti-patterns verdict

**Not AI-slop — pre-design.** A stock MUI OutlinedInput in a stock AppBar running theme defaults (elevation 1, default radius, 0.42-alpha placeholder). Honest and restrained, but next to the deliberately designed midnight rail it reads as the one piece of chrome the instrument treatment hasn't reached.

**Deterministic scan: clean.** detect.mjs over ContentBar.tsx + SearchBar/**: 0 findings (verified with --no-config; no disable comments). The bar's problems are design-judgment problems — depth vocabulary, scope legibility, composition — invisible to the rule engine. Browser detector across 3 pages found exactly one recurring in-bar hit: `layout-transition` on MUI's PrivateNotchedOutline legend — framework-intrinsic, label width permanently 0, transition never fires: **false positive**. (75 findings on /search are page-content: facet-tree Collapse noise, chips — out of scope.) Caveat: dropdown was closed during browser scans; its source was covered by the clean CLI scan.

## Overall impression

Behaviorally coherent, visually unfinished. The band is a floating card pretending to be chrome: it carries a resting shadow the contract forbids, rounds its corners like a page element, sits 24px adrift of the rail, and holds a 272px dead gap — while the actual overlay (the dropdown) is visually indistinguishable from it. The single biggest opportunity: the band is exactly 64px and the rail's logo block is exactly 64px — commit the bar to chrome and make one continuous header line cross the midnight/white boundary.

## What's working

- **Text-column registration**: dropdown items pad 44px so suggested text aligns exactly with the typed text column — a real crafted detail.
- **Latent 64px registration line**: band height == rail logo block height; the seam can read as one line for free.
- **Honest scope sentences** ("Search all packages in s3://…") beat iconified scope pickers for a scientific audience; popper width locks to the field, never misaligns.

## Priority issues

- **[P0] Scope/mode invisible at rest.** The most consequential search parameter (which corpus) renders zero pixels until focus; /search's bound mode is undetectable. Wrong-scope searches are silent errors for scientists who must trust results. Fix: scope affix inside the field (mono face per the Mono Identity Rule) + a distinct bound treatment. *(Interactive scope control is deferred by operator ruling; a display-only affix is the visual-pass option.)*
- **[P0] Accessibility floor.** No aria-label, no combobox/listbox semantics (dropdown open + arrow selection silent to SR); icon buttons' focus-visible state computes to nothing (ripple-only). Fix: combobox semantics + visible 2px midnight focus ring on icon actions.
- **[P1] Depth vocabulary inverted.** Band carries elevation 1 at rest (Overlay-Only violation, ContentBar.tsx L65) while the dropdown — the true overlay — carries the identical shadow. Fix: band → elevation 0 + bottom hairline; dropdown → overlay depth (elevation 8 per DESIGN.md Shadow Vocabulary).
- **[P1] Rail seam unresolved.** Midnight rail (flat, 1px white-12% edge) → 24px gutter → white floating card with rounded bottom corners; geometry mutates on flush pages (full-bleed, x=256) while keeping the radius. Fix: commit to chrome — full-bleed to the rail edge, square corners, hairline bottom, 64px registered with the rail logo line.
- **[P2] Composition + token conformance cluster.** 720px field + 272px dead gap + orphaned 48px icon pair (compose the width intentionally: field placement, shortcut hint, actions). Placeholder ≈2.6:1 and dropdown help caption ≈2.7:1 both fail AA; bar text runs 16px against the 14px body scale; s3:// URIs in the dropdown render Roboto 500, not mono (Mono Identity violation).

## Persona red flags

**Alex (power user):** `/` and ⌘K dead — every search is a mouse trip; home autofocuses the filter field, not the bar. Tab closes the dropdown instead of completing (inverts autocomplete muscle memory). Enter commits a suggestion Alex may never have seen. No recents, no scope toggle; /search's 500ms live binding is good but unannounced.

**Sam (keyboard/SR):** textbox named only by placeholder; dropdown opening + arrow selection never announced; suggestion Links unreachable by Tab; icon-button keyboard focus effectively invisible. Field's own focus ring (2px #19163b, ~17:1) is fine — the prior "invisible focus" finding has migrated from the field to the actions cluster.

## Minor observations

- No bottom hairline on the sticky band: scrolled content separates by shadow alone, passes through the rounded-corner notches.
- Band shadow paints into the rail gutter, emphasizing the card reading (rail z 1101 above band z 1100 — stacking correct).
- «data» guillemets: charming but nonstandard; tone call.
- No loading/error affordance while suggestions resolve.
- Icon color 0.54 alpha ≈ 4.6:1 — passes.
- OPEN landing runs three search-like inputs at once (bar 720×40, hero pill 960×80, filter 360×40) — the duplication the omnibar unit exists to kill.

## Questions to consider

1. If the bar is chrome, why does it dress like a card? Should it be the rail's horizontal continuation — one 64px header line crossing midnight into white — rather than a floating strip 24px adrift?
2. Scope is the search's most consequential parameter and its only invisible one. Would a mono-face scope affix inside the field solve scope legibility, the mono violation, and the dead-gap composition in a single move?
3. OPEN landing runs the lab-instrument bar and a consumer hero pill simultaneously — the exact "consumer-SaaS gloss" PRODUCT.md rejects. Which is THE search? (Ruled: the bar; the pill dies in the workspace-home leg.)

## Evidence appendix

Measured (computed, 1440×900, :3000): band 1136×64 @ x=280 (padded pages; full-bleed 1184 @ x=256 flush), sticky, z 1100, #fff, elevation-1 shadow, radius 0 0 4px 4px. Rail 256px #19163b, border-right rgba(255,255,255,.12), z 1101, logo block 64px. Field 720×40 @ x=304; outline 1px rgba(0,0,0,.23) → hover .87 → focus 2px #19163b (~17:1); input 16px; placeholder ≈2.6:1. Gap field→actions 272px @1440 (0 @900, field flexes to 452px). Icons 48×48, 4.6:1, focus-visible: none. Dropdown: 720px paper, marginTop 4, radius 4, elevation-1 (identical to band), items 44px/16px, selected rgba(0,0,0,.08), help 12px ≈2.7:1, s3:// in Roboto 500. Keyboard: `/`, ⌘K dead; Tab → URI-resolver button. OPEN: bar 720×40 + pill 960×80 + filter 360×40.

Detector: CLI 0 findings (scoped source clean). Browser: 1 recurring in-bar false positive (notched-outline legend transition, framework-intrinsic); page-content findings out of scope (home 7, bucket 3, /search 74). Live-server on 8402 started/stopped cleanly; operator's live helper on 8400 untouched.

Screenshots: critiqueA-home-default/scrolled/focused/dropdown, critiqueA-bucket-default/focused-dropdown, critiqueA-searchpage-bound, critiqueA-queries, critiqueA-narrow-900, critiqueA-open-landing (in /Users/nl/qhq/wb/dx/).

Prior-findings verification vs 2026-07-21 baseline: elevation-1 shadow STILL TRUE; rounded corners STILL TRUE (both variants); marooned 720px field STILL TRUE; silent scope flip STILL TRUE; no shortcut STILL TRUE (measured); near-invisible focus SUPERSEDED — field ring now visible (midnight), failure migrated to icon buttons.
