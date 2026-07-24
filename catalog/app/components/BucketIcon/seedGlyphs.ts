// Seeded life-sciences glyph library for BucketIcon.
//
// Each glyph is authored in a 24x24 box and rendered on the 149-unit disc via
// transform="translate(35.5 35.5) scale(3.25)". Filled glyphs paint with
// currentColor; stroked (line-art) glyphs set fill:none and stroke:currentColor.
//
// This is the refined library: one cohesive set of life-sciences doodads drawn
// on a shared 24-box with a consistent visual weight, so a wall of default
// buckets reads as a designed family rather than a clip-art grab-bag. Each entry
// carries a stable `name` (the machine identity used by the admin picker and the
// `quilt-glyph:<name>` icon scheme) and a human `label` for the picker UI.
//
// ORDER IS A CONTRACT for the *website register only*: the landing grid hashes
// bucket names into these indices to pick a default doodad, so reordering
// reshuffles which unconfigured bucket shows which glyph. It does NOT affect
// buckets that have an explicit icon (custom URL or `quilt-glyph:<name>`) — those
// resolve by name, not index. Append new glyphs at the end; when you must
// reorder, know that unconfigured buckets get a one-time cosmetic reshuffle.

export interface Glyph {
  // stable machine identity — the value stored as `quilt-glyph:<name>` and the
  // key the picker round-trips. Never change an existing name.
  name: string
  // human-readable label for the admin picker
  label: string
  // 24-box SVG path data
  path: string
  // line-art glyphs render stroked (fill:none, stroke:currentColor); solid
  // glyphs render filled. Colocated with the path so the two never drift.
  stroke?: boolean
}

// The picker groups glyphs under category headings so a ~200-glyph library is
// scannable instead of a flat wall. Categories are metadata *over* the existing
// GLYPHS order, not a reordering of it: each entry marks the array index where a
// category begins, and every glyph belongs to the last category whose startIndex
// is ≤ its own index. This keeps the ORDER-IS-A-CONTRACT invariant intact (the
// website register hashes bucket names into GLYPHS indices) while letting the
// admin picker render real, data-driven headings. To recategorize, move a
// boundary's startIndex — never reorder GLYPHS.
export interface GlyphCategory {
  name: string
  // index into GLYPHS where this category's run begins
  startIndex: number
}

