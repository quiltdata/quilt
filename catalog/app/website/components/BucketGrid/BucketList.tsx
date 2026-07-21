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
    display: 'inline-flex',
    gap: t.spacing(1),
    maxWidth: '100%',
    minWidth: 0,
  },
  // The title is the scan anchor: a constant, bold left column down the list.
  title: {
    color: t.palette.text.primary,
    flexShrink: 0,
    fontWeight: 500,
    '&:hover': {
      color: t.palette.tertiary.main,
    },
  },
  name: {
    color: t.palette.text.hint,
    minWidth: 0,
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
  // Right-hand column of a data product row: type chip + counts,
  // occupying the slot where bucket rows show tags/collaborators.
  dpMeta: {
    alignItems: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    gap: t.spacing(0.5),
    marginLeft: t.spacing(2),
  },
  dpCounts: {
    ...t.typography.caption,
    color: t.palette.text.hint,
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
        primary={
          <span className={classes.heading}>
            <Link className={classes.title} to={to}>
              {bucket.title}
            </Link>
            <Link className={classes.name} to={to} title={`s3://${bucket.name}`}>
              s3://{bucket.name}
            </Link>
          </span>
        }
        secondary={bucket.description || null}
        secondaryTypographyProps={{ noWrap: true }}
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

export interface DataProductItem {
  id: string
  name: string
  title: string | null
  description: string | null
  objectCount: number
  packageCount: number
}

interface DataProductRowProps {
  dp: DataProductItem
  divider: boolean
}

// A data product row wearing the same ListItem markup as BucketRow:
// links go to the DP's virtual-bucket browse, never to a physical bucket.
function DataProductRow({ dp, divider }: DataProductRowProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.dataProduct(dp.id)

  return (
    <M.ListItem
      className={classes.row}
      divider={divider}
      data-testid="bucket-grid--data-product"
      data-data-product={dp.name}
    >
      <M.ListItemAvatar className={classes.avatar}>
        <Link aria-hidden="true" tabIndex={-1} to={to}>
          <M.Avatar>
            <M.Icon>view_module</M.Icon>
          </M.Avatar>
        </Link>
      </M.ListItemAvatar>
      <M.ListItemText
        primary={
          <span className={classes.heading}>
            <Link className={classes.title} to={to}>
              {dp.title || dp.name}
            </Link>
            <Link className={classes.name} to={to} title={dp.name}>
              {dp.name}
            </Link>
          </span>
        }
        secondary={dp.description || null}
        secondaryTypographyProps={{ noWrap: true }}
      />
      <div className={classes.dpMeta}>
        <M.Chip label="Data product" size="small" />
        <span className={classes.dpCounts}>
          {dp.packageCount} packages &middot; {dp.objectCount} objects
        </span>
      </div>
    </M.ListItem>
  )
}

interface BucketListProps {
  buckets: ReadonlyArray<Bucket>
  dataProducts?: ReadonlyArray<DataProductItem>
  onTagClick?: (tag: string) => void
  tagIsMatching?: (tag: string) => boolean
  showAddLink?: boolean
}

export default React.forwardRef<HTMLDivElement, BucketListProps>(function BucketList(
  {
    buckets,
    dataProducts = [],
    onTagClick,
    tagIsMatching = () => false,
    showAddLink = false,
  },
  ref,
) {
  const { urls } = NamedRoutes.use()

  return (
    <M.Paper ref={ref}>
      <M.List disablePadding>
        {dataProducts.map((dp, i) => (
          <DataProductRow
            key={dp.id}
            dp={dp}
            divider={showAddLink || !!buckets.length || i < dataProducts.length - 1}
          />
        ))}
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
