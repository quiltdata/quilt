---
name: Quilt Catalog
description: The web catalog of the Quilt platform — versioned scientific data, browsable in place on the customer's own S3.
colors:
  primary: "#282b50"
  indigo-chassis: "#282b50"
  indigo-chassis-deep: "#1d2146"
  amber-indicator: "#fb8c00"
  info-blue: "#039be5"
  info-blue-wash: "#e1f5fe"
  warning-amber: "#fff59d"
  warning-amber-deep: "#f57f17"
  canvas: "#fafafa"
  surface: "#ffffff"
  ink: "#000000de"
  ink-secondary: "#0000008a"
  divider: "#0000001f"
  web-midnight: "#19163b"
  coral-signal: "#f38681"
  coral-signal-light: "#fabdb3"
  cobalt-trace: "#5471f1"
  cobalt-trace-deep: "#2d306d"
  cobalt-sky: "#6a93ff"
  web-text-secondary: "#b2bddb"
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
    backgroundColor: "{colors.indigo-chassis}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 16px"
  button-primary-hover:
    backgroundColor: "{colors.indigo-chassis-deep}"
  button-outlined:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.indigo-chassis}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "5px 15px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  app-bar:
    backgroundColor: "{colors.indigo-chassis}"
    textColor: "#ffffff"
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

The system has **two registers in one codebase**. The authenticated app (the
instrument) runs the light theme: white surfaces on a near-white canvas, deep
indigo chrome, Roboto throughout. The marketing/website register (landing pages,
sign-in) runs a separate dark theme — web-midnight ground, coral and cobalt
accents, gradient buttons — and that energy is quarantined there: it never
enters the authenticated app. Per PRODUCT.md, the system explicitly rejects
consumer-SaaS gloss, cloud-console density, and legacy-lab-software chrome.

**Key Characteristics:**

- Single-family typography (Roboto), with Roboto Mono reserved for machine-exact
  identity.
- Deep indigo chrome around white working surfaces; one amber accent as the
  indicator.
- Flat-leaning depth: borders and tonal separation first, shadows for true
  overlays only.
- Standard Material affordances; density serves the task, calm serves everything
  else.

## 2. Colors

A restrained instrument palette: indigo chassis, white surfaces, one amber
indicator — with a separate dark marketing set that stays out of the app.

### Primary