// The one source of truth. Everything else (SEED_GLYPHS, STROKE_GLYPHS, the
// picker) derives from this list.
export const GLYPHS: readonly Glyph[] = [
  // — Glassware & vessels ————————————————————————————————————————————————
  {
    name: 'flask',
    label: 'Erlenmeyer flask',
    path: 'M9 2h6v2h-1v4.2l4.8 9.1A2 2 0 0 1 17 20.2H7a2 2 0 0 1-1.8-2.9L10 8.2V4H9zm3 2v4.7L8.6 15h6.8L12 8.7zm-4.2 13h8.4l-1-2H8.8z',
    stroke: false,
  },
  {
    name: 'test-tube',
    label: 'Test tube',
    path: 'M8 2v14.5a4 4 0 0 0 8 0V2zm2 2h4v8.5h-4zm0 10.5h4v2a2 2 0 0 1-4 0z',
    stroke: false,
  },
  {
    name: 'beaker',
    label: 'Beaker',
    path: 'M7 3h10v2h-1v4.2l3.3 8.3A2 2 0 0 1 16.4 21H7.6a2 2 0 0 1-1.9-3.5L9 9.2V5H7zm4 2v4.6L9 14h6l-2-4.4V5z',
    stroke: false,
  },
  {
    name: 'round-flask',
    label: 'Round-bottom flask',
    path: 'M10 2h4v2.2a6.5 6.5 0 1 1-4 0zm2 4.5A4.5 4.5 0 1 0 12 15.5 4.5 4.5 0 0 0 12 6.5z',
    stroke: false,
  },
  {
    name: 'vial',
    label: 'Vial',
    path: 'M9 2h6v2h-1v14.5a2 2 0 0 1-4 0V4H9zm3 3.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    stroke: false,
  },
  {
    name: 'graduated-cylinder',
    label: 'Graduated cylinder',
    path: 'M8 2h8v2h-1v14.5a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V4H8zm3 3v2.5h2V5zm0 4v2.5h2V9zm0 4v4h2v-4z',
    stroke: false,
  },
  {
    name: 'reagent-bottle',
    label: 'Reagent bottle',
    path: 'M10 2h4v2.6l1.4 1.4A2 2 0 0 1 16 7.4V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V7.4a2 2 0 0 1 .6-1.4L10 4.6zm-1 9h6v7h-6z',
    stroke: false,
  },
  { name: 'funnel', label: 'Funnel', path: 'M3 4h18l-7 9v7l-4-2v-5z', stroke: false },
  {
    name: 'dropper',
    label: 'Dropper',
    path: 'M9.8 2.5h4.4a0.8 0.8 0 0 1 0.8 0.8V5h-6V3.3a0.8 0.8 0 0 1 0.8-0.8zM8.6 5h6.8a1.5 1.5 0 0 1 1.5 1.5v9.8a1.7 1.7 0 0 1-1.7 1.7H8.8a1.7 1.7 0 0 1-1.7-1.7V6.5A1.5 1.5 0 0 1 8.6 5zM11.6 19.6h0.8L12 22z',
    stroke: false,
  },
  {
    name: 'petri-dish',
    label: 'Petri dish',
    path: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm-2 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-1 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    stroke: false,
  },

  // — Instruments & tools ———————————————————————————————————————————————
  {
    name: 'microscope',
    label: 'Microscope',
    path: 'M15.8 3.6a2.2 2.2 0 0 1 0 3.1l-1 1 1.1 1.1-1.4 1.4-1.1-1.1-1 1a2.2 2.2 0 0 1-3.1-3.1l3.4-3.4a2.2 2.2 0 0 1 3.1 0zM9.7 11l2 2-1.9 1.9A5 5 0 0 1 12.5 19H16v2H5v-2h1.5a5 5 0 0 1 1.9-4.2zM8 19h6a3 3 0 0 0-6 0z',
    stroke: false,
  },
  {
    name: 'pipette',
    label: 'Pipette',
    path: 'M9.6 2.6h4.8a1 1 0 0 1 1 1v1.1a1 1 0 0 1-1 1h-4.8a1 1 0 0 1-1-1V3.6a1 1 0 0 1 1-1zM11.1 6.7h1.8v1.2h-1.8zM8.7 9.6a2.2 2.2 0 0 1 2.2-2.2h2.2a2.2 2.2 0 0 1 2.2 2.2v3.9a2.2 2.2 0 0 1-1.3 2l-.6 2.6h-2.8l-.6-2.6a2.2 2.2 0 0 1-1.3-2zM11.2 18.1h1.6l-.5 2.1a.3.3 0 0 1-.6 0zM12 20.9a1.05 1.05 0 0 1 1.05 1.05 1.05 1.05 0 0 1-2.1 0A1.05 1.05 0 0 1 12 20.9z',
    stroke: false,
  },
  {
    name: 'magnifier',
    label: 'Magnifier',
    path: 'M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3-1.4 1.4-4.3-4.3A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z',
    stroke: false,
  },
  {
    name: 'thermometer',
    label: 'Thermometer',
    path: 'M12 2.5a3 3 0 0 1 3 3v7.7a5 5 0 1 1-6 0V5.5a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v8.8l-.5.4a3 3 0 1 0 3 0l-.5-.4V5.5a1 1 0 0 0-1-1z',
    stroke: false,
  },
  {
    name: 'balance',
    label: 'Analytical balance',
    path: 'M12 3v15M7 20h10M5 8h14M5 8l-2.2 4.6a3 3 0 0 0 4.4 0zM19 8l-2.2 4.6a3 3 0 0 0 4.4 0z',
    stroke: true,
  },
  {
    name: 'syringe',
    label: 'Syringe',
    path: 'M14.5 3 21 9.5M18 6l-9.5 9.5L7.5 19 4 20l1-3.5L14.5 7M8.5 12.5l2 2M11.5 9.5l2 2',
    stroke: true,
  },
  {
    name: 'centrifuge',
    label: 'Centrifuge',
    // Benchtop unit read from the front: domed lid + rotor bowl + lid handle. The
    // earlier rounded-rectangle rotor housing collapsed into a cloud silhouette at
    // the 24px blind-read gate; this domed-lid form keeps a distinct centrifuge
    // identity down to 24px.
    path: 'M4 6h16a1 1 0 0 1 1 1v2a9 9 0 0 1-18 0V7a1 1 0 0 1 1-1zm2.5 5.5a5.5 5.5 0 0 0 11 0zM10 3h4v3h-4z',
    stroke: false,
  },
  {
    name: 'scalpel',
    label: 'Scalpel',
    path: 'M3 21a0.6 0.6 0 0 1-0.8-0.8l7.9-7.9 1.4 1.4-7.9 7.9zM12.2 11.8 20.8 4.2a0.6 0.6 0 0 1 0.9 0.8l-6.6 9.2a8 8 0 0 1-3.9-2.4z',
    stroke: false,
  },
  {
    name: 'microplate',
    label: 'Microplate',
    path: 'M3 5h18v14H3zm3.5 3a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm5.5 0a1.3 1.3 0 1 0 0 2.6A1.3 1.3 0 0 0 12 8zm5.5 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM6.5 13.4a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm5.5 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm5.5 0a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
    stroke: false,
  },
  {
    name: 'incubator',
    label: 'Incubator',
    path: 'M4 4h16v16H4zm3.5 3v10m9-10v10M12 8.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    stroke: true,
  },
  {
    name: 'magnet',
    label: 'Magnet',
    path: 'M4.5 12a7.5 7.5 0 0 1 15 0v2.5h-5V12a2.5 2.5 0 0 0-5 0v2.5h-5zM4.5 15.5h5V19h-5zm10 0h5V19h-5z',
    stroke: false,
  },
  {
    name: 'ruler',
    label: 'Ruler',
    path: 'M3 8h18v8H3zm3.5 0v3M10 8v4m3.5-4v3M17 8v4',
    stroke: true,
  },

  // — Genetics & molecules ——————————————————————————————————————————————
  {
    name: 'dna-helix',
    label: 'DNA helix',
    path: 'M7 3c0 4 10 5 10 9s-10 5-10 9M17 3c0 4-10 5-10 9s10 5 10 9M8.2 6h7.6M8.2 18h7.6M9.6 9h4.8M9.6 15h4.8',
    stroke: true,
  },
  {
    name: 'chromosome',
    label: 'Chromosome',
    path: 'M7.6 3.3a2 2 0 0 1 2.8.4L12 6.1l1.6-2.4a2 2 0 1 1 3.2 2.2L14.4 12l2.4 4.1a2 2 0 1 1-3.2 2.2L12 15.9l-1.6 2.4a2 2 0 1 1-3.2-2.2L9.6 12 7.2 7.9a2 2 0 0 1 .4-4.6z',
    stroke: false,
  },
  {
    name: 'molecule',
    label: 'Molecule',
    path: 'M12 3.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM5.5 11.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm13 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 7.5v3m-1.4 2-3.2 1.6m9.6 0-3.2-1.6',
    stroke: true,
  },
  {
    name: 'benzene',
    label: 'Benzene ring',
    path: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zm0 3.2 5 2.9v5.8l-5 2.9-5-2.9V9.1z',
    stroke: true,
  },
  {
    name: 'rna-strand',
    label: 'RNA strand',
    path: 'M12 3c0 4.5 4 4.5 4 9s-4 4.5-4 9M12.5 6h3M15 9.5h-3M12.5 13h3M15 16.5h-3',
    stroke: true,
  },
  {
    name: 'protein-fold',
    label: 'Protein fold',
    path: 'M6 6a3 3 0 0 1 0 6h6a3 3 0 0 1 0 6M6 6a2 2 0 1 0 0 .01M18 18a2 2 0 1 0 0 .01M6 12h6',
    stroke: true,
  },
  {
    name: 'peptide-chain',
    label: 'Peptide chain',
    path: 'M4 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4 2h1.8l2.2 2 2.2-2H16m2-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13v3',
    stroke: true,
  },
  {
    name: 'gene-edit',
    label: 'Gene editing',
    path: 'M4 11h6.5v2H4zm9.5 0H20v2h-6.5zM11 7.5l3 4.5-3 4.5-1.5-1 2.2-3.5-2.2-3.5zm2 0-3 4.5 3 4.5 1.5-1-2.2-3.5 2.2-3.5z',
    stroke: false,
  },
  {
    name: 'base-pairs',
    label: 'Base pairs',
    path: 'M7 4v16M17 4v16M7 7.2h10M7 12h10M7 16.8h10',
    stroke: true,
  },
  {
    name: 'antibody',
    label: 'Antibody',
    path: 'M12 21v-7.5l-4.5-5.5M12 13.5l4.5-5.5M7.5 8V3.5M16.5 8V3.5',
    stroke: true,
  },
  {
    name: 'enzyme',
    label: 'Enzyme',
    path: 'M4 5L9.5 5A1.5 1.5 0 0 1 11 6.5L11 9.5A2.5 2.5 0 0 0 11 14.5L11 17.5A1.5 1.5 0 0 1 9.5 19L4 19A1.5 1.5 0 0 1 2.5 17.5L2.5 6.5A1.5 1.5 0 0 1 4 5ZM15.5 7L18.5 7A1.5 1.5 0 0 1 20 8.5L20 15.5A1.5 1.5 0 0 1 18.5 17L15.5 17A1.5 1.5 0 0 1 14 15.5L14 14.2A2.2 2.2 0 0 0 14 9.8L14 8.5A1.5 1.5 0 0 1 15.5 7Z',
    stroke: false,
  },
  {
    name: 'crystal',
    label: 'Crystal',
    path: 'M6.5 9L8.8 12L9 20L4.5 20L4.8 13ZM17 5.5L19.5 11L19 20L14.5 20L14.8 11ZM12 3L14.5 8L14 20L10 20L9.5 8Z',
    stroke: false,
  },

  // — Cells & microbiology ——————————————————————————————————————————————
  {
    name: 'cell',
    label: 'Cell',
    path: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zm-2.4 6a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm4.6 1a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8zm-2.6 3.6a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z',
    stroke: false,
  },
  {
    name: 'cell-division',
    label: 'Cell division',
    path: 'M9 12a5 5 0 1 0-10 0 5 5 0 0 0 10 0zm16 0a5 5 0 1 0-10 0 5 5 0 0 0 10 0zM9 12h6',
    stroke: true,
  },
  {
    name: 'neuron',
    label: 'Neuron',
    path: 'M7.3 8.2a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM4.6 8.3 1.4 5.1M3.8 11.7H.6M4.6 15.1 1.4 18.3M10.8 11.7h7.8M18.6 11.7l2.7-2.8M18.6 11.7l2.7 2.8',
    stroke: true,
  },
  {
    name: 'mitochondria',
    label: 'Mitochondria',
    path: 'M2.5 12C2.5 8 6 5.5 12 5.5C18 5.5 21.5 8 21.5 12C21.5 16 18 18.5 12 18.5C6 18.5 2.5 16 2.5 12ZM5.5 9.2C5.5 8 6.5 7.6 8 7.6L8 12.4L10.5 12.4L10.5 7.6C12.5 7.6 15.5 7.6 15.5 7.6L15.5 12.4L18 12.4L18 8C19 8 18.7 9 18.7 9.5M6 15C6 16 6.8 16.4 8.5 16.4L8.5 11.6L11 11.6L11 16.4L13.5 16.4L13.5 11.6L16 11.6L16 16.4C17.5 16.4 18.5 16 18.5 14.8',
    stroke: true,
  },
  {
    name: 'virus',
    label: 'Virus',
    path: 'M7 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0ZM16.5 12.9 L20.0 12.9 L20.0 11.1 L16.5 11.1ZM14.55 15.82 L17.02 18.29 L18.29 17.02 L15.82 14.55ZM11.1 16.5 L11.1 20.0 L12.9 20.0 L12.9 16.5ZM8.18 14.55 L5.71 17.02 L6.98 18.29 L9.45 15.82ZM7.5 11.1 L4.0 11.1 L4.0 12.9 L7.5 12.9ZM9.45 8.18 L6.98 5.71 L5.71 6.98 L8.18 9.45ZM12.9 7.5 L12.9 4.0 L11.1 4.0 L11.1 7.5ZM15.82 9.45 L18.29 6.98 L17.02 5.71 L14.55 8.18ZM18.6 12.0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM16.26 17.66a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM10.6 20.0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM4.94 17.66a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM2.6 12.0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM4.94 6.34a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM10.6 4.0a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0ZM16.26 6.34a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0Z',
    stroke: false,
  },
  {
    name: 'bacteria',
    label: 'Bacteria',
    path: 'M16.25 14L10.75 14A3 3 0 0 1 10.75 8L16.25 8A3 3 0 0 1 16.25 14ZM8 8.5Q5.5 5.7 4 7.3Q2.6 8.7 1.8 7.3Q2.8 8.3 4 8.7Q5.5 8.9 8 9.9ZM8 10.3Q5.5 9 4 10.6Q2.6 12 1.8 10.6Q2.8 11.6 4 12Q5.5 12.2 8 11.7ZM8 12.1Q5.5 12.3 4 13.9Q2.6 15.3 1.8 13.9Q2.8 14.9 4 15.3Q5.5 15.5 8 13.5ZM11.3 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0ZM14.7 11a1 1 0 1 0 2 0a1 1 0 1 0 -2 0Z',
    stroke: false,
  },
  {
    name: 'microbe',
    label: 'Microbe',
    path: 'M12 3.4c1.6 0 1.9 1.4 3.3 1.6 1.3.2 2.4-.9 3.3 0s-.2 2-.1 3.3c.1 1.4 1.6 1.7 1.6 3.3s-1.5 1.9-1.6 3.3c-.1 1.3.9 2.4 0 3.3s-2-.2-3.3-.1c-1.4.1-1.7 1.6-3.2 1.6s-1.9-1.5-3.3-1.6c-1.3-.1-2.4.9-3.3 0s.2-2 .1-3.3C5.5 13.7 4 13.6 4 12s1.5-1.9 1.6-3.3c.1-1.3-.9-2.4 0-3.3s2 .2 3.3.1C10.3 4.9 10.5 3.4 12 3.4Z M9.8 9.4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z M14.6 9.9a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z M11.2 15a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
    stroke: true,
  },
  {
    name: 'sprout',
    label: 'Sprout',
    path: 'M12 21 L12 11 M12 11 C9 11 6 9.5 5.5 6.5 C8.5 6.5 11 8 12 11 M12 11 C15 11 18 9.5 18.5 6.5 C15.5 6.5 13 8 12 11',
    stroke: true,
  },
  {
    name: 'leaf',
    label: 'Leaf',
    path: 'M5 19C4 12 8 4 20 4c0 12-8 16-15 15zm3-3c3-5.2 6-7.2 9-8',
    stroke: true,
  },
  {
    name: 'fish',
    label: 'Zebrafish',
    path: 'M3 12c3-4.2 9-4.2 12 0-3 4.2-9 4.2-12 0zm12 0 6-3v6zM6.8 11a1 1 0 1 0 0 .01',
    stroke: true,
  },

  // — Charts & measurement ——————————————————————————————————————————————
  {
    name: 'bar-chart',
    label: 'Bar chart',
    path: 'M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z',
    stroke: false,
  },
  {
    name: 'line-chart',
    label: 'Line chart',
    path: 'M4 4v16h16M7.5 15l3-4 3 2 4-6',
    stroke: true,
  },
  {
    name: 'scatter-plot',
    label: 'Scatter plot',
    path: 'M4 4v16h16M8 15a1 1 0 1 0 0 .01M12 10.5a1 1 0 1 0 0 .01M16 13a1 1 0 1 0 0 .01M14 7.5a1 1 0 1 0 0 .01',
    stroke: true,
  },
  {
    name: 'histogram',
    label: 'Histogram',
    path: 'M4 20V13h3v7zm4 0V8h3v12zm4 0v-9h3v9zm4 0V6h3v14z',
    stroke: false,
  },
  {
    name: 'normal-curve',
    label: 'Normal distribution',
    path: 'M3 18c4.5 0 4-11 9-11s4.5 11 9 11M3 18h18',
    stroke: true,
  },
  {
    name: 'gauge',
    label: 'Gauge',
    path: 'M4 16a8 8 0 1 1 16 0M12 16l4.5-4.5M12 16a1 1 0 1 0 0 .01',
    stroke: true,
  },
  {
    name: 'ecg',
    label: 'ECG trace',
    path: 'M3 12h4l2-6 3 12 2-8 1.5 4H21',
    stroke: true,
  },
  {
    name: 'pie-chart',
    label: 'Pie chart',
    path: 'M12 3a9 9 0 1 0 9 9h-9zM11 3.05A9 9 0 0 0 3.05 11H11z',
    stroke: false,
  },
  {
    name: 'clipboard-data',
    label: 'Data clipboard',
    path: 'M8 3h8v3H8zM6 5h2v3h8V5h2v16H6zm3 7h6v2H9zm0 4h4v2H9z',
    stroke: false,
  },
  {
    name: 'barcode',
    label: 'Sample barcode',
    path: 'M4 5h1v14H4zm2 0h1v14H6zm2 0h2v14H8zm3 0h1v14h-1zm2 0h2v14h-2zm3 0h1v14h-1zm2 0h1v14h-1z',
    stroke: false,
  },

  // — Chemistry & reactions ——————————————————————————————————————————————
  {
    name: 'ph-strip',
    label: 'pH strip',
    path: 'M10.2 2.7H14.1A0.8 0.8 0 0 1 14.9 3.5V5.1A0.8 0.8 0 0 1 14.1 5.9H10.2A0.8 0.8 0 0 1 9.4 5.1V3.5A0.8 0.8 0 0 1 10.2 2.7ZM10.2 7.5H14.1A0.8 0.8 0 0 1 14.9 8.3V9.9A0.8 0.8 0 0 1 14.1 10.7H10.2A0.8 0.8 0 0 1 9.4 9.9V8.3A0.8 0.8 0 0 1 10.2 7.5ZM10.2 12.3H14.1A0.8 0.8 0 0 1 14.9 13.1V14.7A0.8 0.8 0 0 1 14.1 15.5H10.2A0.8 0.8 0 0 1 9.4 14.7V13.1A0.8 0.8 0 0 1 10.2 12.3ZM10.2 17.1H14.1A0.8 0.8 0 0 1 14.9 17.9V19.5A0.8 0.8 0 0 1 14.1 20.3H10.2A0.8 0.8 0 0 1 9.4 19.5V17.9A0.8 0.8 0 0 1 10.2 17.1ZM16.5 3.2H17.7A0.5 0.5 0 0 1 18.2 3.7V4.9A0.5 0.5 0 0 1 17.7 5.4H16.5A0.5 0.5 0 0 1 16 4.9V3.7A0.5 0.5 0 0 1 16.5 3.2ZM16.5 7.9H17.7A0.5 0.5 0 0 1 18.2 8.4V9.6A0.5 0.5 0 0 1 17.7 10.1H16.5A0.5 0.5 0 0 1 16 9.6V8.4A0.5 0.5 0 0 1 16.5 7.9Z',
    stroke: false,
  },
  {
    name: 'periodic-tile',
    label: 'Periodic tile',
    path: 'M4 4h16v16H4zm2.5 2.5v5h5v-5zm2.5 8.5h6v3H9z',
    stroke: false,
  },
  {
    name: 'reaction',
    label: 'Reaction arrows',
    path: 'M1.5 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0ZM8.5 11.2L11.7 11.2L11.7 9.6L14 12L11.7 14.4L11.7 12.8L8.5 12.8ZM18.5 8.6 L21.44 10.3 L21.44 13.7 L18.5 15.4 L15.56 13.7 L15.56 10.3Z',
    stroke: false,
  },
  {
    name: 'bond',
    label: 'Chemical bond',
    path: 'M6.5 7.5a2 2 0 1 0 0 .01M17.5 16.5a2 2 0 1 0 0 .01M8 9l8 6',
    stroke: true,
  },
  {
    name: 'titration',
    label: 'Titration',
    path: 'M10.9 2.5V9.6M13.1 2.5V9.6M10.9 2.5H13.1M9.9 9.6H14.1M10.9 9.6L12 10.2L13.1 9.6M13.1 4.3H12.1M13.1 6.5H12.1M12 11.6Q13 12.3 13 13.1A1 1 0 1 1 11 13.1Q11 12.3 12 11.6ZM10.6 16H13.4M10.6 16L7.6 21.4H16.4L13.4 16',
    stroke: true,
  },
  {
    name: 'condenser',
    label: 'Distillation flask',
    path: 'M12 9a6 6 0 1 0 0 12a6 6 0 1 0 0 -12ZM10.4 4.5L13.6 4.5L13.6 11L10.4 11ZM9.6 3L14.4 3L14.4 5L9.6 5Z',
    stroke: false,
  },
  {
    name: 'gas-bubbles',
    label: 'Gas bubbles',
    path: 'M8 20.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7-4.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-2-6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    stroke: false,
  },
  {
    name: 'prism',
    label: 'Prism',
    path: 'M9 5 4 17h10zM2.5 11H7M13.5 11h6.5M13.5 11l6.5-2.5M13.5 11l6.5 2.5',
    stroke: true,
  },
  {
    name: 'atom',
    label: 'Atom',
    path: 'M2.5 12A9.5 4 0 1 0 21.5 12A9.5 4 0 1 0 2.5 12ZM8.75 3.07A9.5 4 70 0 1 15.25 20.93A9.5 4 70 0 1 8.75 3.07ZM9.8 12a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0Z',
    stroke: true,
  },
  {
    name: 'crystal-lattice',
    label: 'Crystal lattice',
    path: 'M12 3l7 4v10l-7 4-7-4V7zM12 6.2l4.2 2.4v4.8L12 15.8l-4.2-2.4V8.6z',
    stroke: true,
  },

  // — Clinical & samples ————————————————————————————————————————————————
  {
    name: 'capsule',
    label: 'Capsule',
    path: 'M4.5 13a6 6 0 0 1 8.5-8.5l6.5 6.5a6 6 0 0 1-8.5 8.5zm2.6-1.1 6 6a3.4 3.4 0 0 0 4.8-4.8l-6-6z',
    stroke: false,
  },
  {
    name: 'stethoscope',
    label: 'Stethoscope',
    path: 'M6 3v5a4 4 0 0 0 8 0V3M6 3h2M12 3h2m-4 9v2.5a4 4 0 0 0 8 0v-1m0-2.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    stroke: true,
  },
  {
    name: 'blood-drop',
    label: 'Blood drop',
    path: 'M12 2.5S6 9.5 6 14a6 6 0 0 0 12 0c0-4.5-6-11.5-6-11.5zm0 5.2c1.6 2.2 4 5.3 4 6.6a4 4 0 0 1-8 0c0-1.3 2.4-4.4 4-6.6z',
    stroke: false,
  },
  {
    name: 'bandage',
    label: 'Bandage',
    path: 'M4 10 10 4a3 3 0 0 1 4 4l-6 6a3 3 0 0 1-4-4zm10 0 6 6a3 3 0 0 1-4 4l-6-6M11 11a1 1 0 1 0 0 .01',
    stroke: true,
  },
  {
    name: 'water-drop',
    label: 'Water drop',
    path: 'M12 2.5S6 9.5 6 14a6 6 0 0 0 12 0c0-4.5-6-11.5-6-11.5zm-2.5 9A2.5 2.5 0 0 0 12 14',
    stroke: true,
  },
  {
    name: 'calendar-sample',
    label: 'Sample schedule',
    path: 'M4 5h16v16H4zm0 4h16M8 3v4m8-4v4M8 13h3v3H8z',
    stroke: true,
  },
  {
    name: 'well-grid',
    label: 'Assay grid',
    path: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
    stroke: false,
  },
  { name: 'filter', label: 'Filter', path: 'M3 5h18l-7 8v6l-4 2v-8z', stroke: false },
  {
    name: 'compass',
    label: 'Compass',
    path: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3.8 5.2-2.2 5.4-5.4 2.2 2.2-5.4z',
    stroke: true,
  },
  {
    name: 'wave',
    label: 'Waveform',
    path: 'M3 12c2.2-6 4.2-6 6 0s4.2 6 6 0 4-6 6 0',
    stroke: true,
  },
  {
    name: 'tube-rack',
    label: 'Tube rack',
    path: 'M3 15h18v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM6 3h2v11H6zm5 0h2v11h-2zm5 0h2v11h-2z',
    stroke: false,
  },

  // Batch A — animals & model organisms (35)
  {
    name: 'mouse',
    label: 'Mouse',
    path: 'M17 4.5a4 4 0 0 0-3.8 5.2C10.8 9.4 8 11 6.8 13.6 5.6 16.2 6 19 8.4 20.2c3 1.5 7-.2 8.5-3.6.9-2 .7-4.1-.3-5.7A4 4 0 0 0 17 4.5zm0 2.3a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4zm-5.4 8.9c1.4 1.4 4 1.7 6 3 1.5 1 2.3 2.6 1.6 3.6',
    stroke: false,
  },
  {
    name: 'rat',
    label: 'Rat',
    path: 'M21 13.4c-.4-1-1.6-1.4-2.9-1.2l-8 .9c.2-1.4-.4-2.7-1.6-3.2C6.8 9.1 4.7 10 4.2 11.9c-.5 1.9.8 3.9 2.9 4.4.9.2 1.8.1 2.5-.3.6 1.3 2 2.1 3.7 2.1h3.4c2.4 0 4.4-1.4 5-3.4a1.4 1.4 0 0 0-.5-1.3zM6.6 12.7a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zm11.5 5.3c1.8 1.4 3 3.4 2.4 4.6',
    stroke: false,
  },
  {
    name: 'rabbit',
    label: 'Rabbit',
    path: 'M8.5 3.2c-1 0-1.7 2-1.5 4.4.1 1.4.5 2.6 1 3.4-1.6.9-2.7 2.6-2.7 4.6C5.3 18.9 7.8 21 11 21h1c3 0 5.3-2 5.3-4.8 0-1.9-1-3.5-2.6-4.4.5-.8.9-2 1-3.4.2-2.4-.5-4.4-1.5-4.4-.9 0-1.6 1.6-1.6 3.6v.5a4.8 4.8 0 0 0-1.2 0V6.8c0-2-.7-3.6-1.6-3.6z',
    stroke: false,
  },
  {
    name: 'zebrafish-adult',
    label: 'Zebrafish (adult)',
    path: 'M3 12c2.8-3.8 8.3-3.8 11 0-2.7 3.8-8.2 3.8-11 0zm11 0 5-2.6v5.2zM6.5 12c1 .9 1 .9 0 0M8.8 9.4l-1.4 5.2M11 8.9l-1.6 6.2M13.2 9.4l-1.4 5.2',
    stroke: true,
  },
  {
    name: 'fruit-fly',
    label: 'Fruit fly',
    path: 'M12 8c1.7 0 3 1.6 3 4.2 0 3-1.3 5.3-3 5.3s-3-2.3-3-5.3c0-2.6 1.3-4.2 3-4.2zm-3.4 1.3C6 8 3 8.6 3 11c0 2.2 2.8 3 5.3 1.8M15.4 9.3C18 8 21 8.6 21 11c0 2.2-2.8 3-5.3 1.8M10.7 7a1.4 1.4 0 1 1 2.6 0',
    stroke: false,
  },
  {
    name: 'c-elegans',
    label: 'C. elegans',
    path: 'M3.5 8.5c2-2.2 3.6 2.8 6 2.8s3.5-4 6-3.3c2.8.8 4 5.5 3 8-1 2.4-3.2-1.2-5.4-.8-2.4.4-3.3 4.2-5.8 3.5',
    stroke: true,
  },
  {
    name: 'frog',
    label: 'Frog',
    path: 'M7.5 9.5a2.8 2.8 0 0 1 2.4-2.8 2.9 2.9 0 0 1 4.2 0A2.8 2.8 0 0 1 16.5 9.5c1.9.9 3.3 2.9 3.3 5.1 0 3-2.5 5-5.8 5s-5.8-2-5.8-5c0-2.2 1.4-4.2 3.3-5.1zM9.5 6.4a1.6 1.6 0 1 0 0 .01M14.5 6.4a1.6 1.6 0 1 0 0 .01M6.2 18.5c-1.5.6-2.6 1.6-2.6 2.6M17.8 18.5c1.5.6 2.6 1.6 2.6 2.6M8 12.5c1.8 1.3 6.2 1.3 8 0',
    stroke: false,
  },
  {
    name: 'xenopus',
    label: 'Xenopus frog',
    path: 'M3.5 12.5c0-2.6 2.3-4.5 5.4-4.5 2.2 0 4.1 1 5 2.5l6.6-3.3c.5-.3 1.1.2.9.8l-1.6 4.2 1.6 4.2c.2.6-.4 1.1-.9.8L13.9 18c-.9 1.5-2.8 2.5-5 2.5-3.1 0-5.4-1.9-5.4-4.5a3 3 0 0 1 .5-1.7 3 3 0 0 1 0-1.6 3 3 0 0 1-.5-1.7zm3 .5a1 1 0 1 1 0-.01',
    stroke: false,
  },
  {
    name: 'chicken',
    label: 'Chicken',
    path: 'M13.5 4c-.5 0-.8.5-1.2 1-.3-.4-.7-.8-1.2-.5-.5.3-.4.9-.3 1.4-.6-.1-1.2 0-1.3.6-.1.6.4 1 .9 1.3-.9.4-1.7 1-2.3 1.8-2 .3-3.6 2-3.6 4.1 0 1.4.7 2.6 1.9 3.3-.3.6-.8 1-1.4 1.3.9.6 2.1.6 3-.1.6.3 1.3.5 2 .5h1.5c2.9 0 5.3-2.2 5.3-5.2 0-2.3-1.4-4.2-3.4-5 .3-.4.5-1 .5-1.5 0-1.4-.9-2.8-2.4-2.8h-.1c0-.5.2-1.1-.3-1.5A.9.9 0 0 0 13.5 4zm.3 4.2a.9.9 0 1 1 0 .01',
    stroke: false,
  },
  {
    name: 'egg',
    label: 'Egg',
    path: 'M12 3c-3.3 0-6 4.5-6 9.5S8.7 21 12 21s6-3.9 6-8.5S15.3 3 12 3zm-1.8 7.5 2 2-1.4 1.6 2.2 1.8',
    stroke: false,
  },
  {
    name: 'pig',
    label: 'Pig',
    path: 'M6 8.5C4.5 8 3.8 9 4.2 10c.3.7 1 1 1.7 1-.6 1-1 2.2-1 3.4C4.9 17.4 7.4 20 11 20c1.6 0 3-.5 4.2-1.3v.1c0 .8.7 1.5 1.5 1.5s1.5-.7 1.5-1.5c0-.5-.2-.9-.6-1.2.7-1 1.1-2.2 1.1-3.6a6.6 6.6 0 0 0-.2-1.6l3.6-.4c.6-.1.6-1 0-1.1l-3.9-.4c-.4-.7-.9-1.3-1.5-1.8.5 0 1-.3 1.2-.8.4-1-.4-2-1.6-1.8-.6.1-1 .5-1.2 1C13.9 8.7 12.5 8.4 11 8.4c-.9 0-1.7.1-2.5.4C8.3 8.3 7.8 8 7.2 8c-.5-.1-.9.2-1.2.5zm10.3 4.6a1 1 0 1 1 0 .01m2.4-.3a1 1 0 1 1 0 .01',
    stroke: false,
  },
  {
    name: 'macaque',
    label: 'Monkey',
    path: 'M11 5.5a3 3 0 0 0-1.4 5.6c-2 .8-3.4 2.7-3.4 4.9 0 2.9 2.4 5 5.5 5 2 0 3.7-.9 4.7-2.3 1.5.3 3-.6 3.6-2.1.7-1.9-.2-4-2-4.9-1-.5-2.1-.5-3-.2A3 3 0 0 0 11 5.5zm-1 3a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm7.4 5.9c1.1.5 1.6 1.8 1.1 3-.3.8-1.1 1.2-1.9 1.1',
    stroke: false,
  },
  {
    name: 'dog',
    label: 'Dog',
    path: 'M9 5.2c-1.3-.5-2.6.3-2.9 1.7-.2.9 0 2.3.3 3.7-.6.7-1 1.7-1 2.9v5c0 .8.6 1.5 1.4 1.5s1.4-.7 1.4-1.5v-4c.9.6 2 1 3.2 1 .8 0 1.6-.2 2.3-.5v3.5c0 .8.6 1.5 1.4 1.5s1.4-.7 1.4-1.5v-6.2c0-.7-.2-1.4-.5-2 .5-.3 1-.7 1.4-1.3.9-1.4.6-3-.4-3.4-.7-.3-1.5.1-2.1.9-.7-.6-1.6-1-2.6-1-.3 0-.6 0-.9.1-.5-.7-1.2-1.2-1.9-1.5zm3.3 5.5a.9.9 0 1 1 0 .01',
    stroke: false,
  },
  {
    name: 'cat',
    label: 'Cat',
    path: 'M6.5 5.5 8.6 10c1-.5 2.1-.8 3.4-.8s2.4.3 3.4.8l2.1-4.5c.3-.6 1.2-.4 1.2.3l-.2 5.6c.8 1 1.3 2.2 1.3 3.5 0 3.2-2.6 5.3-6 5.3-.7 0-1.2-.5-1.2-1.1s.5-1.1 1.2-1.1c2 0 3.5-1.2 3.5-3.1s-1.6-3.4-4-3.4-4 1.5-4 3.4c0 1.2.6 2.1 1.6 2.7-.9.4-2 .3-2.9-.3-1.6-1.1-2.5-3.4-2-5.8L5.5 5.8c-.2-.7.7-.9 1-.3z',
    stroke: false,
  },
  {
    name: 'ferret',
    label: 'Ferret',
    path: 'M4 15.5C4 13 5.6 11 8 11c1 0 1.9.3 2.6.9C11.5 9.5 14 7.7 17 7.7c2.2 0 3.5 1.2 3.5 2.7 0 .6-.3 1.1-.7 1.5.8.7 1.2 1.7 1.2 2.9 0 2.4-1.8 4.2-4.3 4.2H8c-2.4 0-4-1.6-4-3.5zm13.2-5.9a1 1 0 1 0 0 .01M15.8 10.4l-1.2 1',
    stroke: false,
  },
  {
    name: 'guinea-pig',
    label: 'Guinea pig',
    path: 'M4.5 14c0-3.4 3-6 7.5-6s7.5 2.6 7.5 6-3 5.5-7.5 5.5S4.5 17.4 4.5 14zm4-3.3a.9.9 0 1 0 0 .01M6.7 10.5c-.3-1 .1-2 .9-2.4M9.1 9.4c-.2-1 .3-2 1.1-2.2',
    stroke: false,
  },
  {
    name: 'hamster',
    label: 'Hamster',
    path: 'M12 7.5c-4 0-6.8 2.6-6.8 5.9 0 1.7.8 3.1 2 4.1-.3-1.5.7-2.9 2.2-3.2 1.4-.3 2.5.4 3.4 1.4 1.1 1.2 2.6 1.9 4.3 1.1 1.6-.7 2.4-2.4 2.4-4.4C19.5 9.8 16.3 7.5 12 7.5zm-4.2 3.9a.9.9 0 1 1 0 .01M6.4 8.7c.2-.9 1-1.5 1.9-1.4M9.3 7.8c.2-.9 1-1.5 1.9-1.4',
    stroke: false,
  },
  {
    name: 'cow',
    label: 'Cow',
    path: 'M4 14c0-2.2 1.8-3.9 4-3.9h4c2.2 0 4 1.7 4 3.9v3c0 .8-.6 1.5-1.4 1.5s-1.4-.7-1.4-1.5H6.8c0 .8-.6 1.5-1.4 1.5S4 17.8 4 17zm12-3.5c.3-1.4 1-2.3 2-2.7C19.4 7.3 21 7.6 21 8.6c0 1.2-2.2 1.6-3.4 1.9m-1.6.4c-.4-1.6-.4-2.9.2-3.8.8-1.3 2.6-1.6 3.2-.8.7 1-.6 2.8-1.6 3.7M8 11a.9.9 0 1 1 0 .01M11.5 11a.9.9 0 1 1 0 .01',
    stroke: false,
  },
  {
    name: 'sheep',
    label: 'Sheep',
    path: 'M8 9.5a2.2 2.2 0 0 1 2.6-2.4A2.4 2.4 0 0 1 15 7.4a2.2 2.2 0 0 1 3 3 2.2 2.2 0 0 1-1 3.2 2.2 2.2 0 0 1-3 1.4 2.4 2.4 0 0 1-4.4 0 2.2 2.2 0 0 1-3-1.4 2.2 2.2 0 0 1-1-3.2A2.2 2.2 0 0 1 8 9.5zm6.5 4.8.5 4M9.5 14.3l-.5 4M14.4 6.6a1.6 1.6 0 0 1 2.4-.3',
    stroke: false,
  },
  {
    name: 'horse',
    label: 'Horse',
    path: 'M5 21v-5.5c0-2 1-3.7 2.6-4.7-.3-.6-.4-1.3-.3-2l.6-3.3c.1-.6.5-1.1 1-1.4l2.4-1.4c.5-.3 1.1.2.9.8l-.7 1.9 3 1c1.9.7 3.2 2.5 3.2 4.6V21h-2.5v-6.5c-1 .6-2.2 1-3.5 1H9.6c-1.3 0-1.6 1-1.6 2.3V21H5zm6.4-13.8a.7.7 0 1 1 0 .01',
    stroke: false,
  },
  {
    name: 'salmon',
    label: 'Salmon',
    path: 'M3 12c2.7-4 8-4.5 11-1.8.4-.4 1-.7 1.6-.7.7 0 1.2.4 1.4 1 1.5-.7 3.3-.5 4.5.6-2 .3-2.8 1.4-2.8 2.6 0 1 .6 1.8 1.6 2.2-1.4.8-3.1.7-4.4-.3-.3.5-.8.8-1.5.8-.6 0-1.1-.3-1.5-.7C9.7 18.4 5 17.4 3 12zm14 4.8 4 3v-6zM6.5 11.5a1 1 0 1 0 0 .01',
    stroke: false,
  },
  {
    name: 'planaria',
    label: 'Planarian',
    path: 'M4 6.5C4 4.9 7.6 3.6 12 3.6s8 1.3 8 2.9c0 1.1-1.7 2-4.3 2.5.5 3.6 1 8.6-.3 10.6-.7 1-2 1.4-3.4 1.4s-2.7-.4-3.4-1.4c-1.3-2-.8-7-.3-10.6C5.7 8.5 4 7.6 4 6.5zm5.6.4a1 1 0 1 1 0 .01m4.8 0a1 1 0 1 1 0 .01',
    stroke: false,
  },
  {
    name: 'mosquito',
    label: 'Mosquito',
    path: 'M11 9c1.7 0 3 2.2 3 5.4 0 3-1.3 5.6-3 5.6s-3-2.6-3-5.6C8 11.2 9.3 9 11 9zM8.5 9 3 4M8.5 10C5.5 8.5 3 9.4 3 12c0 2 2.4 2.8 5 1.8M13.5 10c3-1.5 5.5-.6 5.5 2 0 2-2.4 2.8-5 1.8M8.5 15l-4 4M8.5 16l-3 5M13.5 15l4 4',
    stroke: true,
  },
  {
    name: 'tick',
    label: 'Tick',
    path: 'M12 8.5c3.6 0 6.5 2.9 6.5 6.3S15.6 21 12 21s-6.5-2.8-6.5-6.2S8.4 8.5 12 8.5zm-1.4-.3L9 5.5M12 8.2V5M13.4 8.2 15 5.5M8 10 5 8.5M8.2 12 5 11.5M16 10l3-1.5M15.8 12l3.2-.5',
    stroke: true,
  },
  {
    name: 'honeybee',
    label: 'Honeybee',
    path: 'M12 8c1.9 0 3.4 1.9 3.4 5s-1.5 6-3.4 6-3.4-2.9-3.4-6S10.1 8 12 8zm-2.9 3.5h5.8M8.9 15h6.2M8.6 11C6 8.8 3 9.4 3 11.8c0 1.8 2.2 2.7 4.8 2M15.4 11c2.6-2.2 5.6-1.6 5.6.8 0 1.8-2.2 2.7-4.8 2',
    stroke: false,
  },
  {
    name: 'tardigrade',
    label: 'Tardigrade',
    path: 'M4.5 11.5c0-2.2 1.9-3.8 4.4-3.8h5c2.6 0 4.6 1.7 4.6 4 0 1.6-1 3-2.5 3.6M4.5 11.5c0 1.6 1 3 2.5 3.6M6.5 15.2 6 18l1.8-2.3M9.2 15.8 9 18.6l1.4-2.5M13 15.8l.2 2.8 1.2-2.5M16.3 15.1l.8 2.7 .5-2.6M8 11.4a.9.9 0 1 1 0 .01',
    stroke: true,
  },
  {
    name: 'axolotl',
    label: 'Axolotl',
    path: 'M4 14c0-2.6 2.3-4.6 5.4-4.6 1.6 0 3 .5 4 1.4.9-.8 2.1-1.2 3.4-1.2 1.4 0 2.7.7 2.7 1.7 0 .7-.6 1.2-1.4 1.4.8.2 1.4.7 1.4 1.4s-.6 1.2-1.4 1.4c.8.2 1.4.7 1.4 1.4 0 1-1.3 1.7-2.7 1.7-1.3 0-2.5-.4-3.4-1.2-1 .9-2.4 1.4-4 1.4C6.3 18.2 4 16.4 4 14zm4 .1a.9.9 0 1 1 0-.01M13.5 10.8l3.2-2.6M14.5 12.2l4-1.4M13.5 17.2l3.2 2.6M14.5 15.8l4 1.4',
    stroke: false,
  },
  {
    name: 'sea-urchin',
    label: 'Sea urchin',
    path: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM12 8V3M12 21v-5M8.5 12h-5M20.5 12h-5M9.5 9.5 6 6M18 18l-3.5-3.5M14.5 9.5 18 6M6 18l3.5-3.5M12 5.5 10.8 3.4M12 5.5l1.2-2.1',
    stroke: true,
  },
  {
    name: 'yeast-bud',
    label: 'Budding yeast',
    path: 'M9.5 5.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zm7 8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    stroke: false,
  },
  {
    name: 'paw-print',
    label: 'Paw print',
    path: 'M12 12.5c2.4 0 4.5 1.8 4.5 3.9 0 1.6-1.3 2.6-2.8 2.6-.6 0-1.1-.2-1.7-.2s-1.1.2-1.7.2c-1.5 0-2.8-1-2.8-2.6 0-2.1 2.1-3.9 4.5-3.9zM6.5 8.5a1.6 1.9 0 1 0 0 .01M17.5 8.5a1.6 1.9 0 1 0 0 .01M9.8 5.6a1.5 1.8 0 1 0 0 .01M14.2 5.6a1.5 1.8 0 1 0 0 .01',
    stroke: false,
  },
  {
    name: 'nematode',
    label: 'Nematode',
    path: 'M4.5 10c2.5-3 5-3 7 0s4.5 3 7 0',
    stroke: true,
  },
  {
    name: 'drosophila-larva',
    label: 'Fly larva',
    path: 'M8 5c3 0 5 2.5 5 5.5 0 2 2 2.5 3.5 2.5S19 12 19 13.5c0 2.8-2.4 5-5.5 5C9.9 18.5 7 15.4 7 11.5c0-1.8-.6-2.8-1.8-3.2C4 7.7 4 6.5 4.7 5.8 5.5 5 6.8 5 8 5zm6 9.5c-.3.8-1 1.3-2 1.3s-1.7-.5-2-1.3M9.5 8.5v1M11.5 10v1M12.8 12v1',
    stroke: false,
  },
  {
    name: 'snail',
    label: 'Snail',
    path: 'M3.5 16.5c0-1 .9-1.7 2-1.7h1.2a6.5 6.5 0 0 1 6.3-8.3c3.6 0 6.5 2.9 6.5 6.5s-2.9 6.5-6.5 6.5H5.5c-1.1 0-2-.7-2-1.5zM13 7.8a5 5 0 0 0-5 5 5 5 0 0 0 5 5 5 5 0 0 0 5-5 5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3 3 3 0 0 1-3 3 3 3 0 0 1-3-3 3 3 0 0 1 3-3zm0 2a1 1 0 0 0 0 2M5 15l-.8-3.5M4.2 11.5l1.6.6M7 15l.4-3.6M7.4 11.4l1.5 1',
    stroke: true,
  },
  {
    name: 'beetle',
    label: 'Beetle',
    path: 'M12 6.5c-1.3 0-2.4.9-2.8 2.1-.4-.3-1-.4-1.5-.2M12 6.5c1.3 0 2.4.9 2.8 2.1.4-.3 1-.4 1.5-.2M12 8c3.1 0 5.3 2.9 5.3 6.5S15.1 20.5 12 20.5 6.7 18.1 6.7 14.5 8.9 8 12 8zm0 2v9.5M6.9 12 4.5 11M17.1 12l2.4-1M6.7 15H4.3M17.3 15h2.4M7 18l-2 1.5M17 18l2 1.5',
    stroke: true,
  },
  {
    name: 'spider',
    label: 'Spider',
    path: 'M12 9.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM9.2 11 4 8.5M9.2 11 4.5 13M9 13l-4.5 3.5M9.4 13.8 6 18M14.8 11 20 8.5M14.8 11l4.7 2M15 13l4.5 3.5M14.6 13.8 18 18',
    stroke: true,
  },

  // Batch B — gene editing & molecular (45)
  {
    name: 'crispr-cas9',
    label: 'CRISPR-Cas9',
    path: 'M10 4a8 8 0 1 0 0 16l-4-8zM18 6h4v3h-4zm0 9h4v3h-4zm2-9v12M18 7.5h2m-2 9h2',
    stroke: false,
  },
  {
    name: 'cas9-protein',
    label: 'Cas9 protein',
    path: 'M7.5 4A6 6 0 0 0 5 15.5 6 6 0 0 0 15 19a5 5 0 0 0 3-9 4.5 4.5 0 0 0-4-4 5 5 0 0 0-6.5-2zm4.5 5.5a3 3 0 0 1 0 6 3 3 0 0 1 0-6z',
    stroke: false,
  },
  {
    name: 'guide-rna',
    label: 'Guide RNA',
    path: 'M5 20V9a4 4 0 0 1 8 0 2.5 2.5 0 0 0 5 0V4',
    stroke: true,
  },
  {
    name: 'dna-scissors',
    label: 'DNA scissors',
    path: 'M3 8h8m-8 8h8m-6-8v8m3-8v8M11 8l7 4m-7 4l7-4M20 8a2 2 0 1 0-3 2m3 6a2 2 0 1 1-3-2',
    stroke: true,
  },
  {
    name: 'double-strand-break',
    label: 'Double-strand break',
    path: 'M3 8h6m6 0h6M3 16h6m6 0h6M4 8v8m4-8v8m8-8v8m4-8v8',
    stroke: true,
  },
  {
    name: 'plasmid',
    label: 'Plasmid',
    path: 'M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM16 2h5v5l-2-1.7z',
    stroke: false,
  },
  {
    name: 'vector-map',
    label: 'Vector map',
    path: 'M12 4a8 8 0 1 0 8 8M12 4a8 8 0 0 1 7 4M20 12a8 8 0 0 1-3 6M19 8l1-3 2 2zM4 15l-2-1 3-1zM17 18l3 0-1 2z',
    stroke: true,
  },
  {
    name: 'gene-cassette',
    label: 'Gene cassette',
    path: 'M3 8h6l2 4-2 4H3zM11 8h4l2 4-2 4h-4l2-4zM17 8h4v8h-4l2-4z',
    stroke: false,
  },
  {
    name: 'promoter',
    label: 'Promoter',
    path: 'M6 20V7h11m0 0l-3-3m3 3l-3 3',
    stroke: true,
  },
  {
    name: 'terminator',
    label: 'Terminator',
    path: 'M3 18h6a4 4 0 0 1 3-6 4 4 0 0 1 3 6h6',
    stroke: true,
  },
  {
    name: 'codon',
    label: 'Codon',
    path: 'M3 8h5v8H3zm6 0h5v8H9zm6 0h5v8h-5z',
    stroke: false,
  },
  {
    name: 'start-codon',
    label: 'Start codon',
    path: 'M3 3v18M3 4h8l-2.5 3.5L11 11H3zM10 14h4v6h-4zm5 0h4v6h-4zm-10 0h4v6H5z',
    stroke: false,
  },
  {
    name: 'stop-codon',
    label: 'Stop codon',
    path: 'M2 8h5v8H2zm5 0h5v8H7zm5 0h5v8h-5zM17 8l3.5 0 2.5 2.5v3.5L20.5 16H17l-2.5-2.5V10.5zM17 12h6',
    stroke: false,
  },
  {
    name: 'knockout',
    label: 'Gene knockout',
    path: 'M3 9h18v6H3zM5 5l14 14M19 5L5 19',
    stroke: true,
  },
  {
    name: 'knock-in',
    label: 'Gene knock-in',
    path: 'M12 3v6m0 0l-3-3m3 3l3-3M3 13h6m6 0h6M3 13v4h6v-4m6 0v4h6v-4',
    stroke: true,
  },
  {
    name: 'base-edit',
    label: 'Base edit',
    path: 'M4 5h16M4 19h16M8 5v14M16 5v14M11 8h2v8h-2z',
    stroke: true,
  },
  {
    name: 'prime-edit',
    label: 'Prime edit',
    path: 'M3 20h5c1-4 8-6 8-6M13 13l5-8 3 2-5 8-3.5.5zM4 18l3 2',
    stroke: true,
  },
  {
    name: 'pam-site',
    label: 'PAM site',
    path: 'M2 8h9M2 16h9M4 8v8m3-8v8M13 6h9v12h-9zM15 12h5m-5-3h5m-5 6h5',
    stroke: true,
  },
  {
    name: 'donor-template',
    label: 'Donor template',
    path: 'M2 5h20M2 9h20M2 5v4m5-4v4m5-4v4m5-4v4m5-4v4M2 15h8m4 0h8M2 19h8m4 0h8M2 15v4m4-4v4m12-4v4m4-4v4',
    stroke: true,
  },
  {
    name: 'homology-arm',
    label: 'Homology arm',
    path: 'M2 12h5M7 5c3 1 3 5 0 7 3 2 3 6 0 7M17 5c-3 1-3 5 0 7-3 2-3 6 0 7M17 12h5',
    stroke: true,
  },
  {
    name: 'transfection',
    label: 'Transfection',
    path: 'M3 7a9 9 0 0 0 0 10M6 5a9 9 0 0 0 0 14M11 8a4 4 0 1 0 0 8 4 4 0 0 1 0-8zM17 12h5m-3-2l-2 2 2 2',
    stroke: true,
  },
  {
    name: 'electroporation',
    label: 'Electroporation',
    path: 'M12 3a9 9 0 1 0 9 9M12 3a9 9 0 0 1 5 1.8M13 7l-4 6h3l-2 5 6-7h-3z',
    stroke: true,
  },
  {
    name: 'viral-vector',
    label: 'Viral vector',
    path: 'M12 3l6 3.5v7L12 17l-6-3.5v-7zM12 17v4m-2-2h4',
    stroke: false,
  },
  {
    name: 'lentivirus',
    label: 'Lentivirus',
    path: 'M12 5a7 7 0 1 0 0 14 7 7 0 1 0 0-14zM12 2v2m0 16v2M22 12h-2M4 12H2m14.2-6.2l1.4-1.4M6.4 17.6l-1.4 1.4M17.6 17.6l1.4 1.4M6.4 6.4L5 5M9 10.5h6L12 16z',
    stroke: false,
  },
  {
    name: 'aav-capsid',
    label: 'AAV capsid',
    path: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 3v18M4 7.5l8 4.5 8-4.5M4 16.5l8-4.5 8 4.5',
    stroke: true,
  },
  {
    name: 'transposon',
    label: 'Transposon',
    path: 'M2 18h5v-3h4v3h4M6 14C6 8 16 8 16 13m0 0l-2-2m2 2l2-2M15 18h5',
    stroke: true,
  },
  {
    name: 'restriction-site',
    label: 'Restriction site',
    path: 'M3 8h18M3 16h18M6 8l0 8M18 8l0 8M11 6l2 2-2 2M13 14l-2 2 2 2',
    stroke: true,
  },
  {
    name: 'ligase',
    label: 'DNA ligase',
    path: 'M2 12h6M16 12h6M8 7v10M16 7v10M9 8h6v8H9zM11 6h2v12h-2z',
    stroke: false,
  },
  {
    name: 'polymerase',
    label: 'Polymerase',
    path: 'M2 16h20M8 16a5 5 0 0 1 10 0 3.5 3.5 0 0 1-7 0zM3 20h9',
    stroke: false,
  },
  {
    name: 'primer',
    label: 'Primer',
    path: 'M2 8h20M4 4h9v3H4zM4 4v3m3-3v3m3-3v3m3-3v3M6 8v2m4-2v2',
    stroke: true,
  },
  {
    name: 'amplicon',
    label: 'Amplicon',
    path: 'M2 12h20M7 5h11v14H7zM7 5v14M18 5v14M9 9h7v6H9z',
    stroke: true,
  },
  {
    name: 'pcr-cycle',
    label: 'PCR cycle',
    path: 'M20 8a9 9 0 1 0 1 6M20 8V4m0 4h-4M8 11h8M8 14h8',
    stroke: true,
  },
  {
    name: 'gel-band',
    label: 'Gel band',
    path: 'M6 3h12v18H6zM8 7h8v1.6H8zm0 5h8v1.6H8zm0 4h8v1.6H8z',
    stroke: false,
  },
  {
    name: 'gel-lane',
    label: 'Gel lanes',
    path: 'M3 4h5v16H3zm6 0h6v16H9zm7 0h5v16h-5zM4 7h3v1.4H4zm0 6h3v1.4H4zm6-4h4v1.4h-4zm0 5h4v1.4h-4zm7-6h3v1.4h-3zm0 7h3v1.4h-3z',
    stroke: false,
  },
  {
    name: 'sequencing-read',
    label: 'Sequencing read',
    path: 'M3 20l3-6 2 3 4-11 3 8 2-4 4 10',
    stroke: true,
  },
  {
    name: 'chromatogram',
    label: 'Chromatogram',
    path: 'M3 18h18M4 18c1 0 1.5-6 3-6s1.5 6 3 6 1.5-8 3-8 1.5 8 3 8 1.5-5 3-5',
    stroke: true,
  },
  {
    name: 'methylation',
    label: 'DNA methylation',
    path: 'M4 8h16M4 18h16M8 8v10M16 8v10M12 8v10M12 8a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z',
    stroke: true,
  },
  {
    name: 'histone',
    label: 'Histone',
    path: 'M6 7a6 2.5 0 0 0 12 0v10a6 2.5 0 0 1-12 0zM3 6c6 4 12-1 18 3',
    stroke: false,
  },
  {
    name: 'nucleosome',
    label: 'Nucleosome',
    path: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 1 0-9zM3 8c5-4 13-4 18 0M3 16c5 4 13 4 18 0M4 12h4m8 0h4',
    stroke: false,
  },
  {
    name: 'telomere',
    label: 'Telomere',
    path: 'M2 11h13M2 15h13M5 11v4m4-4v4M15 9a4 4 0 0 1 4 4 4 4 0 0 1-4 4z',
    stroke: true,
  },
  {
    name: 'centromere',
    label: 'Centromere',
    path: 'M6 3c0 4 4 5 4 9s-4 5-4 9M18 3c0 4-4 5-4 9s4 5 4 9M8.5 12h7',
    stroke: true,
  },
  {
    name: 'exon-intron',
    label: 'Exon/intron',
    path: 'M3 9h5v6H3zm10 0h4v6h-4zm7 0h1v6h-1M8 12h5m4 0h3',
    stroke: false,
  },
  {
    name: 'splice',
    label: 'RNA splice',
    path: 'M2 16h6v-3h4v3h6M8 12c0-6 8-6 8 0M10 9a2 2 0 1 0 4 0',
    stroke: true,
  },
  {
    name: 'snp-marker',
    label: 'SNP marker',
    path: 'M4 6h16M4 18h16M8 6v12M16 6v12M20 6v12M6 6v12M12 7l3 5-3 5-3-5z',
    stroke: true,
  },
  {
    name: 'microinjection',
    label: 'Microinjection',
    path: 'M15 12a6 6 0 1 1-8-5.6M2 3l11 8m-11-8l1 3m-1-3l3 1',
    stroke: true,
  },

  // Batch C — equipment & botany (47)
  {
    name: 'sequencer',
    label: 'DNA sequencer',
    path: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm2.5 3v5h8V8zm0.5 1h7v3h-7zm10 0h1.5v1.5H16zm0 3h1.5v1.5H16zM6 16h6v1.5H6z',
    stroke: false,
  },
  {
    name: 'thermocycler',
    label: 'Thermocycler',
    path: 'M3 12h18v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm2 3v2h4v-2zM4 11l3-6h10l3 6z',
    stroke: false,
  },
  {
    name: 'qpcr-machine',
    label: 'qPCR machine',
    path: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm2.5 3v6h13V8zM6 12c1.5 0 2-3 3.5-3s2 4 3.5 4 2.5-4 4-4',
    stroke: false,
  },
  {
    name: 'microscope-confocal',
    label: 'Confocal microscope',
    path: 'M4 21h13v-2H4zM6 19v-2h8v2zM13 4h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1l-6 8H8L15 6h-2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM7 9h5v2H7z',
    stroke: false,
  },
  {
    name: 'microscope-stereo',
    label: 'Stereo microscope',
    path: 'M4 21h13v-2H4zM6 19v-2h8v2zM10 4h2v3l6 2-1 2-7-2.4V5a1 1 0 0 1 1-1zm-1 3.2 1 .3V5zM12 3.2h2V6h-2zM7 9h5v2H7z',
    stroke: false,
  },
  {
    name: 'incubator-co2',
    label: 'CO2 incubator',
    path: 'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 3v13h10V6zm2 0v13M6 9.5a2 2 0 1 1 4 0 2 2 0 0 1-4 0z',
    stroke: false,
  },
  {
    name: 'freezer',
    label: '−80 freezer',
    path: 'M5 2h14a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zm2 2v6h10V4zm0 8v8h10v-8zM8 6h3v1.6H8zm4 8.5l3 3M15 14.5l-3 3M12 13.5v5M9.9 15.2l4.2 2.6M14.1 15.2l-4.2 2.6',
    stroke: false,
  },
  {
    name: 'cryo-tank',
    label: 'Cryo tank',
    path: 'M6 8a6 3 0 0 1 12 0v10a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3zM6 8a6 3 0 0 0 12 0M9 5c0.5-1.5-0.5-2.5 1-3.5M12 4c0.5-1.2-0.4-2 0.8-3',
    stroke: true,
  },
  {
    name: 'biosafety-cabinet',
    label: 'Biosafety cabinet',
    path: 'M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-2v3h-2v-3H7v3H5v-3H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3 3v5h12V7zm1 1h10v3H7z',
    stroke: false,
  },
  {
    name: 'fume-hood',
    label: 'Fume hood',
    path: 'M3 3h18a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm3 8v6h12v-6zm0-1h12V6L6 4.5zM8 13h2v4H8z',
    stroke: false,
  },
  {
    name: 'autoclave',
    label: 'Autoclave',
    path: 'M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm7 8a4 4 0 1 0 8 0 4 4 0 0 0-8 0zm4-2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM5 7a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm0 4a1 1 0 1 1 2 0 1 1 0 0 1-2 0z',
    stroke: false,
  },
  {
    name: 'shaker',
    label: 'Orbital shaker',
    path: 'M2 15h20v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1zM10 3h4l1 7H9zM8 10h8v3H8zM6.5 5.5a6 6 0 0 1 9-1.5l1-1v3.2h-3.2l1.1-1a4.2 4.2 0 0 0-6.4 1z',
    stroke: false,
  },
  {
    name: 'vortex-mixer',
    label: 'Vortex mixer',
    path: 'M5 11h10v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2zM8 2h3l-.4 8H8.4zM16 4c2 1 2 3 0 4M16.5 8c2.5 1.2 2.5 3.5 0 4.7M16 12.5c2 1 2 3 0 4',
    stroke: false,
  },
  {
    name: 'magnetic-stirrer',
    label: 'Magnetic stirrer',
    path: 'M3 16h18v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM6 17.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM8 4h8l-1 11H9zm2 8.5h4v1.6h-4z',
    stroke: false,
  },
  {
    name: 'hot-plate',
    label: 'Hot plate',
    path: 'M3 14h18v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM6 16a1.2 1.2 0 1 1 2.4 0 1.2 1.2 0 0 1-2.4 0zM10 3c-1.3 1.8 1.3 3.2 0 5M14 3c-1.3 1.8 1.3 3.2 0 5M18 3c-1.3 1.8 1.3 3.2 0 5',
    stroke: false,
  },
  {
    name: 'water-bath',
    label: 'Water bath',
    path: 'M3 5h18v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zm2 2v10h14v-3.5c-1.8 0-1.8-1.5-3.5-1.5S13.7 13.5 12 13.5 10.2 12 8.5 12 6.8 13.5 5 13.5zM14 5h3v8h-3z',
    stroke: false,
  },
  {
    name: 'spectrophotometer',
    label: 'Spectrophotometer',
    path: 'M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm3 5h3v2H6zm5-2h3v6h-3zm5 2h3v2h-3zM6 12h4M14 12h4',
    stroke: false,
  },
  {
    name: 'plate-reader',
    label: 'Plate reader',
    path: 'M3 8h18a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM8 4h11v3H8zm1.5 1a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1zm2 0a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1zm2 0a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1zm2 0a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z',
    stroke: false,
  },
  {
    name: 'flow-cytometer',
    label: 'Flow cytometer',
    path: 'M9 2h6v5l-1.2 2H10.2L9 7zm1.2 9h3.6l1 8a2.5 2.5 0 0 1-2.4 3h-.8a2.5 2.5 0 0 1-2.4-3zM12 11.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm0 3a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm0 3a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zM3 13h4l-1.2-1.2M3 13l2.8 1.2',
    stroke: false,
  },
  {
    name: 'mass-spec',
    label: 'Mass spectrometer',
    path: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm2.5 3v6h13V8zM6 13V10M9 13V8M12 13v-4M15 13V9.5M18 13v-2',
    stroke: false,
  },
  {
    name: 'hplc',
    label: 'HPLC',
    path: 'M4 3h16v5H4zm0 6h16v5H4zm0 6h16v5H4zM6 5h6v1.6H6zm0 6h6v1.6H6zm0 6h6v1.6H6zm10-11.5a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm0 6a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm0 6a1 1 0 1 1 2 0 1 1 0 0 1-2 0z',
    stroke: false,
  },
  {
    name: 'pipette-multichannel',
    label: 'Multichannel pipette',
    path: 'M9 2h6v4l-1 9H10L9 6zM10 15h4v2h-1v4h-2v-4h-1zM8.5 21v-3h1v3zm2 0v-3h1v3zm2 0v-3h1v3zm2 0v-3h1v3z',
    stroke: false,
  },
  {
    name: 'pipette-tip',
    label: 'Pipette tip',
    path: 'M8 3h8l-1 4-3 15-3-15zM9.2 7h5.6',
    stroke: false,
  },
  {
    name: 'tip-box',
    label: 'Tip box',
    path: 'M3 4h18a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM6 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM6 16a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    stroke: false,
  },
  {
    name: 'well-plate-96',
    label: '96-well plate',
    path: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm2.5 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM5.5 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM5.5 15.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    stroke: false,
  },
  {
    name: 'well-plate-384',
    label: '384-well plate',
    path: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm2 3.2a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zM5 11.3a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zM5 14.4a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4zm2.8 0a.7.7 0 1 0 0 1.4.7.7 0 0 0 0-1.4z',
    stroke: false,
  },
  {
    name: 'deep-well',
    label: 'Deep-well plate',
    path: 'M2 4h20v3H2zM4 7h2.6v9.5a1.3 1.3 0 0 1-2.6 0zm4.7 0h2.6v9.5a1.3 1.3 0 0 1-2.6 0zm4.7 0H16v9.5a1.3 1.3 0 0 1-2.6 0zm4.7 0h2.6v9.5a1.3 1.3 0 0 1-2.6 0z',
    stroke: false,
  },
  {
    name: 'cuvette',
    label: 'Cuvette',
    path: 'M7 3h10v3H7zm1 3h8v14a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1zm2 3h4v8h-4zM2 12h6M16 12h6',
    stroke: true,
  },
  {
    name: 'microtube',
    label: 'Microcentrifuge tube',
    path: 'M7 3h10v2H7zm0 3h10v2l-3 3v6a3 3 0 0 1-6 0v-6L7 8zM6 3h3v2H6z',
    stroke: false,
  },
  {
    name: 'cryovial',
    label: 'Cryovial',
    path: 'M8 2h8v3H8zm1 3h6v13a3 3 0 0 1-6 0zM10 8h4M10 11h4M10 14h4M12 2.5l.9 1.8L15 4l-1.5 1.4.4 2-1.9-1-1.9 1 .4-2L9 4l2.1.3z',
    stroke: false,
  },
  {
    name: 'falcon-tube',
    label: 'Conical tube',
    path: 'M8 2h8v3H8zm0 3h8v11l-4 5-4-5zM9.5 8h5M9.5 11h5M9.5 14h5',
    stroke: false,
  },
  {
    name: 'inoculation-loop',
    label: 'Inoculation loop',
    path: 'M20 21l-9-9M20 21l-3 .3.3-3zM11 12a3.6 3.6 0 1 1-.02-.02z',
    stroke: true,
  },
  {
    name: 'spreader',
    label: 'Cell spreader',
    path: 'M8 3v13M8 16h9',
    stroke: true,
  },
  {
    name: 'forceps',
    label: 'Forceps',
    path: 'M10 21l-1-9L7 3M14 21l1-9 2-9M9 12h6',
    stroke: true,
  },
  {
    name: 'seed',
    label: 'Seed',
    path: 'M12 3c5 3 6 8 3 13a5 5 0 0 1-6 0C6 11 7 6 12 3zm0 4c-1.5 1-2 2.5-1.5 4',
    stroke: false,
  },
  {
    name: 'seedling',
    label: 'Seedling',
    path: 'M3 20h18v-1.6H3zM11.2 18V11h1.6v7zM12 11C11 8 8 6.5 4.5 7.5 4.2 11 7.5 12.5 12 11zM12 11c1-3 4-4.5 7.5-3.5.3 3.5-3 5-7.5 3.5z',
    stroke: false,
  },
  {
    name: 'sapling',
    label: 'Sapling',
    path: 'M11.2 21v-8h1.6v8zM12 4a5 5 0 0 1 3 9 5 5 0 0 1-6 0 5 5 0 0 1 3-9z',
    stroke: false,
  },
  {
    name: 'tree',
    label: 'Tree',
    path: 'M11 21h2v-6h-2zM12 3a6 6 0 0 1 5.5 8.3A4.5 4.5 0 0 1 15 20H9a4.5 4.5 0 0 1-2.5-8.7A6 6 0 0 1 12 3z',
    stroke: false,
  },
  {
    name: 'root-system',
    label: 'Root system',
    path: 'M9 3.5a3 3 0 0 1 6 0 3 3 0 0 1-2 2.8V8h-2V6.3a3 3 0 0 1-2-2.8zM11 8h2v3l3 2 2-1.3-.6 2.4 2.4.7-2.4.7L18 20l-2-1.7-1.5 2.4L14 18l-1 2.6L12 18l-1 2.6L10 18l-.5 2.7L8 18.3 6 20l.6-2.4L4.2 17l2.4-.7L4.2 14l2.4.7L6 12.3 9 11z',
    stroke: false,
  },
  {
    name: 'pollen',
    label: 'Pollen grain',
    path: 'M12 4l1.6 2.2 2.6-.6-.6 2.6L18 12l-2.4 1.8.6 2.6-2.6-.6L12 18l-1.6-2.2-2.6.6.6-2.6L6 12l2.4-1.8-.6-2.6 2.6.6zM9 10a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zm5.5 3a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2zm-2-6a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    stroke: false,
  },
  {
    name: 'spore',
    label: 'Spore',
    path: 'M10 21c-1.5-4-1-8 1.5-11.5M12 3a3.5 4.5 0 0 1 0 9 3.5 4.5 0 0 1 0-9zM8.7 5.5h6.6',
    stroke: true,
  },
  {
    name: 'flower',
    label: 'Flower',
    path: 'M12 2a3.2 3.2 0 0 1 2.9 4.6A3.2 3.2 0 1 1 15 12a3.2 3.2 0 1 1-6 0 3.2 3.2 0 1 1 .1-5.4A3.2 3.2 0 0 1 12 2zm0 6.8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
    stroke: false,
  },
  {
    name: 'pine',
    label: 'Conifer',
    path: 'M11 21h2v-3h-2zM12 3l4 6h-2.5l3 4.5H14l3 4.5H7l3-4.5H7.5l3-4.5H8z',
    stroke: false,
  },
  {
    name: 'cactus',
    label: 'Cactus',
    path: 'M10 21h4v-6h-4zM10 15V8a2 2 0 0 1 4 0v7zM10 12H8a1.5 1.5 0 0 1-1.5-1.5V9a1 1 0 0 1 2 0v1h1.5zm4 0h2a1.5 1.5 0 0 0 1.5-1.5V8a1 1 0 0 0-2 0v1.5H14z',
    stroke: false,
  },
  {
    name: 'mushroom',
    label: 'Mushroom',
    path: 'M4 11a8 5.5 0 0 1 16 0 1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM9.5 12h5v6a2.5 2.5 0 0 1-5 0z',
    stroke: false,
  },
  {
    name: 'wheat',
    label: 'Wheat',
    path: 'M11.2 21V10h1.6v11zM12 3c1.4 1.2 1.4 3 0 4.2-1.4-1.2-1.4-3 0-4.2zM9 6.5c1.8.4 2.8 2 2.5 3.9C9.7 10 8.7 8.4 9 6.5zm6 0c-1.8.4-2.8 2-2.5 3.9 1.8-.4 2.8-2 2.5-3.9zM8.5 10c1.8.4 2.8 2 2.5 3.9-1.8-.4-2.8-2-2.5-3.9zm7 0c-1.8.4-2.8 2-2.5 3.9 1.8-.4 2.8-2 2.5-3.9z',
    stroke: false,
  },
  {
    name: 'algae',
    label: 'Algae',
    path: 'M9 21c-2.5-3.5-2.5-7.5-.5-11 1.5-2.6 1.8-4.5 1-7M8.5 18.5a1.6 1.6 0 1 0 0-.02zM8 13.5a1.6 1.6 0 1 0 0-.02zM9.2 8.8a1.6 1.6 0 1 0 0-.02zM10.3 4.2a1.5 1.5 0 1 0 0-.02zM14.5 15c1.8-2.2 1.8-5 .5-7.5M15 12a1.5 1.5 0 1 0 0-.02z',
    stroke: true,
  },
]

