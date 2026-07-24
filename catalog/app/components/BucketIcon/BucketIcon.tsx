import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import {
  SEED_GLYPHS,
  STROKE_GLYPHS,
  glyphIndexByName,
  glyphNameForSeed,
} from './seedGlyphs'

// A bucket icon can be a predefined glyph from the library, stored as this
// scheme in the same `iconUrl` string a custom URL would occupy. The admin
// picker writes `quilt-glyph:<name>`; here we intercept it and render that named
// glyph on the seeded disc (no <img>, no network) instead of treating it as a
// URL. This keeps predefined picks free of any backend/data-URI plumbing — the
// stored value is short, human-readable, and resolves by name via seedGlyphs.
//
// The scheme optionally carries a chosen disc color as a query param:
//   quilt-glyph:<name>            — tint hashes from the seed (default)
//   quilt-glyph:<name>?c=RRGGBB   — tint is the given 6-hex color (no '#')
// The `?c=` form lets an admin pick a color without a backend schema change: it
// all rides inside the one `iconUrl` string. Parsing is tolerant — anything we
// don't recognize is ignored and we fall back to the hashed tint.
export const GLYPH_SCHEME = 'quilt-glyph:'

export function isGlyphSrc(src: string | null | undefined): src is string {
  return typeof src === 'string' && src.startsWith(GLYPH_SCHEME)
}

const HEX6_RE = /^[0-9a-fA-F]{6}$/

// Split a glyph src into its name and (optional) explicit color. `color` is a
// normalized `#RRGGBB` string when a valid `?c=` param is present, else
// undefined. Tolerant of junk: a malformed color param is dropped, not thrown.
export function parseGlyphSrc(src: string): { name: string; color?: string } {
  const body = src.slice(GLYPH_SCHEME.length)
  const q = body.indexOf('?')
  if (q === -1) return { name: body }
  const name = body.slice(0, q)
  const params = new URLSearchParams(body.slice(q + 1))
  const c = params.get('c')
  return c && HEX6_RE.test(c) ? { name, color: `#${c}` } : { name }
}

// The inverse of parseGlyphSrc — the picker uses this to write a pick back into
// the form's iconUrl. A `#`-prefixed (or bare) 6-hex color is encoded as `?c=`;
// anything else omits the param so the tint stays hashed.
export function buildGlyphSrc(name: string, color?: string): string {
  const hex = color?.replace(/^#/, '')
  return hex && HEX6_RE.test(hex)
    ? `${GLYPH_SCHEME}${name}?c=${hex.toLowerCase()}`
    : `${GLYPH_SCHEME}${name}`
}

// Back-compat: callers that only want the name. Now a thin wrapper over the
// tolerant parser so a color param never leaks into the returned name.
export function glyphNameFromSrc(src: string): string {
  return parseGlyphSrc(src).name
}

// The deterministic per-bucket default, as a storable glyph src. This is the one
// place the "stuck to the bucket" default is minted: creation writes it into
// iconUrl, and the admin edit form pre-fills it for legacy (null-iconUrl)
// buckets so a save materializes it. Because it's a pure function of the name,
// the same bucket resolves to the same glyph in every view without any stored
// state — but persisting it makes the icon a real bucket attribute, not a
// per-view render artifact.
export function defaultGlyphSrcForBucket(name: string): string {
  return `${GLYPH_SCHEME}${glyphNameForSeed(name)}`
}

// A stub with no seed is the legacy neutral glyph; a seed derives a stable,
// whimsical life-sciences identity (a lab-doodad glyph on a palette-tinted disc)
// so a wall of default buckets reads as distinct at a glance instead of an
// undifferentiated grid of the same disc. This lives in the WEBSITE register
// (the landing bucket grid opts in via `seed`); the authenticated instrument
// app never passes a seed, so the neutral glyph — and the Lab Instrument's
// no-decoration doctrine — is untouched there.

// Small stable string hash (djb2). Deterministic per name so the same bucket
// always wears the same doodad + tint across sessions and views.
function seedToHash(seed: string): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i)
  return Math.abs(h)
}

