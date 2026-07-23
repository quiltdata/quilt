// Seeded life-sciences glyph library for BucketIcon.
//
// Each glyph is authored in a 24x24 box and rendered on the 149-unit disc via
// transform="translate(35.5 35.5) scale(3.25)". Filled glyphs paint with
// currentColor; stroked (line-art) glyphs set fill:none and stroke:currentColor.
//
// ORDER IS A CONTRACT: never reorder or remove entries — the page-level glyph
// assignment hashes bucket names into these indices, so a reorder silently
// reassigns every existing bucket's icon. Append new glyphs at the end only.

export const SEED_GLYPHS: readonly string[] = [
  'M9 2v6.5L4.3 18a2 2 0 0 0 1.8 2.9h11.8a2 2 0 0 0 1.8-2.9L15 8.5V2zm2 2h2v5l.4.9H10.6l.4-.9zm-3.1 12 2-4h4.2l2 4z', // 0 flask
  'M8 2v15a4 4 0 0 0 8 0V2zm2 2h4v9h-4zm0 11h4v2a2 2 0 0 1-4 0z', // 1 test tube
  'M6 4h12v2h-1v3.5l3.2 8A2 2 0 0 1 17.3 21H6.7a2 2 0 0 1-1.9-3.5L8 9.5V6H7zm4 2v4l-1 2.5h6L14 10V6z', // 2 beaker
  'M11 2h2v6.1a6.5 6.5 0 1 1-2 0zm1 7.9a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z', // 3 round flask
  'M9 2h6v2h-1v15a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4H9zm3 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm0 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', // 4 vial
  'M8 2h8v2h-1v15a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V4H8zm3 2v3h2V4zm0 5v3h2V9zm0 5v4h2v-4z', // 5 graduated cylinder
  'M10 2h4v3l1 1v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V6l1-1zm-1 8h6v8h-6z', // 6 bottle
  'M4 4h16l-6 8v6l-4 2v-8z', // 7 funnel
  'M15.8 4.2a2 2 0 0 1 0 2.8l-1 1 1.2 1.2-1.4 1.4-1.2-1.2-1 1a2 2 0 0 1-2.8-2.8l3.4-3.4a2 2 0 0 1 2.8 0zM10 11l2 2-2.2 2.2A5 5 0 0 1 12 20h4v2H5v-2h1.4A5 5 0 0 1 8 12.8zm-2 9h6a3 3 0 0 0-6 0z', // 8 microscope
  'M18 3.5a2.1 2.1 0 0 1 2.5 2.5l-1.8 1.8-2.5-2.5zM15 6.5 5 16.5 4 20l3.5-1 10-10z', // 9 pipette
  'M10.5 4a6.5 6.5 0 1 0 3.9 11.7l4 4 1.6-1.6-4-4A6.5 6.5 0 0 0 10.5 4zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm-1 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm2.5 1.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', // 10 magnifier
  'M12 3a3 3 0 0 1 3 3v7.1a5 5 0 1 1-6 0V6a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v8.3a3 3 0 1 0 2 0V6a1 1 0 0 0-1-1z', // 11 thermometer
  'M12 3v16M6 19h12M5 7h14M5 7l-2.5 5a3 3 0 0 0 5 0zM19 7l-2.5 5a3 3 0 0 0 5 0z', // 12 scale/balance
  'M15 3l6 6M18 6l-9 9-3.5 1L4 20l1-1.5L6 15l9-9M8 12l2 2M11 9l2 2', // 13 syringe
  'M12 2s5 6 5 9a5 5 0 0 1-10 0c0-3 5-9 5-9zm0 5c-1.2 1.6-3 4-3 5a3 3 0 0 0 6 0c0-1-1.8-3.4-3-5z', // 14 dropper
  'M12 3a9 9 0 1 0 9 9M12 3v9l7 4M12 3a9 9 0 0 0-9 9', // 15 centrifuge
  'M3 20 14 9l3-3a3 3 0 0 1 4 4l-3 3zM5 18l9-9', // 16 scalpel
  'M7 3c0 4 10 5 10 9s-10 5-10 9M17 3c0 4-10 5-10 9s10 5 10 9M8 6h8M8 18h8M9.5 9h5M9.5 15h5', // 17 dna helix
  'M7.6 3.3a2 2 0 0 1 2.8.4L12 6.1l1.6-2.4a2 2 0 1 1 3.2 2.2L14.4 12l2.4 4.1a2 2 0 1 1-3.2 2.2L12 15.9l-1.6 2.4a2 2 0 1 1-3.2-2.2L9.6 12 7.2 7.9a2 2 0 0 1 .4-4.6z', // 18 chromosome
  'M12 4a1.6 1.6 0 1 0 0 3.2A1.6 1.6 0 0 0 12 4zm-5.5 8a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zm11 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2zM12 7.2v3.2m-1.3 1.9-3 1.5m9.6 0-3-1.5', // 19 molecule
  'M12 3l7 4v10l-7 4-7-4V7zM12 6l4 2.3v4.6L12 15l-4-2.1V8.3z', // 20 benzene ring
  'M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 12c0-2 3.6-3.5 8-3.5s8 1.5 8 3.5-3.6 3.5-8 3.5-8-1.5-8-3.5zM8.5 5.5c1.7-1 6 2 8 5.5s2.3 7.5.5 8.5-6-2-8-5.5-2.3-7.5-.5-8.5zM15.5 5.5c-1.7-1-6 2-8 5.5s-2.3 7.5-.5 8.5 6-2 8-5.5 2.3-7.5.5-8.5z', // 21 atom
  'M9 3c0 4 6 5 6 9s-6 5-6 9M9 6h5M10 9h4M10 15h4M9 18h5', // 22 rna strand
  'M6 6a3 3 0 0 1 0 6h6a3 3 0 0 1 0 6M6 6a2 2 0 1 0 0 .01M18 18a2 2 0 1 0 0 .01M6 12h6', // 23 protein fold
  'M4 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm4 2h2l2 2 2-2h2m2-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 13v3', // 24 amino chain
  'M4 11h7v2H4zm9 0h7v2h-7zM11 8l3 4-3 4-1.4-1 2.2-3-2.2-3zM13 8l-3 4 3 4 1.4-1-2.2-3 2.2-3z', // 25 gene edit
  'M7 4v16M17 4v16M7 7h10M7 12h10M7 17h10', // 26 base pairs
  'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM9 10a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 0 0-2.6 0zm4.4 1a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 0 0-2.6 0zm-2.7 3.4a1.1 1.1 0 1 0 2.2 0 1.1 1.1 0 0 0-2.2 0z', // 27 cell
  'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm-2 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm3 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm-1 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', // 28 petri dish
  'M8 12a4 4 0 1 0-8 0 4 4 0 0 0 8 0zm16 0a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM8 12h8', // 29 cell division
  'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-3 1.5L4 8m5 5-4 3m7-7 4-3m-4 8 4 3m-2-8 4 0', // 30 neuron
  'M4 12a8 5 0 1 0 16 0 8 5 0 0 0-16 0zm2.5 0c1.5-2.5 2.5 2.5 4 0s2.5 2.5 4 0 2.5 2.5 3 1', // 31 mitochondria
  'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 3v3m0 12v3M3 12h3m12 0h3M6 6l2 2m8 8 2 2m0-12-2 2M8 16l-2 2', // 32 virus
  'M6 16a3 3 0 0 1 0-4l6-6a3 3 0 0 1 4 4l-6 6a3 3 0 0 1-4 0zm2-5 4 4M6 6l-2-2m14 14 2 2m0-16-2 2M6 18l-2 2', // 33 bacteria
  'M12 21v-8m0 0-4-6m4 6 4-6M8 7V4m8 3V4', // 34 antibody
  'M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z', // 35 bar chart
  'M4 20V4M4 20h16M7 15l3-4 3 2 4-6', // 36 line chart
  'M4 4v16h16M8 15a1 1 0 1 0 0 .01M12 10a1 1 0 1 0 0 .01M16 13a1 1 0 1 0 0 .01M14 7a1 1 0 1 0 0 .01', // 37 scatter plot
  'M12 3a9 9 0 1 0 9 9h-9zM11 3.05A9 9 0 0 0 3 12h8z', // 38 pie chart
  'M4 15a8 8 0 1 1 16 0M12 15l4-4M12 15a1 1 0 1 0 0 .01', // 39 gauge
  'M3 8h18v8H3zm3 0v3m3-3v4m3-4v3m3-3v4m3-4v3', // 40 ruler
  'M4 20V13h3v7zm4 0V8h3v12zm4 0v-9h3v9zm4 0V6h3v14z', // 41 histogram
  'M3 18c4 0 4-11 9-11s5 11 9 11M3 18h18', // 42 normal curve
  'M6 8a2 2 0 1 0 0 .01M18 16a2 2 0 1 0 0 .01M7.5 9.5l9 5', // 43 bond
  'M9 2h6v14a3 3 0 0 1-6 0zM9 6h6M9 9h6M9 12h6', // 44 ph strip
  'M4 4h16v16H4zm2 2v5h5V6zm3 9h6v3H9z', // 45 periodic tile
  'M3 9h14m0 0-3-3m3 3-3 3M21 15H7m0 0 3-3m-3 3 3 3', // 46 reaction
  'M12 2 7 8l5 14 5-14zM9.5 8h5L12 18z', // 47 crystal
  'M8 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-2-6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', // 48 gas bubbles
  'M11 2h2v6l3 9a2 2 0 0 1-2 3h-2a2 2 0 0 1-2-3l3-9zM11 20h2', // 49 titration
  'M9 3v5l-4 9a2 2 0 0 0 2 3h2M9 3h6v5l1 2M15 3v5M6 20h5m4-9 4 2-1 2 2 1-1 2 2 1', // 50 condenser
  'M6 4h4v8a2 2 0 0 0 4 0V4h4v8a6 6 0 0 1-12 0zm0 10h4v2H6zm8 0h4v2h-4z', // 51 magnet
  'M12 5v14M5 12h14M12 12a7 7 0 1 0 .01 0', // 52 atom orbit
  'M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0', // 53 wave
  'M13 2 4 14h6l-1 8 9-12h-6z', // 54 lightning
  'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm-1-6h2l.5 2.5 2-.8 1.6 1.2-1 2.3 1.7 1.7 2.3-1 1.2 1.6-.8 2 2.5.5v2l-2.5.5.8 2-1.2 1.6-2.3-1-1.7 1.7 1 2.3-1.6 1.2-2-.8L13 22h-2l-.5-2.5-2 .8-1.6-1.2 1-2.3L6.2 13l-2.3 1-1.2-1.6.8-2L1 10V8l2.5-.5-.8-2L3.9 3.9l2.3 1L7.9 3.2l-1-2.3', // 55 gear
  'M12 3 3 19h18zM12 10l-3 5m3-5 3 5M18 6l3-1M18 8l3 0', // 56 prism
  'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm3.5 5.5-2 5-5 2 2-5z', // 57 compass
  'M4 8h14v8H4zm14 2h2v4h-2zM7 10v4m3-4v4', // 58 battery cell
  'M12 21v-7m0 0c0-3 2-6 6-7-1 4-3 6-6 7zm0-1c0-3-2-5-5-6 1 3 2 5 5 6z', // 59 sprout
  'M5 19C4 12 8 4 20 4c0 12-8 16-15 15zm3-3c3-5 6-7 9-8', // 60 leaf
  'M12 2a6 6 0 0 1 5 9 5 5 0 0 1-3 8v3h-4v-3a5 5 0 0 1-3-8 6 6 0 0 1 5-9zm-1 17h2', // 61 tree
  'M12 3S6 10 6 14a6 6 0 0 0 12 0c0-4-6-11-6-11zm0 4.5c1.6 2.2 4 5.2 4 6.5a4 4 0 0 1-8 0c0-1.3 2.4-4.3 4-6.5z', // 62 water drop
  'M12 3c2 2 2 5 0 7-2-2-2-5 0-7zM6 12h12l-1.5 8h-9zM9 12v8m6-8v8', // 63 seedling pot
  'M3 12c3-4 9-4 12 0-3 4-9 4-12 0zm12 0 6-3v6zM7 11a1 1 0 1 0 0 .01', // 64 fish
  'M4 8h6a3 3 0 0 1 0 6H4M20 16h-6a3 3 0 0 1 0-6h1M4 8v6m16-6v8M7 11h2', // 65 enzyme
  'M9 3a3 3 0 0 1 5 1 3 3 0 0 1 4 3 3 3 0 0 1 1 5 3 3 0 0 1-3 4 3 3 0 0 1-5 1 3 3 0 0 1-4-3 3 3 0 0 1-1-5 3 3 0 0 1 3-4zm1 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', // 66 microbe blob
  'M3 12h4l2-5 3 10 2-7 2 4h4', // 67 ecg
  'M4.5 13a6 6 0 0 1 8.5-8.5l6.5 6.5a6 6 0 0 1-8.5 8.5zm2.6-1.1 6 6a3.4 3.4 0 0 0 4.8-4.8l-6-6z', // 68 capsule
  'M6 3v5a4 4 0 0 0 8 0V3M6 3h2M12 3h2m-4 9v3a4 4 0 0 0 8 0v-1m0-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', // 69 stethoscope
  'M12 2s6 7 6 12a6 6 0 0 1-12 0c0-2 1.5-5 3-7.5M12 12a2 2 0 1 0 0 4', // 70 blood drop
  'M4 10 10 4a3 3 0 0 1 4 4l-6 6a3 3 0 0 1-4-4zm10 0 6 6a3 3 0 0 1-4 4l-6-6M11 11a1 1 0 1 0 0 .01', // 71 bandage
  'M3 5h18v14H3zm3 3a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM6 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm5 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z', // 72 microplate
  'M8 3h8v3H8zM6 5h2v3h8V5h2v16H6zm3 7h6v2H9zm0 4h4v2H9z', // 73 clipboard data
  'M4 5h16v16H4zm0 4h16M8 3v4m8-4v4M8 13h3v3H8z', // 74 calendar sample
  'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z', // 75 test grid
  'M4 5h16l-6 7v6l-4 2v-8z', // 76 filter
  'M4 4h16v16H4zm3 3v10m10-10v10M9 9a3 3 0 1 0 6 0 3 3 0 0 0-6 0z', // 77 incubator
  'M4 5h1v14H4zm2 0h1v14H6zm2 0h2v14H8zm3 0h1v14h-1zm2 0h2v14h-2zm3 0h1v14h-1zm2 0h1v14h-1z', // 78 barcode sample
]

// Indices in SEED_GLYPHS that are line-art and must render stroked, not filled.
export const STROKE_GLYPHS: ReadonlySet<number> = new Set([
  12, 13, 15, 17, 19, 20, 21, 22, 23, 24, 26, 27, 29, 30, 31, 32, 33, 34, 36, 37, 39, 42,
  43, 46, 48, 50, 52, 53, 56, 59, 64, 65, 67, 69,
])

// djb2 — the same stable string hash BucketIcon uses. Kept here too so the grid
// can compute each bucket's *preferred* glyph slot without importing internals.
function hashSeed(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i)
  return Math.abs(h)
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
