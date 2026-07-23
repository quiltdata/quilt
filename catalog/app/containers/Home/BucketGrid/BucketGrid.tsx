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

const useBucketStyles = M.makeStyles((t) => ({
  bucket: {
    animation: '$slideUp 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    // Fill the grid cell so cards in the same row are equal height.
    height: '100%',
    // Floor every card to a uniform height so grid rows stay uniform instead of
    // ragged; the flexGrow spacer below absorbs the slack when content is shorter.
    minHeight: t.spacing(26),
  },
  // Keep the collaborators badge within the header padding (drop CardHeader's
  // default negative margins).
  action: {
    margin: 0,
  },
  title: {
    ...t.typography.h6,
    color: t.palette.tertiary.main,
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
  const { urls } = NamedRoutes.use()

  return (
    <M.Card
      className={classes.bucket}
      data-testid="bucket-grid--bucket"
      data-bucket={bucket.name}
    >
      <M.CardHeader
        classes={{ action: classes.action }}
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
        action={
          cfg.mode === 'PRODUCT' && showCollaborators ? (
            <Collaborators
              bucket={bucket.name}
              collaborators={bucket.collaborators ?? null}
            />
          ) : undefined
        }
      />
      {!!bucket.description && (
        <M.CardContent>
          <p className={classes.desc}>{bucket.description}</p>
        </M.CardContent>
      )}
      <M.Box flexGrow={1} />
      {!!bucket.tags && !!bucket.tags.length && (
        <div className={classes.tags}>
          {bucket.tags.map((t) => (
            <M.Chip
              key={t}
              label={t}
              size="small"
              clickable={!!onTagClick}
              color={tagIsMatching(t) ? 'primary' : 'default'}
              onClick={onTagClick ? () => onTagClick(t) : undefined}
            />
          ))}
        </div>
      )}
    </M.Card>
  )
}

const useStyles = M.makeStyles((t) => ({
  add: {
    alignItems: 'center',
    border: '2px dashed #2f306e',
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
    '& > span': {
      fontSize: '4rem',
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
