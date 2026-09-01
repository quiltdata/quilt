---
target: "workspace chrome (sidebar + search band): authed + private logged-out + OPEN anonymous"
total_score: 25
p0_count: 0
p1_count: 6
timestamp: 2026-07-21T11-56-12Z
slug: app-containers-sidebar
---
# Critique: Workspace Chrome (sidebar + search band) — dx-shell-rehome

Method: dual-agent × 2 passes (pass 1 PRODUCT/nightly: A design review + B detector/browser evidence; pass 2 OPEN/anonymous: same split). States covered: authed app, private-stack logged-out (/signin), OPEN-mode anonymous (first-class).

## Design Health Score — 25/40 (Acceptable)

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of status | 2 | Two items lit at once on every authed page; no search-scope cue; auth walls signage-free |
| 2 | Match to real world | 2 | IAM role as "Workspace"; "URI", "Follow", git hash in primary chrome |
| 3 | User control | 3 | Role-switch modal proper; anon escape hatches fine |
| 4 | Consistency | 2 | Two active-state vocabularies (white wash vs amber); actions dressed as destinations; two search shapes on OPEN landing |
| 5 | Error prevention | 3 | Role switch explicit; BUT anon CREATE PACKAGE invites a flow that must fail (OPEN P1) |
| 6 | Recognition | 3 | Icon + label everywhere — genuinely good |
| 7 | Flexibility | 2 | No search shortcut, no palette, no collapse; role switch = full reload |
| 8 | Minimalist | 2 | 2/3-empty search band; sales bot occluding data (OPEN); ever-present hash ×2 on landing |
| 9 | Error recovery | 3 | Thin surface, proper error alert in role dialog |
| 10 | Help | 3 | Docs discoverable; anon AI = sales bot not Qurator |

## Anti-patterns verdict

Not AI slop — earned-familiar purple rail, fluent users would trust it at a glance. Fails its own "Lab Instrument" bar on close reading. Detector (reads JSS in TSX): Sidebar.tsx:88 fontSize 1rem off the DESIGN.md ramp; bounce-easing on /signin; contrast failures below.

**Strongest converged finding: the website register systematically powers the app chrome.** Rail ground = computed #2d306d (Cobalt Trace Deep, filed website-only) via navTheme; Bookmarks badge renders coral in-app; #b2bddb (Web Text Secondary) on white measures 1.9:1 in adjacent lists. NOTE the doctrine conflict: spec (shell.md#workspacenav) says "purple sidebar"; DESIGN.md Two-Registers Rule bans website palette in-app. Operator ruling (2026-07-21): explore both directions in live mode; winner written into DESIGN.md.

**OPEN pass verdict:** an authed shell with marketing bolted on, not a chrome designed for a first-class anonymous user — though the instrument itself works anonymously (search live w/ facets, public buckets browse cleanly, URI resolver + Bookmarks work). DESIGN.md's register mapping is contradicted in BOTH directions: landing+sign-in render app-light inside the shell (doc says website dark), while website palette/marketing chrome (cobalt rail, coral hero, HubSpot sales bot, footer) rides inside the app shell.

## Priority issues (combined backlog)

P1-1 [authed] Two-items-lit active state + amber indicator absent from chrome. Workspace chip wears `selected` permanently (0.16 white fill) beside the true active item (0.24); rail active vocabulary (white wash) disagrees with content (amber underline). Fix: switcher dressed as control; one lit destination; amber as the single indicator. → live structure + layout.

P1-2 [authed] Keyboard focus invisible. Focus wash == selection wash (0.24→0.24 active, 0.16→0.16 switcher); logo ring ~1.8:1 on navy; version-copy is click-only div, no keyboard path; "4 available" ~3.3:1 (AA fail). → harden (held until after live settlement per operator).

P1-3 [OPEN] CREATE PACKAGE dead affordance for anonymous: full create-package modal opens over a bucket they cannot write to; wall deferred past form-fill. PRODUCT.md anti-reference verbatim ("dead affordances"). Fix: gate/replace button for anon, or wall at click with context.

P1-4 [OPEN+private] Sign-in is a cluttered wrong-register moment: full app shell (rail still listing the item that bounced you + live search) around a bare card; no "why" line despite next= being available; Layout has an unused `bare` branch. Fix: bare/focused shell + context line; reconcile register with DESIGN.md.

