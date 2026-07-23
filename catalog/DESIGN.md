---
name: Quilt Catalog
description: The web catalog of the Quilt platform — versioned scientific data, browsable in place on the customer's own S3.
colors:
  primary: "#19163b"
  midnight-chassis: "#19163b"
  midnight-chassis-deep: "#100e28"
  amber-indicator: "#fb8c00"
  navigation-text: "rgba(255, 255, 255, 0.85)"
  navigation-text-muted: "rgba(255, 255, 255, 0.6)"
  navigation-hover: "rgba(255, 255, 255, 0.06)"
  navigation-selected: "rgba(255, 255, 255, 0.18)"
  info-blue: "#039be5"
  info-blue-wash: "#e1f5fe"
  warning-amber: "#fff59d"
  warning-amber-deep: "#f57f17"
  canvas: "#fafafa"
  surface: "#ffffff"
  ink: "#000000de"
  ink-secondary: "#0000008a"
  divider: "#0000001f"
typography:
  display:
    fontFamily: "Roboto, Helvetica, Arial, sans-serif"
    fontSize: "3rem"
    fontWeight: 300
    lineHeight: "3.5rem"
  headline:
    fontFamily: "Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 400
    lineHeight: 1.334
  title:
    fontFamily: "Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 500
    lineHeight: 1.6
  body:
    fontFamily: "Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
  label:
    fontFamily: "Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.75
    letterSpacing: "0.02857em"
  caption:
    fontFamily: "Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.66
  overline:
    fontFamily: "Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.6
    letterSpacing: "0.06em"
  mono:
    fontFamily: "Roboto Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  sm: "2px"
  md: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.midnight-chassis}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
  button-primary-hover:
    backgroundColor: "{colors.midnight-chassis-deep}"
  button-outlined:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.midnight-chassis}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "5px 15px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  navigation-rail:
    backgroundColor: "{colors.midnight-chassis}"
    textColor: "{colors.navigation-text}"
    width: "256px"
  search-band:
    backgroundColor: "{colors.surface}"
    borderBottom: "1px solid {colors.divider}"
    height: "64px"
  chip:
    backgroundColor: "#e0e0e0"
    textColor: "{colors.ink}"
    rounded: "16px"
    height: "32px"
---

## 1. Overview

**Creative North Star: "The Lab Instrument."** The catalog is a
well-calibrated instrument: quiet chrome, exact readouts, dense
where precision demands it, and nothing on screen performs. Users are scientists
and data engineers in the middle of a task — the interface earns trust the way
an instrument does, through consistency, legibility, and exact values, never
through decoration. Emphasis is rationed: one accent used sparingly beats three
used freely, and the loudest element on any screen is the user's data.

The system has **one register**. The instrument runs the light theme — white
working surfaces on a near-white canvas — framed by midnight chrome: the
navigation rail and the primary actions carry the one dark that says "Quilt."
The former marketing/website register (coral, cobalt, gradients, dark hero
grounds) is retired; its energy has no home inside the product. Bare moments
(sign-in, terminal errors) wear a stripped variant of the same register, never
a different one. Per PRODUCT.md, the system explicitly rejects consumer-SaaS
gloss, cloud-console density, and legacy-lab-software chrome.

**Key Characteristics:**

- Single-family typography (Roboto), with Roboto Mono reserved for machine-exact
  identity.
- Midnight chrome around white working surfaces; one amber accent as the
  indicator.
- Flat-leaning depth: borders and tonal separation first, shadows for true
  overlays only.
- Standard Material affordances; density serves the task, calm serves everything
  else.

## 2. Colors

A restrained instrument palette: midnight chassis, white surfaces, one amber
indicator.

### Primary

