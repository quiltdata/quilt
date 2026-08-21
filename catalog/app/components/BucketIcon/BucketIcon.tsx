import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

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
  contrast: {
    '& $disc': {
      color: 'transparent',
    },
    '& $ring, & $glyph': {
      color: fade(t.palette.grey.A100, 0.5),
    },
  },
  // The per-bucket initials avatar. Ground and ink come from DESIGN.md's
  // closed Identity Tint set (categorical, never semantic, never an accent),
  // so a wall of buckets is scannable by colour as well as by name. Size is
  // driven from the disc so the initials scale with it.
  initials: {
    alignItems: 'center',
    display: 'flex',
    fontFamily: t.typography.fontFamily,
    fontWeight: 500,
    justifyContent: 'center',
    lineHeight: 1,
  },
}))

// First 1-2 significant characters of a title, uppercased: one word yields
// its first two letters, multiple words yield the first letter of the first
// two — the standard "initials avatar" derivation. Punctuation is stripped
// per word so a title like "Fiskus (us-east-1)" yields "FU", not "F(".
export function getInitials(label: string): string {
  const words = label
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^0-9A-Za-z]/g, ''))
    .filter(Boolean)
  if (!words.length) return ''
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

// DESIGN.md > Colors > Identity Tints. A closed set: it excludes the Amber
// Indicator's hue (an identity must never read as a selection) and the
// semantic Info/Warning pairs.
const IDENTITY_TINTS = [
  { bg: '#e8eaf6', fg: '#283593' }, // indigo
  { bg: '#e0f2f1', fg: '#00695c' }, // teal
  { bg: '#e8f5e9', fg: '#2e7d32' }, // green
  { bg: '#f3e5f5', fg: '#6a1b9a' }, // purple
  { bg: '#fce4ec', fg: '#ad1457' }, // pink
  { bg: '#efebe9', fg: '#4e342e' }, // brown
]

// Hash the object's stable identifier (never its position in a list), so a
// bucket wears the same tint in every view, filtered or paged or not.
// FNV-1a rather than the usual `hash * 31 + c`: with a 6-entry table the
// classic multiplier degenerates (31 ≡ 1 mod 6, so the hash collapses toward
// a character sum) and shared prefixes like `quilt-bio-*` all land on one
// tint. FNV's xor+prime mixing avalanches, so a real bucket list spreads.
export function getIdentityTint(key: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return IDENTITY_TINTS[Math.abs(hash) % IDENTITY_TINTS.length]
}

// A custom `src` only renders as an <img> when the browser can actually load
// it: http(s), data/blob, or a relative/protocol-relative path. An unsupported
// scheme — e.g. the `quilt-glyph:` demo-data left over from reverted work —
// can't load, so treat it as "no icon" and fall through to the initials avatar
// rather than emitting a broken image and a console error.
function isRenderableIconSrc(src: string): boolean {
  const scheme = src.trim().match(/^([a-z][a-z0-9+.-]*):/i)
  return !scheme || /^(https?|data|blob)$/i.test(scheme[1])
}

interface BucketIconProps {
  // only applies to custom icons, the stub ignores it
  alt?: string
  className?: string
  classes?: {
    custom?: string
    stub?: string
  }
  src: string | null
  title?: string
  // The bucket's display title. When there's no custom `src`, this drives
  // the initials-avatar fallback instead of the generic glyph stub; omit it
  // (as every other call site does) to keep the original glyph behavior.
  label?: string
  // Optional override of the default 32px (t.spacing(4)) dimensions, e.g. the
  // 44px "more presence" treatment on the Home card grid. Inline so it always
  // wins over the `root` class regardless of JSS rule order; omit to keep
  // every other call site's sizing byte-identical.
  size?: number
  // The object's stable identifier, hashed to pick the Identity Tint. Falls
  // back to `label` when omitted; pass the bucket name so a rename of the
  // display title doesn't re-colour the avatar.
  tintKey?: string
}

export default function BucketIcon({
  alt = '',
  className: optClassName,
  classes: optClasses,
  src,
  title,
  label,
  size,
  tintKey,
}: BucketIconProps) {
  const classes = useStyles()
  // in dark themes the stub switches to contrast colors
  const dark = M.useTheme().palette.type === 'dark'
  const style = size ? { height: size, width: size } : undefined

  if (src && isRenderableIconSrc(src)) {
    return (
      <img
        alt={alt}
        className={cx(classes.root, classes.crop, optClasses?.custom, optClassName)}
        src={src}
        style={style}
        title={title}
      />
    )
  }

  const initials = label && getInitials(label)
  if (initials) {
    const tint = getIdentityTint(tintKey || label)
    return (
      <div
        className={cx(classes.root, classes.initials, optClasses?.stub, optClassName)}
        style={{
          ...style,
          backgroundColor: tint.bg,
          color: tint.fg,
          // Scale the initials with the disc rather than pinning a literal:
          // ~36% of the diameter is the conventional avatar ratio.
          fontSize: Math.round((size ?? 32) * 0.36),
        }}
        title={title}
      >
        {initials}
      </div>
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
      style={style}
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
