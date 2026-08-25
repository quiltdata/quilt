---
target: "workspace chrome (sidebar + search band): trend re-run post-redesign, PRODUCT mode"
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-22T18-52-47Z
slug: app-containers-sidebar
---
# Critique: Workspace Chrome (sidebar + search band) — trend re-run after the redesign + fix pass

Method: dual-agent (A: acfae3beeb0b4346a design review · B: a118466d1206b4b51 detector/browser evidence), isolated contexts, sequential over the shared browser. PRODUCT/authenticated mode only (:3000) — the OPEN pass of the 2026-07-21 baseline is NOT re-run this round (:3005 serves an older branch), so the trend is a PRODUCT-chrome comparison; OPEN-specific baseline findings (anon create-package, sales bot, hero duplication) remain open elsewhere (filed warts + shelved homepage leg).

## Design Health Score — 31/40 (Good) · baseline 25/40

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of status | 3 | Amber bracket + sticky band strong; search scope still invisible at rest (affix deferred by ruling) |
| 2 | Match to real world | 2 | "Workspace" over IAM role name (truncated, no tooltip); "ElasticSearch 6.8" leak in dropdown footer |
| 3 | User control | 3 | Esc wipes typed query along with closing the dropdown (one keypress destroys WIP) |
| 4 | Consistency | 4 | Chrome identical across all routes; one vocabulary; deviation: nav links carry role="button" |
| 5 | Error prevention | 3 | '/' guarded against typing contexts; Esc-clears is the residual risk |
| 6 | Recognition | 3 | Keycap advertises '/'; ⌘K unadvertised; truncated role forces recall |
| 7 | Flexibility | 3 | '/', ⌘K, arrow nav, Enter keeps focus+query; no rail collapse, no recents |
| 8 | Minimalist | 4 | Quiet midnight rail, one amber indicator, flat hairline band — nothing performs |
| 9 | Error recovery | 3 | Minimal chrome error surface; defers to pages |
| 10 | Help | 3 | Docs icon + in-dropdown syntax link; footer phrased in implementation jargon |

## Anti-patterns verdict

**Not slop — a designed instrument.** Complete keyboard-focus vocabulary (2px amber rings on all ten rail tabbables, 7.2:1; midnight rings on band icons), an instrument-grade field state ladder, mono discipline on s3:// suggestions, and the only shadow on screen belongs to the one thing that floats. **Detector agrees from the other side: the chrome source scans clean (0 findings, 20 files)**; across three pages the browser detector's single recurring chrome hit is the known MUI notched-outline legend transition — framework-internal, invisible, false positive. All other browser findings are page content below the bar.

## What's working (verified)

- Keyboard focus complete and honest: every rail tabbable shows the amber focus-visible ring; band icons show the midnight ring; '/' focuses the bar from anywhere (measured true); Enter lands on /search with focus and query intact.
- Doctrine holds under measurement: band flat + hairline (Overlay-Only), dropdown the sole overlay at elevation 8, s3:// in Roboto Mono `<code>` (Mono Identity), amber ≪10% (Indicator Rule).
- The seam is resolved: 64px logo block registers exactly with the 64px band; two hairline vocabularies meet at (256, 64).

## Priority issues

- **[P1] Contract drift — DESIGN.md lags the ratified rulings.** Computed rail ground #19163b is what DESIGN.md still calls "Web Midnight… website register only," and its primary is still indigo #282b50. This is the KNOWN deliberate state (rulings ledger authoritative until the contract rewrite, which is the next queued leg) — but the doc/build contradiction is real and the rewrite is now the highest-leverage remaining item.
- **[P1] Nav semantics: no aria-current; links masquerade as buttons.** Selection is visual-only for screen readers; the dropdown has zero combobox ARIA (expanded/controls/activedescendant all null) so arrow selection is silent. Fix rides the omnibar/behavior pass: drop role="button", aria-current="page", combobox pattern.
- **[P2] Search scope invisible at rest** — deliberate deferral (display-only affix built, liked, parked for the omnibar pass by operator ruling).
- **[P3] Escape is destructive** (close + clear + blur in one press) — stage it (close dropdown first, clear on second press); pair with the combobox ARIA work.
- *(Resolved during synthesis: version-row resting contrast 2.6:1 → fixed to ≈4.6:1 in 123cf15b.)*

## Baseline P1s — disposition

Two-items-lit + amber absent → RESOLVED (one selection vocabulary, amber bracket in chrome). Keyboard focus invisible → RESOLVED (complete ring system; the failure had migrated to icon buttons and is fixed). Sign-in wrong-register shell → RESOLVED (auth pages render bare with the minimal midnight header). OPEN P1s (create-package dead affordance, sales bot, hero duplication) → NOT RE-EVALUATED (out of scope this round; tracked as filed warts qhq-1hdl/qhq-bilp + shelved homepage leg).

## Minor observations

Field resting border ≈2.7:1 (just under the 3:1 non-text guideline; icon+placeholder mitigate). "Version:" prose prefix sits inside the mono span (hairline Mono-Identity edge). Row hover 0.06 barely perceptible (ripple carries feedback). Suggestion wrapper 16px vs 14px text spans (harmless). Freeze/authResolved scaffolding still in Sidebar.tsx — deliberate (operator: keep for now), must not ship. Bucket-header wrap at 900px is page content, noted for the content-area leg. Rail fixed 256px, no collapse — the last rail element, still open.

## Questions to consider

1. What separates the two registers now that midnight is the app's own dark? The rewrite should redefine the boundary (coral/gradient quarantine) rather than leave the rule broken.
2. Should the 64px band carry identity (where am I / what will this search), or thin out and give pixels back to data?
3. Is '/' the start of a keyboard vocabulary (discoverable map, '?') or a lone Easter egg?

## Evidence appendix

A: measured computed values across /, /b/example-pharma-data, /search, /queries, /admin/settings at 1440×900 + 900×800 (rail 256/#19163b/white-85 12.6:1; band flat hairline 64px; field 720/0.38 border/placeholder 5.7:1; focus rings amber 7.2:1 rail + midnight band; dropdown elevation-8 z1102; version row mono, role=button; '/' true, Enter-keeps-focus true; ⌘K verified in code — live check intercepted by the session's live-mode toolbar). Screenshots trendA-*.png in /Users/nl/qhq/wb/dx/. B: CLI 0 findings (exit 0, 20 files); browser 1 recurring chrome false positive (MUI notch legend transition), page-content findings out of scope (home 8, bucket 5, /search 118); detect server 8401 started/stopped clean, operator's 8400 untouched.

Fix-pass state at critique time: commits b8f2730f (top-bar settlement) · aebae5b0 (crisp logo 29px) · dab9f36e (palette.navigation + rail de-provider + FinalBoundary) · cf3c4f1a (NavBar cluster retired, auth bare) · a4ffb050 (navTheme/websitePalette deleted, footer death, register retreat, /install redirect, profile un-gated) · f5518d9e (conformance batch) · 123cf15b (version-row AA).