P1-5 [OPEN] Marketing chrome on every anonymous surface: HubSpot "Talk to Sales" bot floats on landing/bucket/search/sign-in and OCCLUDES content (covered "Latest packages"; covered ADD FILES in the create modal); marketing footer + coral hero inside the app shell. Fix: sales widget to marketing site only; no resting footer in-shell.

P1-6 [OPEN] Duplicate shape-divergent global search on landing: ContentBar rectangle (top) + 40px hero pill (center) + rail Search item — three entries, two visible at once, different shapes, one function. Fix: suppress one; unify control shape.

P2-1 [authed] No responsive collapse — rigid 256px rail at every width (~40% of 640px viewport; WORSE on OPEN: ~32% at 800px colliding with hero + sales bot). Spec gap (WorkspaceNav silent on narrow). → adapt, rides redesign.

P2-2 [authed] Search band under-defined chrome: elevation-1 RESTING shadow (Overlay-Only violation) + rounded bottom corners; 720px field marooned in full-width bar; scope silently flips global↔bucket behind one "Search" placeholder. → polish + clarify.

P2-3 [OPEN] Anonymous AI affordance is a sales bot, not Qurator — "Ask Qurator" absent for anon; HubSpot stands in. Fix: expose Qurator/docs assistant anon, or remove the stand-in.

P2-4 [both] Register boundary smeared; DESIGN.md stale for OPEN + sign-in. Decide register per surface, make DESIGN.md say it, remove leakage accordingly. → contract layer.

P3-1 Language cluster: "URI", "Follow", IAM-role-as-"Workspace", git-describe hash in Roboto (Mono Identity violation), version shown twice on OPEN landing, "hub"/"portal" title drift, stale "Navbar link" label in Admin→Settings. → clarify (held).
P3-2 "Explore your volumes" h3 at website scale under app theme (OPEN landing).

## Pass-1 findings whose character changes in OPEN

- Two-items-lit → MOOT anon (no workspace chip). IAM-as-Workspace → MOOT anon.
- Locked doors/dead search (private logged-out) → DISSOLVES on OPEN (search/browse/URI/bookmarks work; only Queries/Admin/Create wall — but signage-free).
- Responsive collapse → WORSE (anon first-timers on smaller viewports).
- Cobalt rail / coral badge / amber-absent / version-not-mono / ContentBar shadow / focus rings → unchanged.

## What's working

1. Workspace block is a live role switcher on nightly (old dead-affordance finding dissolved; presentation remains).
2. No icon-only affordances anywhere; one icon family.
3. Restraint + cross-page stability (11.96:1 labels, zero layout shift authed home↔bucket↔admin).
4. OPEN: the instrument itself is genuinely anonymous-usable; bucket pages are a credible trustworthy surface (exact readouts, amber tabs).

## Detector evidence appendix

PRODUCT pass: home 11 findings (low-contrast #b2bddb 1.9:1; layout-transition 3; cramped-padding 6); bucket 7 (incl. Ace gutter 2.5:1); /queries 24 + 49×Athena-400 console storm in ~3s (engineering flag); /search 120 (≈90% facet Collapse tree — content scope, ignore for chrome); /signin 5 (bounce-easing 1).
OPEN pass: landing 111 (cramped-padding 100 = public tag chips, content scope; line-length 6; dark-glow 1 = website register present); /b/allencell 89 (line-length 72, skipped-heading 8, tiny-text 1); /search 108 (transitions+clipping in facet tree); console: JSS warning `Referenced keyframes rule "slideDown" is not defined` on landing (engineering flag); no auth-denied errors anon on OPEN (404 content probes only).

## Operator triage (2026-07-21)

1. Rail palette: explore BOTH (indigo-chassis vs sanctioned-purple) as live-mode variant directions; ruling lands in DESIGN.md after.
2. Mechanical conformance fixes (focus rings, AA contrast, mono version, ContentBar border, bounce easing, stale label, 1rem off-ramp) HELD until after live settlement; one combined fix+restructure pass.
3. Live session: ONE COMBINED session — structure + color + collapse explored together per element.

## Questions

1. If the Workspace block is a permission switcher, why is it the head of navigation wearing a permanent selected fill — and is "Workspace" the right word for an IAM role?
2. Which is the real "you are here" — white wash or amber? One indicator everywhere?
3. Is always-on global search earning its top-chrome real estate on sign-in/admin, or occupying prime space page context should define?
4. If anonymous is first-class, why does the first OPEN screen lead with a marketing hero, a sales bot, and two competing search boxes instead of the volume grid that is the product?
5. Doc or build — which is lying about the sign-in register, and can the Two-Registers Rule be enforced before that's decided?