// Palette-coherent tints, NOT a 360° rainbow: soft washes drawn from the brand
// families (indigo / cobalt / coral / amber / info-blue / teal-green). Kept
// muted so a full grid differentiates without flooding the screen with color —
// the disc is a quiet ground, the glyph is the identity.
// Exported so the admin picker can offer the same on-palette families as
// curated swatches — keeping a chosen color coherent with the hashed defaults
// rather than introducing a second, unrelated palette.
export const SEED_TINTS: ReadonlyArray<string> = [
  '#5471f1', // cobalt trace
  '#f38681', // coral signal
  '#fb8c00', // amber indicator
  '#039be5', // info blue
  '#6a93ff', // cobalt sky
  '#26a69a', // teal (life-sciences green, register-local)
]

// The glyph library (a couple hundred distinct life-sciences doodads) lives in
// ./seedGlyphs so this component stays readable; SEED_GLYPHS / STROKE_GLYPHS are
// imported above.

interface SeedArt {
  tint: string
  // the disc ground and edge, derived from the tint so the chip stays one
  // coherent color: a legible wash fill and a firmer rim (see seededDisc/ring)
  wash: string
  ring: string
  // whether the glyph path is a filled shape or an open stroke (line-art glyphs
  // must be stroked, not filled — see STROKE_GLYPHS in ./seedGlyphs)
  stroke: boolean
  path: string
}

// Resolve a bucket's disc artwork. The glyph is chosen, in priority order, by:
//   1. an explicit `glyphName` (a predefined `quilt-glyph:<name>` pick), else
//   2. an explicit `glyphIndex` (the landing grid assigns these so no two
//      visible buckets share a glyph — see BucketGrid/BucketList), else
//   3. a name-hash (a lone seeded icon outside a grid).
// The tint hashes from the name by default so color stays stable per bucket and
// varies independently of the glyph — UNLESS an explicit `color` is given (an
// admin's `?c=` pick), which overrides the hashed tint. Either way the wash and
// ring derive from the one tint via fade(), so a chosen color still yields a
// coherent disc + rim + glyph rather than three unrelated colors.
function seedToArt(
  seed: string,
  glyphIndex?: number,
  glyphName?: string,
  color?: string,
): SeedArt {
  const h = seedToHash(seed)
  const namedIdx = glyphName === undefined ? undefined : glyphIndexByName(glyphName)
  const glyphIdx =
    namedIdx !== undefined
      ? namedIdx
      : glyphIndex === undefined
        ? h % SEED_GLYPHS.length
        : ((glyphIndex % SEED_GLYPHS.length) + SEED_GLYPHS.length) % SEED_GLYPHS.length
  // a decorrelated draw for the tint so glyph and color vary independently
  // (shift out the low bits the name-hash glyph index would consume)
  const tintIdx = Math.floor(h / SEED_GLYPHS.length) % SEED_TINTS.length
  const tint = color ?? SEED_TINTS[tintIdx]
  return {
    tint,
    // A visible-but-calm ground and a firmer rim, both derived from the one tint
    // so the chip stays coherent. 0.16 is the wash the disc reads as a real
    // (quiet) chip at; 0.34 gives the edge just enough definition to not dissolve
    // into a white card. These are the light-theme values; the dark-theme
    // contrast block overrides both.
    wash: fade(tint, 0.16),
    ring: fade(tint, 0.34),
    stroke: STROKE_GLYPHS.has(glyphIdx),
    path: SEED_GLYPHS[glyphIdx],
  }
}

const useStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: '50%',
    height: t.spacing(4),
    width: t.spacing(4),
  },
  // the stub artwork is an inscribed circle, so only custom icons need cropping
  crop: {
    objectFit: 'cover',
  },
  disc: {
    color: t.palette.common.white,
  },
  ring: {
    color: t.palette.grey.A100,
  },
  glyph: {
    color: t.palette.grey[700],
  },
  // Seeded stubs paint the disc with a soft, palette-derived tint (injected
  // inline via a CSS var) and drop a life-sciences doodad over it; the ring
  // stays as the shared chassis so the family still reads as one set.
  seededDisc: {
    // The tint is a wash, not a fill — but it has to be a wash you can actually
    // SEE. At 0.16 the disc read as empty white and the glyph floated with no
    // ground, so a grid of them looked like unfinished scaffolding rather than a
    // set of designed chips. `fade(tint, 0.14)` composited on white is too pale;
    // this lifts the ground to a legible-but-calm tint so the disc reads as an
    // intentional chip, the glyph has something to sit on, and the grid still
    // stays quiet (the color signal is present, not loud). Alpha lives in the
    // color via fade() at the call site, so no separate opacity to fight the
    // ring/glyph layered above.
    color: 'var(--bucket-tint-wash, rgba(84, 113, 241, 0.16))',
  },
  // The doodad itself, at full tint strength — this is the identity the eye
  // catches, now with a real tinted ground behind it. Filled glyphs paint via
  // `fill`, line-art glyphs via `stroke`.
  seededGlyph: {
    color: 'var(--bucket-tint, #5471f1)',
    fill: 'currentColor',
  },
  seededGlyphStroke: {
    color: 'var(--bucket-tint, #5471f1)',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    // stroke width is in the 24-box glyph units, set as an SVG attr on the path
  },
  // A hairline of the tint at the disc edge so the chip has a defined rim on a
  // white card instead of dissolving into the surface — the edge is what makes
  // it read as a deliberate token rather than a faint smudge.
  seededRing: {
    color: 'var(--bucket-tint-ring, rgba(84, 113, 241, 0.32))',
  },
  contrast: {
    '& $disc': {
      color: 'transparent',
    },
    '& $ring, & $glyph': {
      color: fade(t.palette.grey.A100, 0.5),
    },
    '& $seededDisc': {
      color: fade(t.palette.grey.A100, 0.24),
    },
    '& $seededRing': {
      color: fade(t.palette.common.white, 0.32),
    },
    '& $seededGlyph, & $seededGlyphStroke': {
      color: fade(t.palette.common.white, 0.85),
    },
  },
}))

// The seeded-disc SVG: a soft palette-tinted disc, a hairline rim, and the
// doodad centered on top. Shared by the two paths that produce a seeded chip —
// a hashed default (the `seed` branch) and a predefined pick (the glyph-scheme
// branch) — so the disc chassis and the 24-box→149-disc placement live in one
// place. The doodad is authored in a 24-box; scale it to ~78 units and center it
// on the 149-box disc: offset (149-78)/2 = 35.5, scale 78/24 = 3.25.
function renderSeededDisc({
  art,
  classes,
  dark,
  optClasses,
  optClassName,
  title,
}: {
  art: SeedArt
  classes: ReturnType<typeof useStyles>
  dark: boolean
  optClasses?: { custom?: string; stub?: string }
  optClassName?: string
  title?: string
}) {
  return (
    <M.SvgIcon
      className={cx(
        classes.root,
        dark && classes.contrast,
        optClasses?.stub,
        optClassName,
      )}
      style={
        {
          ['--bucket-tint' as any]: art.tint,
          '--bucket-tint-wash': art.wash,
          '--bucket-tint-ring': art.ring,
        } as React.CSSProperties
      }
      titleAccess={title}
      viewBox="0 0 149 149"
    >
      <circle
        className={classes.seededDisc}
        cx="74.5"
        cy="74.5"
        r="71"
        fill="currentColor"
      />
      <path
        className={classes.seededRing}
        fill="currentColor"
        d="M74.5 149C33.4 149 0 115.6 0 74.5S33.4 0 74.5 0 149 33.4 149 74.5 115.6 149 74.5 149zm0-142C37.3 7 7 37.3 7 74.5S37.3 142 74.5 142 142 111.7 142 74.5 111.8 7 74.5 7z"
      />
      <path
        className={art.stroke ? classes.seededGlyphStroke : classes.seededGlyph}
        transform="translate(35.5 35.5) scale(3.25)"
        strokeWidth={art.stroke ? 1.6 : undefined}
        d={art.path}
      />
    </M.SvgIcon>
  )
}

