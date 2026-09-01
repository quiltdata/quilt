---
target: home — workspace bucket card grid (polished)
total_score: 33
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
timestamp: 2026-07-24T17-09-47Z
slug: app-containers-home-buckets-buckets-jsx
---
# Critique: Home bucket card grid — trend re-run after cards + polish

Method: dual-agent (A: aa3779c944aa4b7e4 design review · B: a270b6c96ea82f278 detector/browser evidence), isolated, live :3000 PRODUCT. Mode: Operate, browse-led. Same slug as the 26/40 list baseline (trend continuity).

## Design Health Score — 33/40 (Good) · was 26/40

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of status | 3 | Amber match feedback + live filter excellent; no result/total count on the wall |
| 2 | Match to real world | 4 | s3:// names, funnel "Filter buckets", "or use shortcuts", Relevance/Name sort — speaks the dialect |
| 3 | User control | 3 | Clear-X works; clicking an already-matching chip re-sets rather than toggles off |
| 4 | Consistency | 4 | One amber selection vocabulary shared by in-card + shortcut chips; card/chip/button/focus all tokenized |
| 5 | Error prevention | 4 | Filter non-destructive; tag clicks preventDefault/stopPropagation; zero/no-match handled |
| 6 | Recognition | 3 | Enriched cards recognize well; sparse cards + identical neutral initials discs erode browse-by-feel |
| 7 | Flexibility | 3 | Debounced filter + shortcuts fast; funnel is separate from the top SearchBar (which doesn't route to buckets yet); no focus hotkey |
| 8 | Minimalist | 3 | Quiet, rationed, void gone; undercut by the 424px wide-screen dead band + sparse-card airiness |
| 9 | Error recovery | 3 | "No buckets matching X" clear; no in-place clear affordance |
| 10 | Help | 3 | Zero-state teaches (admin/non-admin); "Relevance" sort + collab count unexplained |

## Design-specificity verdict

Reads as a genuine instrument surface, not generic SaaS tiles: it honors every measurable contract rule (amber matching = wash+border not fill; all focus targets ring in midnight counter-color; cards border-first shadowless; s3:// in body type per the carve-out), and the card format is fitted to the browse-a-wall job. Specificity is strong at the *system* level, thin at the *per-card-content* level on sparse deployments — where the near-constant collaborator count becomes the only metadata and drifts toward the identical-card-grid anti-goal.

## Detector

Effectively clean. CLI exit 2, 2 findings: `broken-image` BucketIcon.tsx:69 (**false positive** — the `<img>` at line 116 is behind the runtime `isRenderableIconSrc` guard the static scan can't see); `design-system-font-size 18px` Collaborators.tsx:40 (**noted** — the group-icon glyph dimension, not a text-ramp violation; icon sizing isn't governed by the type ramp). Browser overlay findings are all global chrome or MUI defaults, none card-grid defects: `side-tab` = our own amber Indicator bracket (intentional per DESIGN.md), `text-occlusion` "Sort" = MUI shrink-label FP, `overused-font` roboto = committed family, `layout-transition` = MUI notched-outline legends, `cramped-padding` = MUI Chip default padding on the filter-bar shortcut chips (confirmed by B: persists on the zero-card no-match page, so it's the chips not the cards). Nothing real or new.

## Overall impression

Clearly better than the 26/40 list — a solid step to ~33. The defect that made it "look off" (the ~685px per-row list void, then the 68–76px sparse-card void) is measurably gone: content-height cards (`align-items: start`) run 138px sparse → 202px enriched, border wrapping content tightly, empty space in the grid cell outside the card, never inside. The wall now reads as discrete bordered objects. The biggest remaining opportunity is per-card *signal*: the sole metadata readout (collaborator count) is near-constant across the wall, so browse-by-feel still leans on reading titles.

## What's working

1. **The void is gone (measured).** 138–202px content-height cards, `align-items: start`, `box-shadow: none`; no internal void, no forced-tall empties. This was THE defect — fixed and verifiable.
2. **High contract discipline.** Amber matching `rgba(251,140,0,0.15)` wash + `1px #fb8c00` border (Indicator Rule, never a fill), one vocabulary across in-card + shortcut chips; focus rings `2px #19163b` on card link + all chips + collaborator button; Overlay-Only borders; s3:// in body Roboto.
3. **The collaborator readout is quiet now** — transparent ground, secondary-ink 18px icon + 12px caption, no dark pill; a calm footer, not a prime-slot anchor. Exactly the brief's intent.

## Priority issues

- **[P1] Near-constant collaborator count is the only per-card metadata — noise, not signal.** Nearly every card reads "13+" (few "10+", one "9+"); a readout identical across the wall gives browse no discriminator while implying a signal it lacks (PRODUCT.md "trust is rendered, not asserted"). Fix: ship the deferred real signal (package/object count or last-write) the moment a field exists; until then consider demoting the count (hover-only or lighter) so it stops implying discrimination it doesn't carry.
- **[P2] Sparse-card wall risks the identical-grid anti-goal.** On sparse deployments the differentiators (description, tags, real icon) vanish and the initials discs are one neutral. Fix: favor real iconUrl where available (the one custom-icon card visibly out-textures the disc rows); consider slightly more per-bucket variance in the avatar within palette limits; let s3:// carry a touch more contrast on sparse cards.
- **[P3] Wide-screen dead band.** At 1904 the 1200px cap leaves 424px empty, and the body is left-aligned so it reads as unused rather than as margin. Fix: center the capped column in the content region (the cap-vs-sprawl call is right; the left-alignment is what makes the gutter read dead). ~1 line.
- **[P3] Two search-like fields.** Funnel filter narrows the wall; the top SearchBar reads as search but doesn't route to buckets yet. Fix: interim copy/tooltip clarifying the funnel narrows *this wall*; longer-term wire the SearchBar per the brief.
- **[P3] s3:// and description are tonally identical** (both 0.54 ink, 14 vs 12px) — on enriched cards the two muted lines blur. Nudge description lighter or s3:// darker.

## Trend judgment

26/40 (list) → 33/40 (polished cards). Improved: the per-row/sparse void eliminated; wall reads as discrete objects with hover; amber matching replaced the midnight fill (Indicator Rule honored); collaborator went loud-pill → quiet footer; focus rings consistent; 3/2/1-up cap kills sprawl. Regressed: nothing structural — the only new cost is the wide-screen right-margin dead band (deliberate, fixable by centering). Still open: thin per-card metadata, sparse-card slop risk, two search fields, s3/description flatness.

## Persona red flags

**Alex (power user, known bucket):** funnel + shortcut chips make targeted narrowing fast; but the `/` `⌘K` hotkey focuses the top SearchBar (doesn't resolve to buckets yet) — reflex won't filter this wall; must use the lower funnel. Collaborator count gives no at-a-glance discriminator, so he reads titles/s3 line by line.
**Scientist browsing to discover:** enriched cards browse well (description + tags are the hooks); on a sparse deployment those vanish, initials discs are one neutral, and the count reads "13+" nearly everywhere — browse-by-feel collapses to reading titles, and a constant number masquerades as signal.

## Minor observations

Long titles ellipsize + tooltip (confirmed). >4 tags collapse to a caption "+N more" (quiet). No result/total count on the wall. At 760 the filterRow stays row (MUI xs=600) so shortcuts + Sort wrap awkwardly under the filter — consider the xs column break at sm. Card hover bg→action.hover + border→text.secondary, no shadow (correct). Loading = 6 skeleton card silhouettes, reduced-motion respected.

## Questions to consider

1. If the sole per-card metadata is near-constant and the useful signals are deferred, is the collaborator footer earning its row, or is it decoration dressed as data — the exact thing PRODUCT.md forbids?
2. The cap trades 424px of ultrawide canvas for a tidy 3-up. On a lab's wide monitor, does browse-by-feel want fewer-bigger cards, or more-smaller (4-up) showing more buckets per scroll?
3. When the sparse case is the *majority* on a deployment, does the card format backfire — making thin data look thinner than a compact row would?

## Evidence appendix

Void gone (1440): sparse card 138px, Production (4 chips) 174px, enriched-with-description 166–202px; `align-items: start`, `box-shadow: none`. Columns/width: 1904 → 3-up @389, cap 1200 biting, 424px left-aligned right margin; 1440 → 3-up @368; 1024 → 2-up @352; 760 → 1-up @456. Grid `repeat(auto-fill, minmax(340px,1fr))` gap 16. Collaborator readout: transparent, no border, `rgba(0,0,0,0.54)`, icon 18px + count 12px. Matching chips (in-card + shortcut): bg `rgba(251,140,0,0.15)`, border `1px #fb8c00`, text `#000000de`. Title `#000000de` 20px/500 nowrap+ellipsis+tooltip; s3 `rgba(0,0,0,0.54)` 14px body (not mono); description `rgba(0,0,0,0.54)` 12px clamp 2. Initials disc `rgba(0,0,0,0.16)` 44×44 12/500. Focus rings `2px #19163b` on card link + tag chips + shortcut chips + collaborator. Detector CLI exit 2 (broken-image FP + 18px icon noted); browser findings all global-chrome/MUI-default/intentional. Screenshots critiqueA2-home-{1440-default,1440-filter-bio,1440-nomatch,1904-wide,1024-2up,760-1up}.png in /Users/nl/qhq/wb/dx/.