// Back-compat derived exports so BucketIcon and assignGlyphs keep working
// against a flat index space. Deriving them from GLYPHS keeps the path data and
// the stroke flag from ever drifting apart.
export const SEED_GLYPHS: readonly string[] = GLYPHS.map((g) => g.path)

export const STROKE_GLYPHS: ReadonlySet<number> = new Set(
  GLYPHS.reduce<number[]>((acc, g, i) => (g.stroke ? [...acc, i] : acc), []),
)

// name → index, for resolving a stored `quilt-glyph:<name>` pick back to its
// path/stroke. Built once from the single source of truth.
const GLYPH_INDEX_BY_NAME: ReadonlyMap<string, number> = new Map(
  GLYPHS.map((g, i) => [g.name, i]),
)

export function glyphIndexByName(name: string): number | undefined {
  return GLYPH_INDEX_BY_NAME.get(name)
}

// Category boundaries over the existing GLYPHS order. Each startIndex is the
// array position where a category's run begins; a glyph belongs to the last
// boundary whose startIndex is ≤ its index. These are derived from the glyph
// content (not the old comment dividers, which were stale — the last "Clinical"
// divider had swallowed ~140 glyphs spanning model organisms, gene editing,
// molecular biology, equipment and plants). Editing a startIndex recategorizes;
// it never reorders GLYPHS.
export const GLYPH_CATEGORIES: readonly GlyphCategory[] = [
  { name: 'Glassware & vessels', startIndex: 0 },
  { name: 'Instruments & tools', startIndex: 10 },
  { name: 'Genetics & molecules', startIndex: 22 },
  { name: 'Cells & microbiology', startIndex: 34 },
  { name: 'Charts & measurement', startIndex: 44 },
  { name: 'Chemistry & reactions', startIndex: 54 },
  { name: 'Clinical & samples', startIndex: 64 },
  { name: 'Model organisms', startIndex: 75 },
  { name: 'Gene editing', startIndex: 110 },
  { name: 'Molecular biology', startIndex: 136 },
  { name: 'Lab equipment', startIndex: 154 },
  { name: 'Plants & fungi', startIndex: 189 },
]

