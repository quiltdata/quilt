import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import BucketIcon from 'components/BucketIcon'
import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import type { WebsiteTheme } from 'website/theme'

import type { Bucket } from './BucketGrid'
import Collaborators from './Collaborators'

const useStyles = M.makeStyles((t: WebsiteTheme) => ({
  row: {
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
  },
  avatar: {
    minWidth: t.spacing(6),
  },
  heading: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(1),
    minWidth: 0,
  },
  // The title is the scan anchor: a constant, bold left column down the list.
  title: {
    ...t.typography.subtitle2,
    color: t.palette.text.primary,
    flexShrink: 0,
    '&:hover': {
      color: t.palette.tertiary.main,
    },
  },
  name: {
    ...t.typography.body2,
    color: t.palette.text.hint,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  desc: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tags: {
    display: 'flex',
    flexShrink: 0,
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
    justifyContent: 'flex-end',
    marginLeft: t.spacing(2),
    maxWidth: '40%',
  },
}))

interface BucketRowProps {
  bucket: Bucket
  divider: boolean
  onTagClick?: (tag: string) => void
  tagIsMatching: (tag: string) => boolean
}

function BucketRow({ bucket, divider, onTagClick, tagIsMatching }: BucketRowProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.bucketRoot(bucket.name)

  return (
    <M.ListItem
      className={classes.row}
      divider={divider}
      data-testid="bucket-grid--bucket"
      data-bucket={bucket.name}
    >
      <M.ListItemAvatar className={classes.avatar}>
        <Link aria-hidden="true" tabIndex={-1} to={to}>
          <BucketIcon src={bucket.iconUrl} />
        </Link>
      </M.ListItemAvatar>
      <M.ListItemText
        disableTypography
        primary={
          <div className={classes.heading}>
            <Link className={classes.title} to={to}>
              {bucket.title}
            </Link>
            <Link className={classes.name} to={to} title={`s3://${bucket.name}`}>
              s3://{bucket.name}
            </Link>
          </div>
        }
        secondary={
          bucket.description ? <p className={classes.desc}>{bucket.description}</p> : null
        }
      />
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
      {cfg.mode === 'PRODUCT' && (
        <M.ListItemSecondaryAction>
          <Collaborators
            bucket={bucket.name}
            collaborators={bucket.collaborators ?? null}
          />
        </M.ListItemSecondaryAction>
      )}
    </M.ListItem>
  )
}

interface BucketListProps {
  buckets: ReadonlyArray<Bucket>
  onTagClick?: (tag: string) => void
  tagIsMatching?: (tag: string) => boolean
  showAddLink?: boolean
}

export default React.forwardRef<HTMLDivElement, BucketListProps>(function BucketList(
  { buckets, onTagClick, tagIsMatching = () => false, showAddLink = false },
  ref,
) {
  const { urls } = NamedRoutes.use()

  return (
    <M.Paper ref={ref}>
      <M.List disablePadding>
        {buckets.map((b, i) => (
          <BucketRow
            key={b.name}
            bucket={b}
            divider={showAddLink || i < buckets.length - 1}
            onTagClick={onTagClick}
            tagIsMatching={tagIsMatching}
          />
        ))}
        {showAddLink && (
          <M.ListItem button component={Link} to={urls.adminBuckets({ add: true })}>
            <M.ListItemIcon>
              <M.Icon>add</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText primary="Add a bucket" />
          </M.ListItem>
        )}
      </M.List>
    </M.Paper>
  )
})