- **Midnight Chassis** (#19163b): the app's structural chrome — the navigation
  rail's ground, primary buttons, focus rings on light surfaces, links in their
  strongest form. This is the color that says "Quilt" inside the product; there
  is one dark, product-wide. (`primary` is its role alias for role-keyed
  consumers; same value, one color.)
- **Midnight Chassis Deep** (#100e28): the pressed/hover depth of the chassis;
  never a surface of its own.

### Secondary

- **Amber Indicator** (#fb8c00): the instrument's indicator light — selection,
  attention cues, and keyboard focus on midnight ground. An accent, never a
  surface. In chrome it renders as the selection bracket (see the Indicator
  Rule) and as the focus ring on the rail.

### Navigation (the chrome's own strokes)

On the midnight ground, text and state washes come from the navigation slice —
white at fixed alphas, not theme grays:

- **Navigation Text** (85% white): labels and icons at rest (full white +
  medium weight when selected).
- **Navigation Text Muted** (60% white): section labels, secondary readouts.
- **Navigation Hover** (6% white) / **Navigation Selected** (18% white): the
  row washes. Selection additionally wears the amber bracket.

### Neutral

- **Canvas** (#fafafa): the app's page ground behind all surfaces.
- **Surface** (#ffffff): cards, tables, panels — where work happens.
- **Ink** (#000000de) / **Ink Secondary** (#0000008a): primary and secondary
  text, Material's standard alpha ramp.
- **Divider** (#0000001f): hairline separation within and between surfaces.
- **Info Blue** (#039be5, wash #e1f5fe) and **Warning Amber** (#fff59d, deep
  #f57f17): semantic states, used with their standard Material meanings.

### Retired

The website register's palette — coral (#f38681), cobalt (#5471f1, #2d306d,
#6a93ff), and the muted web text (#b2bddb) — is removed along with its themes
(`navTheme`, `websitePalette`). Web Midnight was promoted to the primary above;
the rest does not come back. Do not reintroduce these values; a surface that
seems to need them needs a different design.

### Named Rules

**The Indicator Rule.** Accents indicate — selection, state, attention. One
selection vocabulary product-wide: the selected item wears the amber indicator
— a 3px bracket on the rail's selected nav item, the underline on a content
tab — alongside its wash. An accent on ≤10% of any screen; an accent used as
decoration is a defect. Amber is never a surface, a tint, or a fill.

**The One-Register Rule.** The product has one register: the instrument. No
gradient CTAs, coral accents, hero typography, or marketing chrome anywhere —
including sign-in, error pages, and anonymous surfaces, which wear the bare
variant of the same register. (Legacy OPEN-landing surfaces are pending
conformance under the homepage redesign.)

**The Focus Ring Rule.** Keyboard focus is never invisible: a 2px ring in the
counter-color of the ground — Amber Indicator on midnight chrome, Midnight
Chassis on light surfaces — with the standard Material focus behaviors kept
underneath.

## 3. Typography

**Body Font:** Roboto (Helvetica, Arial fallback) — weights 300/400/500
**Label/Mono Font:** Roboto Mono (monospace fallback) — weights 400/700

**Character:** One utilitarian family carries everything; hierarchy comes from
size and weight steps, not from face changes. The mono face is a semantic
signal, not a style.

### Hierarchy

- **Display** (300, 3rem, 3.5rem line): legacy landing surfaces only, pending
  the homepage redesign; never in the app.
- **Headline** (400, 1.5rem, 1.334): page-level headings in the app (Material
  h5).
- **Title** (500, 1.25rem, 1.6): section and card headings (Material h6).
- **Body** (400, 0.875rem, 1.43): the workhorse — table cells, descriptions,
  prose (Material body2; 1rem body1 for roomier prose). Prose runs ≤75ch.
- **Label** (500, 0.875rem, 0.02857em tracking, UPPERCASE): buttons and control
  labels — Material's standard button treatment.
- **Caption** (400, 0.75rem, 1.66): fine print and compact readouts — the
  version row, keycap hints, helper lines.
- **Overline** (500, 0.6875rem, 0.06em tracking, UPPERCASE): the chrome's
  section labels (the rail's "Workspace"); a signpost step, never body text.
- **Mono** (400, 0.875rem): machine-exact identity — see the rule below.

### Named Rules

**The Mono Identity Rule.** Anything content-addressed or machine-exact —
hashes, `s3://` URIs, package handles, version ids — renders in Roboto Mono.
Prose never does.

**The No-Display-Font Rule.** Display sizes and the 300 weight have no home in
the app; nothing outranks a Headline. They linger only on legacy landing
surfaces pending the homepage redesign.

## 4. Elevation

Flat-leaning: surfaces at rest are delineated by borders (Divider, #0000001f)
and tonal separation (Surface on Canvas), not by shadows. Shadows are reserved
for true overlays — menus, dialogs, drawers, toasts — where something genuinely
floats above the working plane. Low Material elevations (1–2) on resting cards
exist in the current code and are tolerated, but the direction of travel is
border-delineated flatness; do not add new resting shadows.

### Shadow Vocabulary

- **Overlay** (Material elevation 8, e.g. menus, the search suggestions): the
  standard floating-control depth.
- **Modal** (Material elevation 24, dialogs): the strongest depth in the system.

### Named Rules

**The Overlay-Only Rule.** A shadow means "this floats above the plane and will
leave." If it doesn't leave, it doesn't get a shadow — it gets a border.

## 5. Components

Refined and restrained: standard Material anatomy, exact values, no flourish.
Every control uses the same vocabulary on every screen.

### Buttons

- **Shape:** gently rounded (4px).
- **Primary:** Midnight Chassis fill, white uppercase label (0.875rem/500),
  6px 16px padding.
- **Hover / Focus:** fill deepens to Midnight Chassis Deep; focus is the
  standard Material ripple + the Focus Ring Rule. Transitions 150–250ms,
  standard easing.
- **Outlined / Text:** midnight label on transparent ground; same label
  treatment. No gradient fills anywhere (One-Register Rule).

### Chips

- **Style:** Material default — #e0e0e0 ground, Ink text, fully rounded (16px),
  32px height.
- **State:** selection carries the accent per the Indicator Rule; deletable
  chips use the standard affordance.

### Cards / Containers

- **Corner Style:** 4px.
- **Background:** Surface white on Canvas ground.
- **Shadow Strategy:** border-first per Elevation; legacy elevation 1 tolerated
  at rest.
- **Internal Padding:** 16px (24px for roomy panels).

### Inputs / Fields

- **Style:** Material text fields on Surface; label + input in Body scale.
- **Focus:** primary-color focus treatment (underline/outline shift), standard
  Material.
- **Error:** Material error red with helper text; never color alone.

### Navigation (the chrome)

- **The rail:** a persistent 256px Midnight Chassis sidebar worn by every
  screen — the one dark mass on screen. Split layout: the brand mark at a 64px
  logo block; an Overline section label above the workspace box (the role
  switcher — a faint bordered box, row = role name + chevron when switchable,
  "Switch workspace" as the action's name); the nav list (icon 20px in a 34px
  column, 16px inset, whole-row hover wash, 44px rows); a spacer; the identity
  box at the foot; the version readout (Caption + Mono) under it. Selection =
  Navigation Selected wash + the amber bracket (Indicator Rule); keyboard focus
  per the Focus Ring Rule. Icon actions carry tooltips with arrows.
- **The search band:** the top bar is chrome, not a card — Surface white,
  full-bleed to the rail's edge, square, flat (no resting shadow), delineated
  by a Divider hairline, height-registered at 64px with the rail's logo block
  so one header line crosses the seam. The field sits left-aligned (max 720px):
  white with a visible 1px border, faint leading search icon that warms on
  focus, a `/` keycap hint that hides while typing; `/` and Cmd/Ctrl+K focus it
  from anywhere. Its suggestions dropdown is a true overlay (elevation 8) with
  `s3://` scopes in Mono.
- **Bare pages:** sign-in and terminal errors wear the bare header — a static
  64px Midnight Chassis band carrying only the mark as a home link — with the
  page content centered beneath. No nav, no search, no marketing (One-Register
  Rule).
- **Tabs & sub-nav:** per-area tab bars stay in-page and use the standard
  Material tab anatomy; the active tab's underline is the same selection
  vocabulary as the rail's bracket (Indicator Rule).

### Data Identity (signature)

- Hashes, URIs, package handles, and versions render in Roboto Mono at Body
  size, usually with a copy affordance; exact values are never truncated without
  a tooltip or copy escape hatch.

## 6. Do's and Don'ts

### Do

- **Do** keep the instrument quiet: white surfaces, midnight chrome, one accent
  indicating — the data is the loudest thing on screen.
- **Do** use Roboto Mono for every hash, URI, handle, and version (the Mono
  Identity Rule).
- **Do** delineate resting surfaces with borders and tone; save shadows for
  things that float (the Overlay-Only Rule).
- **Do** use the same control vocabulary everywhere — a control means one thing
  on every screen.
- **Do** show exact values: real counts, real timestamps, real sizes, with copy
  affordances.
- **Do** give every interactive element a visible keyboard focus (the Focus
  Ring Rule).

### Don't

- **Don't** let consumer-SaaS gloss into the app: no gradient CTAs, no hero
  metrics, no marketing chrome (PRODUCT.md anti-reference, verbatim).
- **Don't** drift toward cloud-console density: no wall-of-controls, no
  every-option-visible screens without hierarchy (PRODUCT.md anti-reference).
- **Don't** regress toward legacy lab software: no beige chrome, no modal mazes,
  no dead affordances — anything styled as interactive must act (PRODUCT.md
  anti-reference).
- **Don't** reintroduce the retired website palette — coral, cobalt, gradients
  (the One-Register Rule); there is one dark and it is the Midnight Chassis.
- **Don't** signal state with color alone; pair color with text or iconography.
- **Don't** use display sizes or the 300 weight inside the app.