// A glyph paired with its flat GLYPHS index — the picker needs the index to
// build the stored `quilt-glyph:` value and to key selection, and the label/name
// to render and filter. Bundled so callers iterate one structure.
export interface IndexedGlyph extends Glyph {
  index: number
}

export interface GlyphGroup {
  category: string
  glyphs: ReadonlyArray<IndexedGlyph>
}

// The grouped view the picker renders at rest: every GLYPHS entry, in order,
// bucketed under its category with its flat index carried along. Built once.
// Because it walks GLYPHS in order and only opens a new group at a boundary, the
// grouping can never drop or reorder a glyph — the flattened groups are exactly
// GLYPHS.
export const GLYPH_GROUPS: readonly GlyphGroup[] = (() => {
  const groups: { category: string; glyphs: IndexedGlyph[] }[] = []
  let boundary = -1
  GLYPHS.forEach((g, index) => {
    const next = boundary + 1
    if (next < GLYPH_CATEGORIES.length && index >= GLYPH_CATEGORIES[next].startIndex) {
      boundary = next
      groups.push({ category: GLYPH_CATEGORIES[next].name, glyphs: [] })
    }
    // guard: a glyph before the first boundary (shouldn't happen, startIndex 0)
    if (groups.length === 0) {
      groups.push({ category: GLYPH_CATEGORIES[0].name, glyphs: [] })
    }
    groups[groups.length - 1].glyphs.push({ ...g, index })
  })
  return groups
})()