interface BucketIconProps {
  // only applies to custom icons, the stub ignores it
  alt?: string
  className?: string
  classes?: {
    custom?: string
    stub?: string
  }
  // optional differentiator (typically the bucket name): when set, the stub
  // paints a stable per-bucket life-sciences doodad on a palette-tinted disc
  // instead of the neutral glyph. Website register only — the app never sets it.
  seed?: string
  // optional explicit glyph slot into SEED_GLYPHS. The landing grid computes a
  // collision-free assignment across its bucket set and passes it here so no two
  // visible buckets show the same glyph; without it the glyph hashes from `seed`.
  glyphIndex?: number
  src: string | null
  title?: string
}

export default function BucketIcon({
  alt = '',
  className: optClassName,
  classes: optClasses,
  seed,
  glyphIndex,
  src,
  title,
}: BucketIconProps) {
  const classes = useStyles()
  // in dark themes the stub switches to contrast colors
  const dark = M.useTheme().palette.type === 'dark'

  // A predefined glyph pick, stored in `src` as `quilt-glyph:<name>` (optionally
  // `?c=RRGGBB`). Resolve it to the named library glyph on the seeded disc —
  // never an <img>. An explicit `?c=` color wins; otherwise the tint hashes from
  // `seed` (the bucket name) when present so color stays stable per bucket, and
  // without a seed we tint from the glyph name so a lone icon (admin list,
  // permissions table) is still coherently colored.
  if (isGlyphSrc(src)) {
    const { name: glyphName, color } = parseGlyphSrc(src)
    const art = seedToArt(seed || glyphName, glyphIndex, glyphName, color)
    return renderSeededDisc({ art, classes, dark, optClasses, optClassName, title })
  }

  if (src) {
    return (
      <img
        alt={alt}
        className={cx(classes.root, classes.crop, optClasses?.custom, optClassName)}
        src={src}
        title={title}
      />
    )
  }

  // Seeded stub: same disc+ring chassis as the neutral glyph, but the disc
  // carries a soft palette tint and the folder glyph is replaced by a whimsical
  // life-sciences doodad, so a page of default buckets differentiates at a
  // glance. The glyph comes from an explicit collision-free slot when the grid
  // supplies one (no on-page repeats), else it hashes from the name; the tint
  // always hashes from the name.
  if (seed) {
    const art = seedToArt(seed, glyphIndex)
    return renderSeededDisc({ art, classes, dark, optClasses, optClassName, title })
  }

  return (
    <M.SvgIcon
      className={cx(
        classes.root,
        dark && classes.contrast,
        optClasses?.stub,
        optClassName,
      )}
      titleAccess={title}
      viewBox="0 0 149 149"
    >
      <circle className={classes.disc} cx="74.5" cy="74.5" r="71" fill="currentColor" />
      <path
        className={classes.ring}
        fill="currentColor"
        d="M74.5 149C33.4 149 0 115.6 0 74.5S33.4 0 74.5 0 149 33.4 149 74.5 115.6 149 74.5 149zm0-142C37.3 7 7 37.3 7 74.5S37.3 142 74.5 142 142 111.7 142 74.5 111.8 7 74.5 7z"
      />
      <path
        className={classes.glyph}
        fill="currentColor"
        d="m112 85-5.3-3.8 4.4-35.9c.1-1.1-.2-2.3-1-3.1-.8-.9-1.8-1.3-3-1.3H42.8c-1.1 0-2.2.5-3 1.3-.8.9-1.1 2-1 3.1l7.7 63.4c.2 2 1.9 3.5 4 3.5h48.8c2 0 3.7-1.5 4-3.5l2.2-18.4 1.8 1.3c.7.5 1.5.7 2.3.7 1.2 0 2.5-.6 3.3-1.7 1.3-1.9.9-4.4-.9-5.6zm-16.2 19.2H54.1l-6.7-55.4h55.3l-3.3 27.1-17.3-12.2v-.1c0-4.1-3.3-7.4-7.4-7.4s-7.4 3.3-7.4 7.4 3.3 7.4 7.4 7.4c1.1 0 2-.2 3-.6L98.1 85l-2.3 19.2z"
      />
    </M.SvgIcon>
  )
}
