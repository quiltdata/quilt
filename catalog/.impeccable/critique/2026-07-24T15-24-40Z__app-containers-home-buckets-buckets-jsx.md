---
target: home — workspace bucket list (list-vs-cards, real data)
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 1
timestamp: 2026-07-24T15-24-40Z
slug: app-containers-home-buckets-buckets-jsx
---
# Critique: Home — workspace bucket list (first evaluation on real rendered data)

Method: dual-agent (A: a2be00d00ecaf6f08 design review · B: a63c8d21ab9972af2 detector/browser evidence), isolated contexts, over the live :3000 home in PRODUCT mode. Mode: Operate. First critique of the home body (the 25→31 trend was the chrome slug; this is a new slug). Evaluated against the operator's stated target: the home must serve BOTH lookup and browse, with a lean toward responsive cards (~2–3/row, single-line titles, not too tall).

## Design Health Score — 26/40 (Acceptable)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of status | 3 | Debounced filter, active-filter highlight, skeleton rows, pagination all good; no result/total count ("15 of ~57"); sort "Relevance" opaque with no query |
| 2 | Match to real world | 3 | Scientist-native (s3://, tags, collaborators); "Relevance to what?" unexplained |
| 3 | User control | 2 | Row tags look clickable but are inert `<div>`s; shortcuts replace rather than combine |
| 4 | Consistency | 2 | Two chip vocabularies render identically, behave differently (shortcut=button, row tag=inert); matching-state uses midnight fill where the Indicator Rule says amber |
| 5 | Error prevention | 3 | Read surface; no-match handled cleanly |
| 6 | Recognition | 3 | Titles/s3/shortcuts aid it, but 14/15 identical gray avatars give the scan no landmarks |
| 7 | Flexibility | 3 | One-selector sort efficient; filter has no focus shortcut; 8 tab-stops precede first row; tags can't refine |
| 8 | Minimalist | 2 | ~685px void per row (60% empty) with a lone low-value badge floating in it; ragged heights — accidental negative space, not composed calm |
| 9 | Error recovery | 3 | No-match message clear but offers no in-card clear-filter CTA |
| 10 | Help | 2 | First-timer gets zero orientation (teaching heading deliberately removed); Relevance/collaborator-count meanings unexplained |

## Design-specificity verdict

The bones are authored for a scientific data catalog — `s3://` as a first-class field, curated `relevanceScore` ordering, real tags, a disciplined single-neutral initials avatar, the correctly-executed Mono-Identity list carve-out (`s3://` in body Roboto, not a heavy mono wall). But **at desktop width the rendered result reads generic**: a full-bleed Material list with ~60% of every row empty is indistinguishable from any admin console's "list of things." The domain intelligence lives in the data model more than in what the eye sees.

## Detector

Effectively clean. CLI: one finding — `broken-image` BucketIcon.tsx:64 — **confirmed false positive** (the `<img>` renders only behind a runtime `src && isRenderableIconSrc(src)` guard the static scan can't see). Browser overlay findings are all known/intentional or FP: `layout-transition` (MUI notched-outline + the field/rail width transitions), `side-tab` (the **intentional** amber Indicator bracket, ratified in DESIGN.md — a detector rule that doesn't know our contract), `cramped-padding` (MUI chips), `overused-font` roboto (the committed family). The two `text-occlusion` hits were verified FPs: "Sort" label is a standard shrink-notch MUI label (floats above, doesn't overlap the value); "group" icon 33% is the MUI Badge's normal anchor overlap. Nothing the detector found is a real new defect — the home's problems are composition-judgment problems, invisible to the rule engine.

## Overall impression

Competent, on-register, and thorough in its states — but under-composed, and judged against the wrong baseline. **The current full-bleed list is a broken list, not a fair one**: title + s3 is a ~360px information budget rendered in a 1136px row — a container/content mismatch, not a virtue of lists. The single biggest opportunity is to stop stretching sparse content across full width. That, not "list vs cards" in the abstract, is the decision.

## What's working

1. **Focus ring — exemplary.** 2px `#19163b` at -2px offset wrapping the whole row; textbook Focus Ring Rule conformance, keyboard-verified.
2. **On-register restraint.** Quiet chrome, one accent, no gloss/gradient/coral drift; the `s3://` carve-out correctly avoids the mono wall.
3. **Honest, production-minded states.** Real skeleton rows (not a spinner), distinct zero vs no-match, admin-gated Add Bucket, anonymous-safe rendering.

## Priority issues

- **[P0] The 1440 whitespace void.** Content clusters in the left ~360px; a lone collaborator badge floats at x=1376; the gap averages **~685px ≈ 60% of the row**. Root cause: full-bleed `Container` (`maxWidth={false}`) + a `.content` div with no `flex-grow`. Width-dependent (near-gone at 1024, absent at 760). Fix: cap content width or move to cards.
- **[P0] Inert row tags that look clickable.** Row tag chips are `<div>`s (cursor:default, no handler) while identical-looking shortcut chips above are real buttons — a dead affordance (legacy-LIMS anti-ref) + consistency + control violation. Fix: make row tags real filter buttons; requires decoupling them from the full-row anchor (make title+icon the link, tags independent `<button>`s).
- **[P1] Collaborator count is a padded near-constant presented as data.** Values cluster at 13+/10+/9+ across every row and are sourced partly from workspace-wide *potential* collaborators, not per-bucket actual. It's the only right-side datum, the least informative, yet it anchors the strongest position (far-right aligned) and creates the void. Violates "trust is rendered, not asserted." Fix: drop it from the list/card face until it carries a real per-bucket count; give that slot to a real signal (package count / last write / owner) when the data supports it.
- **[P2] Ragged heights + weak title/s3 hierarchy.** Rows 48–97px (the brief's "uniform height via clamped description" isn't achieved since descriptions are usually absent). Title + s3 are the same 16px on one line, separated only by weight/color. Fix: s3 on its own line at Caption size (already reads better at 760).
- **[P2] Controls layout + filter ergonomics.** Shortcuts sit on a line below the filter; sort hugs far-right leaving a gap; filter has no focus shortcut and sits 8 tab-stops before the first row. Fix: shortcuts beside the filter; add a focus shortcut.

## The list-vs-cards resolution (the centerpiece)

**Recommendation: responsive cards — the operator's lean is right — but conditional, with a specific spec.**

- Cards are the only option that serves BOTH mandates at 1440: they consume the wasted width (kill the void) AND deliver the "wall to scan by feel" that browse needs.
- **The honest caveat:** a card only browses better than a row if it's *full*. Today most buckets have no description, no tags, an identical gray avatar, and a meaningless collaborator count — an empty card browses *worse* than a row and wastes more vertical space. Cards are right **if and only if** metadata enrichment (real icons, descriptions, tags — a data-engineer curation job) actually happens, or the card is designed to look intentional when sparse. If neither, the fallback is a **width-capped list** (~820px, s3 own line, stronger icon, no collaborator badge) — strictly better than today, low-risk, but delivers no browse-wall.
- Lookup stays protected: Relevance default needs no linear scan; filter/name-sort produce small sets where grid reading-order is moot; and fast lookup is *also* served by the global top SearchBar (`/`, Cmd+K).

**Concrete card spec (if cards):** `repeat(auto-fill, minmax(340px, 1fr))`, 16px gap → 2-up ~1024–1550px, 3-up ≥~1600px, 1-up <760 (= the capped list). `align-items: stretch` so a row's cards equalize (no forced-tall empties). Fields: icon 40–48px → **title (loud, 1 line, ellipsis+tooltip)** → **`s3://` own line** (Caption, secondary) → description clamped 2 lines (collapses when absent) → tags max ~4 + "+N", **clickable**. Collaborator count dropped from the card face (or a tiny footer). Clickable tags: title+icon is the link, card body a secondary navigate affordance, tags independent `<button>` chips. Give the initials avatar a bit more presence (palette-legal) so the wall has texture.

## Persona red flags

**Alex (power lookup, keyboard):** 8 tab-stops before the first row; row tags not clickable (no fast tag-refine); filter has no focus shortcut; eye travels across ~685px of emptiness to a badge that says nothing. The density he wants is absent — this list is *sparse*, not dense.

**Scientist first-timer (browse):** nothing orients him to what a "bucket" is (teaching heading removed); 14/15 identical gray avatars give the wall no texture; most rows are title + s3 with no description, so he can't judge "what is this?" at a glance; "Relevance" unexplained. The surface does not currently support browse-by-feel.

## Minor observations

Matching-tag state uses midnight fill; the Indicator Rule says amber — reconcile. No result/total count anywhere. s3:// already wraps to its own line at 760 and reads better — evidence its own line is right at all widths. Description 4.59:1 at 12px is borderline for small text. The one real icon (Fiskus dog) vs 14 gray discs shows how much a real icon aids scanning. The `side-tab`/`broken-image`/`text-occlusion` detector hits are all FPs or intentional-per-contract (noted above).

## Questions to consider

1. The collaborator count is near-identical on every bucket and partly synthesized — what is it doing in the *strongest* position on the primary scan surface, and what real per-bucket signal (package count, last write, owner) would earn that slot instead?
2. Is this two jobs or one? If lookup is served by the global top SearchBar, the home body could **commit fully to browse (a wall of cards)** and stop being a half-hearted lookup list — that reassignment dissolves the list-vs-cards tension.
3. Cards only browse better than rows if they're full, but most buckets are sparse. Are we designing for the data we *have* or the data we wish curators will add — and if the latter, what makes that curation happen?

## Evidence appendix

Measured (1440×900): list Paper full-bleed, no max-width; row inner 1136px; content cluster right edge 660–737px; collaborator badge fixed x=1376; **void avg ~685px ≈ 60% of row** (at 1024 ~25–45px; at 760 gone, s3 wraps own line). Row heights ragged 48–97px. Title 16px/500 16:1; s3 16px/400 Roboto (not mono ✓) 4.59:1; description 12px/400 4.59:1 clamp 2. Row tags inert `<div>`; shortcut chips role=button; matching state midnight fill (not amber). Focus ring 2px #19163b -2px, conforms. Pagination 15/page, ~51–60 buckets. Detector CLI exit 2, 1 finding (broken-image FP); browser overlay findings all known/intentional/FP. Screenshots critiqueA-home-{default-1440,filter-bio-1440,nomatch-1440,default-1024,default-760,focusring-1440}.png in /Users/nl/qhq/wb/dx/.
