# Quilt Catalog

React + Material-UI v4 (JSS) frontend for the Quilt data platform. See
[README.md](./README.md) for configuration and running it locally.

## Design Context

Read before designing or changing UI:

- [PRODUCT.md](./PRODUCT.md) — who the catalog serves, positioning, brand
  personality, anti-references, design principles.
- [DESIGN.md](./DESIGN.md) — the visual-system contract ([design.md
  format](https://github.com/google-labs-code/design.md)): design tokens plus
  doctrine (named rules for color, typography, elevation, components). UI
  changes conform to it; when a change genuinely needs the contract to move,
  update DESIGN.md in the same diff.
- `.impeccable/` — machine sidecar and live-mode config for design-aware
  tooling; session state is not source.
