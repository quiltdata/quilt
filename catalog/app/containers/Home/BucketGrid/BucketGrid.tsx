import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import BucketIcon, { resolveTint } from 'components/BucketIcon'
import { assignGlyphs } from 'components/BucketIcon/seedGlyphs'
import cfg from 'constants/config'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'

import Collaborators from './Collaborators'
import useTagStyles from './tagStyles'

const useBucketStyles = M.makeStyles((t) => ({
  // Border-first (per the Elevation doctrine): the card rests on a hairline, not
  // a shadow. `--bucket-tint` is set inline per card so the identity band and the
  // hover edge track the bucket's own glyph color without re-deriving it here.
  bucket: {
    border: `1px solid ${t.palette.divider}`,
    boxShadow: 'none',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: t.spacing(26),
    overflow: 'hidden', // clip the tint band to the rounded corners
    // Hover is a state on a link target, not decoration: the edge takes the
    // bucket tint and the card lifts a hair. One transition, reduced-motion-
    // gated; the resting card has no motion declared at all.
    transition: t.transitions.create(['border-color', 'box-shadow'], {
      duration: t.transitions.duration.shortest,
    }),
    '&:hover': {
      borderColor: 'var(--bucket-tint, currentColor)',
      boxShadow: t.shadows[2],
    },
    '@media (prefers-reduced-motion: no-preference)': {
      animation: '$slideUp 0.3s ease',
    },
  },
  // The identity band: the glyph is the hero here, on a quiet wash of the
  // bucket's own tint (border-first bottom rule, not a shadow; no gradient — the
  // anti-reference bans it). A wall of volumes now differentiates by colour+glyph
  // at a glance, which is the whole point of the seeded-glyph system.
  identity: {
    alignItems: 'center',
    background: 'var(--bucket-tint-wash, transparent)',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    gap: t.spacing(1.5),
    padding: t.spacing(1.5, 2),
  },
  // The glyph, promoted from a 32px corner avatar to a 44px identity mark.
  glyph: {
    flexShrink: 0,
    height: t.spacing(5.5),
    width: t.spacing(5.5),
  },
  // Title + s3:// URI, stacked beside the glyph. min-width:0 lets the nowrap
  // lines ellipsize instead of pushing the card wider (the old "weird cutting").
  identityText: {
    minWidth: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    padding: t.spacing(1.5, 2, 0),
  },
  // The title is the scan anchor: full-strength at rest, tint on hover — one
  // element reading one way. Single line; `title` attr is the full-name escape.
  title: {
    ...t.typography.subtitle1,
    color: t.palette.text.primary,
    display: 'block',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '&:hover': {
      color: 'var(--bucket-tint, currentColor)',
    },
  },
  // The s3:// address is machine-exact identity → Roboto Mono (the Mono Identity
  // Rule), subordinate to the title.
  name: {
    ...t.typography.caption,
    color: t.palette.text.hint,
    display: 'block',
    fontFamily: t.typography.monospace.fontFamily,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  desc: {
    ...t.typography.body2,
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    color: t.palette.text.secondary,
    display: '-webkit-box',
    lineHeight: t.typography.pxToRem(20),
    margin: t.spacing(1, 0, 0),
    maxHeight: t.typography.pxToRem(20 * 2),
    overflow: 'hidden',
    overflowWrap: 'break-word',
    textOverflow: 'ellipsis',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
    marginTop: t.spacing(1.5),
  },
  // Reserved for the deferred trust row (Indexed <time> · N objects · size).
  // The GraphQL query doesn't carry those fields yet; the row is the seam.
  meta: {
    ...t.typography.caption,
    color: t.palette.text.hint,
    marginTop: t.spacing(1),
  },
  // Access readout, promoted from a quiet afterthought to a first-class footer
  // on a consistent baseline: who can reach this volume, at a glance.
  footer: {
    alignItems: 'center',
    borderTop: `1px solid ${t.palette.divider}`,
    color: t.palette.text.secondary,
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: t.spacing(1.5),
    minHeight: t.spacing(5),
    padding: t.spacing(0, 2),
  },
  '@keyframes slideUp': {
    '0%': {
      opacity: 0.7,
      transform: 'translateY(10px)',
    },
    '100%': {
      opacity: 1,
      transform: 'translateY(0px)',
    },
  },
}))

export interface Bucket {
  name: string
  title: string
  iconUrl: string | null
  description: string | null
  tags: ReadonlyArray<string> | null
  collaborators?: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection> | null
}

interface BucketCardProps {
  bucket: Bucket
  glyphIndex?: number
  onTagClick?: (tag: string) => void
  tagIsMatching: (tag: string) => boolean
  showCollaborators: boolean
}

function BucketCard({
  bucket,
  glyphIndex,
  onTagClick,
  tagIsMatching,
  showCollaborators,
}: BucketCardProps) {
  const classes = useBucketStyles()
  const tagClasses = useTagStyles()
  const { urls } = NamedRoutes.use()

  // The bucket's own glyph tint drives the identity band and hover edge. Resolve
  // it the same way BucketIcon does (explicit ?c= wins, else name-hash) so the
  // card and its icon never disagree; undefined for a custom-image icon.
  const tint = resolveTint(bucket.iconUrl, bucket.name)
  const tintVars = tint
    ? ({
        ['--bucket-tint' as any]: tint,
        '--bucket-tint-wash': fade(tint, 0.1),
      } as React.CSSProperties)
    : undefined

  return (
    <M.Card
      className={classes.bucket}
      style={tintVars}
      data-testid="bucket-grid--bucket"
      data-bucket={bucket.name}
    >
      <div className={classes.identity}>
        <Link aria-hidden="true" tabIndex={-1} to={urls.bucketRoot(bucket.name)}>
          <BucketIcon
            className={classes.glyph}
            seed={bucket.name}
            glyphIndex={glyphIndex}
            src={bucket.iconUrl}
          />
        </Link>
        <div className={classes.identityText}>
          <Link
            className={classes.title}
            to={urls.bucketRoot(bucket.name)}
            title={bucket.title}
          >
            {bucket.title}
          </Link>
          <Link
            className={classes.name}
            to={urls.bucketRoot(bucket.name)}
            title={`s3://${bucket.name}`}
          >
            s3://{bucket.name}
          </Link>
        </div>
      </div>
      <div className={classes.body}>
        {!!bucket.description && <p className={classes.desc}>{bucket.description}</p>}
        {!!bucket.tags && !!bucket.tags.length && (
          <div className={classes.tags}>
            {bucket.tags.map((tag) => (
              <M.Chip
                key={tag}
                className={cx(tagClasses.tag, tagIsMatching(tag) && tagClasses.tagActive)}
                label={tag}
                size="small"
                clickable={!!onTagClick}
                onClick={onTagClick ? () => onTagClick(tag) : undefined}
              />
            ))}
          </div>
        )}
        <M.Box flexGrow={1} />
      </div>
      {cfg.mode === 'PRODUCT' && showCollaborators && (
        <div className={classes.footer}>
          <Collaborators
            bucket={bucket.name}
            collaborators={bucket.collaborators ?? null}
          />
        </div>
      )}
    </M.Card>
  )
}

const useStyles = M.makeStyles((t) => ({
  add: {
    alignItems: 'center',
    // Tertiary token, not a hardcoded off-palette indigo (#2f306e was a stale
    // relative of the retired #282b50) — the tile now tracks the ratified accent.
    border: `2px dashed ${fade(t.palette.tertiary.main, 0.5)}`,
    borderRadius: t.spacing(2),
    color: t.palette.tertiary.main,
    cursor: 'pointer',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    // Match the card floor so the Add tile's row lines up with the rest.
    minHeight: t.spacing(26),
    '&:hover': {
      background: fade(t.palette.tertiary.main, 0.04),
    },
    // The single decorative '+' glyph, sized to fill the tile. This is icon
    // dimensioning, not body/display text, so it sizes off the spacing scale
    // (spacing(8) = 64px) rather than a bare off-ramp font-size literal.
    '& > span': {
      fontSize: t.spacing(8),
    },
  },
}))

interface BucketGridProps {
  buckets: ReadonlyArray<Bucket>
  onTagClick?: (tag: string) => void
  tagIsMatching?: (tag: string) => boolean
  showAddLink?: boolean
  showCollaborators?: boolean
}

export default React.forwardRef<HTMLDivElement, BucketGridProps>(function BucketGrid(
  {
    buckets,
    onTagClick,
    tagIsMatching = () => false,
    showAddLink = false,
    showCollaborators = true,
  },
  ref,
) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()

  // Buckets with a stored `iconUrl` (a persisted `quilt-glyph:` pick or a custom
  // URL) render that verbatim — the icon is stuck to the bucket and looks the
  // same in every view. Only *legacy* buckets with no stored icon fall back to a
  // view-time glyph; for those we still run the collision-free assignment so a
  // page of unconfigured buckets doesn't repeat a glyph. Buckets with a stored
  // icon are excluded from that pass (BucketIcon ignores glyphIndex when src is a
  // glyph src anyway) so their glyphs never perturb the fallback assignment.
  const glyphs = React.useMemo(
    () => assignGlyphs(buckets.filter((b) => !b.iconUrl).map((b) => b.name)),
    [buckets],
  )

  return (
    <M.Grid container spacing={2} ref={ref}>
      {buckets.map((b) => (
        <M.Grid item xs={12} sm={6} md={4} lg={3} key={b.name}>
          <BucketCard
            bucket={b}
            glyphIndex={glyphs.get(b.name)}
            onTagClick={onTagClick}
            tagIsMatching={tagIsMatching}
            showCollaborators={showCollaborators}
          />
        </M.Grid>
      ))}
      {showAddLink && (
        <M.Grid item xs={12} sm={6} md={4} lg={3}>
          <Link className={classes.add} to={urls.adminBuckets({ add: true })}>
            <M.Icon>add</M.Icon>
          </Link>
        </M.Grid>
      )}
    </M.Grid>
  )
})
