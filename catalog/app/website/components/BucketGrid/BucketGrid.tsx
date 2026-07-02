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
    background:
      t.palette.type === 'dark'
        ? 'linear-gradient(to top, #1f2151, #2f306e)'
        : t.palette.common.white,
    border: t.palette.type === 'dark' ? 'none' : '1px solid rgba(40,43,80,.09)',
    borderRadius: t.spacing(2),
    boxShadow:
      t.palette.type === 'dark'
        ? '0px 16px 40px rgba(0, 0, 0, 0.2)'
        : '0 8px 24px rgba(40,43,80,.08)',
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
  icon: {
    display: 'flex',
    // Light mode: tinted rounded tile behind the icon, per the markup.
    ...(t.palette.type === 'dark'
      ? {}
      : {
          alignItems: 'center',
          background: fade(t.palette.secondary.main, 0.1),
          borderRadius: t.spacing(1),
          height: t.spacing(5),
          justifyContent: 'center',
          width: t.spacing(5),
        }),
  },
  title: {
    ...t.typography.h6,
    color: t.palette.tertiary.main,
  },
  name: {
    ...t.typography.body1,
    color: t.palette.type === 'dark' ? t.palette.text.hint : '#8a90a6',
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
  // A volume is still an S3 bucket for now; the chip names the backing store.
  chip: {
    ...t.typography.overline,
    border:
      t.palette.type === 'dark'
        ? `1px solid ${fade('#fff', 0.12)}`
        : '1px solid rgba(40,43,80,.15)',
    borderRadius: 3,
    color: t.palette.type === 'dark' ? t.palette.text.hint : '#8a90a6',
    display: 'block',
    fontFamily: ['Roboto Mono', 'monospace'].join(','),
    fontSize: 9,
    letterSpacing: '0.1em',
    lineHeight: '16px',
    marginBottom: t.spacing(1),
    padding: '2px 6px',
    width: 'fit-content',
  },
  shared: {
    marginLeft: t.spacing(1),
  },
  tag: {
    ...t.typography.body2,
    background:
      t.palette.type === 'dark'
        ? fade(t.palette.secondary.main, 0.3)
        : fade(t.palette.secondary.main, 0.1),
    border: 'none',
    borderRadius: 2,
    color: t.palette.type === 'dark' ? t.palette.text.primary : '#4055a8',
    display: 'inline-block',
    lineHeight: t.typography.pxToRem(28),
    marginRight: t.spacing(1),
    marginTop: t.spacing(1),
    outline: 'none',
    padding: t.spacing(0, 1),
    '&$active': {
      cursor: 'pointer',
    },
    '&$matching': {
      background: t.palette.secondary.main,
      color: t.palette.common.white,
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
          <Link
            aria-hidden="true"
            className={classes.icon}
            tabIndex={-1}
            to={urls.bucketRoot(bucket.name)}
          >
            <BucketIcon src={bucket.iconUrl} />
          </Link>
        }
        title={
          <>
            {/* A volume is still an S3 bucket for now; the chip names the backing store. */}
            <span className={classes.chip}>S3</span>
            <Link className={classes.title} to={urls.bucketRoot(bucket.name)}>
              {bucket.title}
            </Link>
          </>
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
  // Container-driven columns: the sidebar shrinks the content column well below
  // the viewport width, so viewport breakpoints (Grid xs/sm/md/lg) overcommit
  // columns and cram the cards. auto-fill/minmax sizes off the actual row width.
  grid: {
    display: 'grid',
    gap: t.spacing(4),
    gridTemplateColumns: 'repeat(auto-fill, minmax(272px, 1fr))',
    [t.breakpoints.down('xs')]: {
      gridTemplateColumns: '1fr',
    },
  },
  add: {
    alignItems: 'center',
    border:
      t.palette.type === 'dark' ? '2px dashed #2f306e' : '2px dashed rgba(40,43,80,.2)',
    borderRadius: t.spacing(2),
    color: t.palette.tertiary.main,
    cursor: 'pointer',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    minHeight: t.spacing(25),
    '&:hover': {
      background: fade(t.palette.tertiary.main, 0.04),
      borderColor:
        t.palette.type === 'dark' ? '#2f306e' : fade(t.palette.tertiary.main, 0.5),
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
    <div className={classes.grid} ref={ref}>
      {buckets.map((b) => (
        <BucketCard
          key={b.name}
          bucket={b}
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
