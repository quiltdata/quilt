# Product

## Register

product

## Platform

web

## Users

Life-sciences teams working in their own AWS account. Primary: scientists and researchers —
computational biologists, bench scientists with data to find — locating datasets they can trust,
judging them by metadata, provenance, and version history, and reusing them mid-analysis.
Secondary: data engineers and data managers who curate, package, and govern that data — naming
datasets, fixing their state, controlling who reaches what. Admins (stack, identity, buckets) and
AI agents (Qurator in-app; MCP-connected assistants outside it) act on the same surface. The
context is an authenticated work session in the middle of a task — never a casual visit.

## Product Purpose

The web catalog of the Quilt platform: a browsable, searchable, governed surface over versioned
data packages living in place in the customer's own S3. It turns scattered buckets, files, and
spreadsheets into findable, inspectable, versioned datasets — with search across metadata and
content, inline preview, package version history, and admin governance. Success: a scientist
finds the right dataset in minutes and trusts what they found; a data manager curates once and
the team reuses it; results stay reproducible because every dataset's exact state is named and
kept.

## Positioning

Scientific data, unified and trustworthy in your own AWS — every dataset findable, versioned,
and reproducible, for people and for AI.

## Brand Personality

Precise, calm, trustworthy. The interface behaves like a good lab instrument: quiet chrome, exact
numbers, dense where the task demands it, and no marketing energy inside the authenticated app.
Confidence comes from consistency and legibility, not decoration.

## Anti-references

- Consumer-SaaS gloss: gradient CTAs, hero metrics, or marketing chrome bleeding into the
  authenticated app.
- Cloud-console density: the AWS console / Jira failure mode — wall-of-controls, every option
  always visible, no hierarchy of importance.
- Legacy lab software: dated enterprise LIMS — beige chrome, modal mazes, dead affordances.

## Design Principles

- The tool disappears into the task. Earned familiarity over novelty: standard affordances,
  no invented controls for standard jobs.
- Trust is rendered, not asserted. Provenance, versions, hashes, and counts are first-class UI
  with exact values — never decoration, never approximated away.
- One vocabulary everywhere. The same control means the same thing on every surface; a control
  that shape-shifts between screens is a defect, not a variation.
- Density serves the scientist. Information-rich where the task needs it (tables, metadata,
  listings), calm everywhere else; emphasis is rationed deliberately.

## Accessibility & Inclusion

Best-effort, no formal WCAG commitment. Practical floor: body text readable at normal contrast,
keyboard focus visible, reduced motion respected wherever motion exists.