// djb2 — the same stable string hash BucketIcon uses. Kept here too so the grid
// can compute each bucket's *preferred* glyph slot without importing internals.
function hashSeed(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i)
  return Math.abs(h)
}

// The single-bucket analogue of assignGlyphs: the stable glyph *name* a bucket
// hashes to on its own, ignoring any page context. This is the deterministic
// per-bucket default — it looks random across a set of names but is reproducible
// for a given name, so a bucket wears the same glyph in every view and across
// sessions. Used to materialize a default into `iconUrl` (see
// defaultGlyphSrcForBucket in BucketIcon) rather than recomputing per-view.
export function glyphNameForSeed(seed: string): string {
  return GLYPHS[hashSeed(seed) % GLYPHS.length].name
}

// Assign every bucket in a grid a glyph slot such that no two visible buckets
// share a glyph (up to the library size). Each bucket prefers the slot its name
// hashes to — so a bucket keeps a stable icon as long as the set around it does
// not force a collision — and on a clash we probe forward (mod N) to the next
// free slot. Iteration is over the caller's order, which is deterministic, so
// the whole assignment is deterministic for a given list.
//
// When there are more buckets than glyphs, uniqueness can no longer hold: past
// the library size we stop probing and fall back to the plain hash slot, so the
// first SEED_GLYPHS.length buckets are guaranteed distinct and any overflow
// degrades gracefully to hashed repeats rather than throwing.
export function assignGlyphs(names: ReadonlyArray<string>): Map<string, number> {
  const n = SEED_GLYPHS.length
  const used = new Set<number>()
  const out = new Map<string, number>()
  names.forEach((name) => {
    if (out.has(name)) return
    const pref = hashSeed(name) % n
    if (used.size >= n) {
      // library exhausted — no free slot exists; use the hashed slot as-is
      out.set(name, pref)
      return
    }
    let slot = pref
    while (used.has(slot)) slot = (slot + 1) % n
    used.add(slot)
    out.set(name, slot)
  })
  return out
}
