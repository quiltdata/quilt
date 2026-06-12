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
    background: 'linear-gradient(to top, #1f2151, #2f306e)',
    borderRadius: t.spacing(2),
    boxShadow: '0px 16px 40px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    padding: t.spacing(4),
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    alignItems: 'flex-start',
    display: 'flex',
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minWidth: 0,
  },
  icon: {
    display: 'flex',
    flexShrink: 0,
    marginRight: t.spacing(2),
    marginTop: t.spacing(1),
  },
  title: {
    ...t.typography.h6,
    color: t.palette.tertiary.main,
  },
  name: {
    ...t.typography.body1,
    color: t.palette.text.hint,
    lineHeight: t.typography.pxToRem(24),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  desc: {
    ...t.typography.body2,
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
    color: t.palette.text.secondary,
    display: '-webkit-box',
    lineHeight: t.typography.pxToRem(24),
    marginBottom: t.spacing(4),
    marginTop: t.spacing(3),
    maxHeight: t.typography.pxToRem(24 * 3),
    overflow: 'hidden',
    overflowWrap: 'break-word',
    textOverflow: 'ellipsis',
  },
  tags: {
    marginRight: t.spacing(-1),
  },
  active: {},
  matching: {},
  shared: {
    marginLeft: t.spacing(1),
  },
  tag: {
    ...t.typography.body2,
    background: fade(t.palette.secondary.main, 0.3),
    border: 'none',
    borderRadius: 2,
    color: t.palette.text.primary,
    display: 'inline-block',
    lineHeight: t.typography.pxToRem(28),
    marginRight: t.spacing(1),
    marginTop: t.spacing(1),
    outline: 'none',
    paddingBottom: 0,
    paddingLeft: t.spacing(1),
    paddingRight: t.spacing(1),
    paddingTop: 0,
    '&$active': {
      cursor: 'pointer',
    },
    '&$matching': {
      background: t.palette.secondary.main,
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
    <div
      className={classes.bucket}
      data-testid="bucket-grid--bucket"
      data-bucket={bucket.name}
    >
      <div className={classes.header}>
        <Link
          aria-hidden="true"
          className={classes.icon}
          tabIndex={-1}
          to={urls.bucketRoot(bucket.name)}
        >
          <BucketIcon src={bucket.iconUrl || undefined} />
        </Link>
        <div className={classes.headerText}>
          <Link className={classes.title} to={urls.bucketRoot(bucket.name)}>
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
        {cfg.mode === 'PRODUCT' && (
          <div className={classes.shared}>
            <Collaborators
              bucket={bucket.name}
              collaborators={bucket.collaborators ?? null}
            />
          </div>
        )}
      </div>
      {!!bucket.description && <p className={classes.desc}>{bucket.description}</p>}
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
    </div>
  )
}

const useStyles = M.makeStyles((t: WebsiteTheme) => ({
  root: {
    display: 'grid',
    gridColumnGap: t.spacing(4),
    gridRowGap: t.spacing(4),
    gridTemplateColumns: '1fr 1fr 1fr',
    gridAutoRows: `minmax(${t.spacing(25)}px, auto)`,
    [t.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr 1fr',
    },
    [t.breakpoints.down('xs')]: {
      gridTemplateColumns: 'auto',
    },
  },
  add: {
    alignItems: 'center',
    border: '2px dashed #2f306e',
    borderRadius: t.spacing(2),
    color: t.palette.tertiary.main,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'center',
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
    <div className={classes.root} ref={ref}>
      {buckets.map((b) => (
        <BucketCard
          bucket={b}
          key={b.name}
          onTagClick={onTagClick}
          tagIsMatching={tagIsMatching}
        />
      ))}
      {showAddLink && (
        <Link className={classes.add} to={urls.adminBuckets({ add: true })}>
          <M.Icon>add</M.Icon>
        </Link>
      )}
    </div>
  )
})
