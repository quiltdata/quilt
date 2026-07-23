import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import { SEED_GLYPHS, STROKE_GLYPHS } from './seedGlyphs'

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
const SEED_TINTS: ReadonlyArray<string> = [
  '#5471f1', // cobalt trace
  '#f38681', // coral signal
  '#fb8c00', // amber indicator
  '#039be5', // info blue
  '#6a93ff', // cobalt sky
  '#26a69a', // teal (life-sciences green, register-local)
]

// The glyph library (79 distinct life-sciences doodads) lives in ./seedGlyphs so
// this component stays readable; SEED_GLYPHS / STROKE_GLYPHS are imported above.

interface SeedArt {
  tint: string
  // whether the glyph path is a filled shape or an open stroke (line-art glyphs
  // must be stroked, not filled — see STROKE_GLYPHS in ./seedGlyphs)
  stroke: boolean
  path: string
}

// Resolve a bucket's disc artwork. The glyph is chosen by an explicit
// `glyphIndex` when the caller supplies one (the landing grid assigns these so
// no two visible buckets share a glyph — see BucketGrid/BucketList), and falls
// back to a name-hash when it doesn't (e.g. a lone seeded icon outside a grid).
// The tint always hashes from the name so color stays stable per bucket and
// varies independently of the glyph.
function seedToArt(seed: string, glyphIndex?: number): SeedArt {
  const h = seedToHash(seed)
  const glyphIdx =
    glyphIndex === undefined
      ? h % SEED_GLYPHS.length
      : ((glyphIndex % SEED_GLYPHS.length) + SEED_GLYPHS.length) % SEED_GLYPHS.length
  // a decorrelated draw for the tint so glyph and color vary independently
  // (shift out the low bits the name-hash glyph index would consume)
  const tintIdx = Math.floor(h / SEED_GLYPHS.length) % SEED_TINTS.length
  return {
    tint: SEED_TINTS[tintIdx],
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
    // The tint is a wash, not a fill: low alpha keeps the grid calm (the glyph,
    // not the disc, carries the color signal) and honors "not too much color".
    color: 'var(--bucket-tint, #5471f1)',
    opacity: 0.16,
  },
  // The doodad itself, at full tint strength — this is the identity the eye
  // catches. Filled glyphs paint via `fill`, line-art glyphs via `stroke`.
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
  contrast: {
    '& $disc': {
      color: 'transparent',
    },
    '& $ring, & $glyph': {
      color: fade(t.palette.grey.A100, 0.5),
    },
    '& $seededDisc': {
      color: fade(t.palette.grey.A100, 0.24),
      opacity: 1,
    },
    '& $seededGlyph, & $seededGlyphStroke': {
      color: fade(t.palette.common.white, 0.85),
    },
  },
}))

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
    // The doodad is authored in a 24-box; scale it to ~78 units and center it on
    // the 149-box disc: offset (149-78)/2 = 35.5, scale 78/24 = 3.25.
    return (
      <M.SvgIcon
        className={cx(
          classes.root,
          dark && classes.contrast,
          optClasses?.stub,
          optClassName,
        )}
        style={{ ['--bucket-tint' as any]: art.tint }}
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
          className={classes.ring}
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
