import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import BucketIcon from 'components/BucketIcon'
import cfg from 'constants/config'
import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import type { WebsiteTheme } from 'website/theme'

import Collaborators from './Collaborators'

const useBucketStyles = M.makeStyles((t: WebsiteTheme) => ({
  bucket: {
    animation: '$slideUp 0.3s ease',
    display: 'flex',
    flexDirection: 'column',
    // Fill the grid cell so cards in the same row are equal height.
    height: '100%',
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
  name: {
    ...t.typography.body1,
    color: t.palette.text.hint,
    display: 'block',
    lineHeight: t.typography.pxToRem(24),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  desc: {
    ...t.typography.body2,
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    color: t.palette.text.secondary,
    display: '-webkit-box',
    lineHeight: t.typography.pxToRem(24),
    margin: 0,
    maxHeight: t.typography.pxToRem(24 * 3),
    overflow: 'hidden',
    overflowWrap: 'break-word',
    textOverflow: 'ellipsis',
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    padding: t.spacing(0, 2, 2),
  },
  active: {},
  matching: {},
  tag: {
    ...t.typography.body2,
    background: fade(t.palette.primary.main, 0.3),
    border: 'none',
    borderRadius: 2,
    color: t.palette.text.primary,
    lineHeight: t.typography.pxToRem(28),
    marginRight: t.spacing(1),
    marginTop: t.spacing(1),
    outline: 'none',
    padding: t.spacing(0, 1),
    '&$active': {
      cursor: 'pointer',
    },
    '&$matching': {
      background: t.palette.primary.main,
      color: t.palette.primary.contrastText,
    },
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

interface Bucket {
  name: string
  title: string
  iconUrl: string | null
  description: string | null
  tags: ReadonlyArray<string> | null
  collaborators?: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection> | null
}

interface BucketCardProps {
  bucket: Bucket
  onTagClick?: (tag: string) => void
  tagIsMatching: (tag: string) => boolean
}

function BucketCard({ bucket, onTagClick, tagIsMatching }: BucketCardProps) {
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
            <BucketIcon src={bucket.iconUrl} />
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
          cfg.mode === 'PRODUCT' ? (
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
            <button
              key={t}
              className={cx(
                classes.tag,
                tagIsMatching(t) && classes.matching,
                !!onTagClick && classes.active,
              )}
              type="button"
              onClick={() => onTagClick?.(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </M.Card>
  )
}

const useStyles = M.makeStyles((t: WebsiteTheme) => ({
  add: {
    alignItems: 'center',
    border: '2px dashed #2f306e',
    borderRadius: t.spacing(2),
    color: t.palette.tertiary.main,
    cursor: 'pointer',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    minHeight: t.spacing(25),
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
}

export default React.forwardRef<HTMLDivElement, BucketGridProps>(function BucketGrid(
  { buckets, onTagClick, tagIsMatching = () => false, showAddLink = false },
  ref,
) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()

  return (
    <M.Grid container spacing={4} ref={ref}>
      {buckets.map((b) => (
        <M.Grid item xs={12} sm={6} md={4} lg={3} key={b.name}>
          <BucketCard bucket={b} onTagClick={onTagClick} tagIsMatching={tagIsMatching} />
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
