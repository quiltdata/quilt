import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import BucketIcon from 'components/BucketIcon'
import { assignGlyphs } from 'components/BucketIcon/seedGlyphs'
import cfg from 'constants/config'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'

import Collaborators from './Collaborators'
import useTagStyles from './tagStyles'

const useBucketStyles = M.makeStyles((t) => ({
  bucket: {
    display: 'flex',
    flexDirection: 'column',
    // Fill the grid cell so cards in the same row are equal height.
    height: '100%',
    // Floor every card to a uniform height so grid rows stay uniform instead of
    // ragged; the flexGrow spacer below absorbs the slack when content is shorter.
    minHeight: t.spacing(26),
    // The entrance animation is decoration on a task surface: gated behind
    // `no-preference` so reduced-motion users (PRODUCT.md accessibility floor)
    // get the card with no motion at all, not a suppressed-but-declared animation.
    '@media (prefers-reduced-motion: no-preference)': {
      animation: '$slideUp 0.3s ease',
    },
  },
  // Collaborators read as an exact footer readout, not a floating corner badge:
  // the MUI Badge's translate(50%,-50%) overhang collided with the card's
  // top-right corner and clipped. A labelled footer line ("Shared with N")
  // seats the count on a consistent baseline across every card and never
  // overflows the rounded corner.
  footer: {
    alignItems: 'center',
    borderTop: `1px solid ${t.palette.divider}`,
    color: t.palette.text.secondary,
    display: 'flex',
    justifyContent: 'space-between',
    minHeight: t.spacing(5),
    padding: t.spacing(0, 2),
  },
  // The title is the scan anchor, not a rival link: full-strength text at rest,
  // accent only on hover — matching the list row so the same element reads the
  // same way across both views (it was tertiary-at-rest here, text.primary in
  // the list, one element in two resting colors).
  title: {
    ...t.typography.h6,
    color: t.palette.text.primary,
    '&:hover': {
      color: t.palette.tertiary.main,
    },
  },
  // The s3:// address is machine-exact identity, not prose: render it in the
  // mono face (the Mono Identity Rule), subordinate to the title above it.
  name: {
    ...t.typography.body2,
    color: t.palette.text.hint,
    display: 'block',
    fontFamily: t.typography.monospace.fontFamily,
    lineHeight: t.typography.pxToRem(24),
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
    lineHeight: t.typography.pxToRem(24),
    margin: 0,
    maxHeight: t.typography.pxToRem(24 * 2),
    overflow: 'hidden',
    overflowWrap: 'break-word',
    textOverflow: 'ellipsis',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
    padding: t.spacing(0, 2, 2),
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

  return (
    <M.Card
      className={classes.bucket}
      data-testid="bucket-grid--bucket"
      data-bucket={bucket.name}
    >
      <M.CardHeader
        disableTypography
        avatar={
          <Link aria-hidden="true" tabIndex={-1} to={urls.bucketRoot(bucket.name)}>
            <BucketIcon seed={bucket.name} glyphIndex={glyphIndex} src={bucket.iconUrl} />
          </Link>
        }
        title={
          <Link className={classes.title} to={urls.bucketRoot(bucket.name)}>
            {bucket.title}
          </Link>
        }
        subheader={
          <Link
            className={classes.name}
            to={urls.bucketRoot(bucket.name)}
            title={`s3://${bucket.name}`}
          >
            s3://{bucket.name}
          </Link>
        }
      />
      {!!bucket.description && (
        <M.CardContent>
          <p className={classes.desc}>{bucket.description}</p>
        </M.CardContent>
      )}
      {!!bucket.tags && !!bucket.tags.length && (
        <div className={classes.tags}>
          {bucket.tags.map((t) => (
            <M.Chip
              key={t}
              className={cx(tagClasses.tag, tagIsMatching(t) && tagClasses.tagActive)}
              label={t}
              size="small"
              clickable={!!onTagClick}
              onClick={onTagClick ? () => onTagClick(t) : undefined}
            />
          ))}
        </div>
      )}
      <M.Box flexGrow={1} />
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

  // Collision-free glyph assignment across the whole grid so no two seeded
  // bucket icons on the page repeat a glyph (recomputed only when the set of
  // names changes).
  const glyphs = React.useMemo(() => assignGlyphs(buckets.map((b) => b.name)), [buckets])

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