- **Deep Indigo Chassis** (#282b50): the app's structural chrome — app bar,
  primary buttons, active-state fills, links in their strongest form. This is
  the color that says "Quilt" inside the product. (`primary` is its role alias
  for role-keyed consumers; same value, one color.)
- **Indigo Chassis Deep** (#1d2146): the pressed/hover depth of the chassis;
  never a surface of its own.

### Secondary

- **Amber Indicator** (#fb8c00): the instrument's indicator light — secondary
  actions, selection highlights, attention cues. An accent, never a surface.

### Tertiary (website register only)

- **Web Midnight** (#19163b): the dark ground of marketing/website pages.
- **Coral Signal** (#f38681, light #fabdb3): the website's primary accent;
  carries the gradient CTA treatment there.
- **Cobalt Trace** (#5471f1, deep #2d306d) and **Cobalt Sky** (#6a93ff): the
  website's secondary and tertiary accents.
- **Web Text Secondary** (#b2bddb): muted text on midnight ground.

### Neutral

- **Canvas** (#fafafa): the app's page ground behind all surfaces.
- **Surface** (#ffffff): cards, tables, panels — where work happens.
- **Ink** (#000000de) / **Ink Secondary** (#0000008a): primary and secondary
  text, Material's standard alpha ramp.
- **Divider** (#0000001f): hairline separation within and between surfaces.
- **Info Blue** (#039be5, wash #e1f5fe) and **Warning Amber** (#fff59d, deep
  #f57f17): semantic states, used with their standard Material meanings.

### Named Rules

**The Indicator Rule.** Accents indicate — actions, selection, state. An accent
on ≤10% of any app screen; an accent used as decoration is a defect.

**The Two-Registers Rule.** The dark coral/cobalt marketing palette belongs to
the website register exclusively. No gradient, coral, or midnight ground ever
appears inside the authenticated app; no bare canvas-gray utilitarianism leaks
onto marketing pages.

## 3. Typography

**Body Font:** Roboto (Helvetica, Arial fallback) — weights 300/400/500
**Label/Mono Font:** Roboto Mono (monospace fallback) — weights 400/700

**Character:** One utilitarian family carries everything; hierarchy comes from
size and weight steps, not from face changes. The mono face is a semantic
signal, not a style.

### Hierarchy

- **Display** (300, 3rem, 3.5rem line): website-register hero headings only;
  never in the app.
- **Headline** (400, 1.5rem, 1.334): page-level headings in the app (Material
  h5).
- **Title** (500, 1.25rem, 1.6): section and card headings (Material h6).
- **Body** (400, 0.875rem, 1.43): the workhorse — table cells, descriptions,
  prose (Material body2; 1rem body1 for roomier prose). Prose runs ≤75ch.
- **Label** (500, 0.875rem, 0.02857em tracking, UPPERCASE): buttons and control
  labels — Material's standard button treatment.
- **Mono** (400, 0.875rem): machine-exact identity — see the rule below.

### Named Rules

**The Mono Identity Rule.** Anything content-addressed or machine-exact —
hashes, `s3://` URIs, package handles, version ids — renders in Roboto Mono.
Prose never does.

**The No-Display-Font Rule.** Display sizes and the 300 weight exist for the
website register. Inside the app, nothing outranks a Headline.

## 4. Elevation

Flat-leaning: surfaces at rest are delineated by borders (Divider, #0000001f)
and tonal separation (Surface on Canvas), not by shadows. Shadows are reserved
for true overlays — menus, dialogs, drawers, toasts — where something genuinely
floats above the working plane. Low Material elevations (1–2) on resting cards
exist in the current code and are tolerated, but the direction of travel is
border-delineated flatness; do not add new resting shadows.

### Shadow Vocabulary

- **Overlay** (Material elevation 8, e.g. menus): the standard floating-control
  depth.
- **Modal** (Material elevation 24, dialogs): the strongest depth in the system.

### Named Rules

**The Overlay-Only Rule.** A shadow means "this floats above the plane and will
leave." If it doesn't leave, it doesn't get a shadow — it gets a border.

## 5. Components

Refined and restrained: standard Material anatomy, exact values, no flourish.
Every control uses the same vocabulary on every screen.

### Buttons

- **Shape:** gently rounded (4px); website-register buttons are squarer (2px).
- **Primary:** Deep Indigo Chassis fill, white uppercase label (0.875rem/500),
  6px 16px padding.
- **Hover / Focus:** fill deepens to Indigo Chassis Deep; focus is the standard
  Material ripple + visible focus state. Transitions 150–250ms, standard easing.
- **Outlined / Text:** indigo label on transparent ground; same label treatment.
  The gradient contained buttons (coral/cobalt) are website-register only.

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

### Navigation

- **App chrome:** Deep Indigo Chassis app bar (the dark navTheme band), white
  controls; tabs use the standard Material tab anatomy with the active tab
  clearly selected; breadcrumbs render path segments as links with the current
  segment inert.

### Data Identity (signature)

- Hashes, URIs, package handles, and versions render in Roboto Mono at Body
  size, usually with a copy affordance; exact values are never truncated without
  a tooltip or copy escape hatch.

## 6. Do's and Don'ts

### Do

- **Do** keep the instrument quiet: white surfaces, indigo chrome, one accent
  indicating — the data is the loudest thing on screen.
- **Do** use Roboto Mono for every hash, URI, handle, and version (the Mono
  Identity Rule).
- **Do** delineate resting surfaces with borders and tone; save shadows for
  things that float (the Overlay-Only Rule).
- **Do** use the same control vocabulary everywhere — a control means one thing
  on every screen.
- **Do** show exact values: real counts, real timestamps, real sizes, with copy
  affordances.

### Don't

- **Don't** let consumer-SaaS gloss into the authenticated app: no gradient
  CTAs, no hero metrics, no marketing chrome (PRODUCT.md anti-reference,
  verbatim).
- **Don't** drift toward cloud-console density: no wall-of-controls, no
  every-option-visible screens without hierarchy (PRODUCT.md anti-reference).
- **Don't** regress toward legacy lab software: no beige chrome, no modal mazes,
  no dead affordances — anything styled as interactive must act (PRODUCT.md
  anti-reference).
- **Don't** use the coral/cobalt/midnight website palette inside the app (the
  Two-Registers Rule).
- **Don't** signal state with color alone; pair color with text or iconography.
- **Don't** use display sizes or the 300 weight inside the app.
