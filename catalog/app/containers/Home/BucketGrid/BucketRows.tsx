import cx from 'classnames'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import BucketIcon from 'components/BucketIcon'
import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'

import Collaborators from './Collaborators'
import type { Bucket } from './BucketCard'
import type { DataProductItem } from './DataProductCard'

// The dense counterpart to the card grid: same buckets, same fields, one line
// each. It exists so a long volume list can be scanned vertically without a
// wall of cards -- see `BucketList` for the card side and `Buckets` for the
// toggle that chooses between them.

const useStyles = M.makeStyles((t) => ({
  row: {
    // The card's hover treatment, applied to a row: the same ground shift and
    // the same 150ms, so both views react identically to the same element.
    transition: t.transitions.create('background-color', { duration: 150 }),
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
  },
  // Only rows that actually render the access readout reserve the right
  // gutter ListItemSecondaryAction needs; the rest keep their full width.
  rowWithSecondary: {
    paddingRight: t.spacing(14),
  },
  avatar: {
    minWidth: t.spacing(6),
  },
  text: {
    margin: 0,
    minWidth: 0,
  },
  // Title over `s3://name` would double the row height, so they share one
  // line: the title takes the room it needs and the address follows it,
  // truncating first when the row gets tight.
  heading: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(1),
    minWidth: 0,
  },
  title: {
    color: t.palette.text.primary,
    flexShrink: 0,
    fontWeight: t.typography.fontWeightMedium,
    maxWidth: '50%',
    overflow: 'hidden',
    textDecoration: 'none',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  name: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    minWidth: 0,
    overflow: 'hidden',
    textDecoration: 'none',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  description: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  tags: {
    display: 'flex',
    flexShrink: 0,
    gap: t.spacing(0.5),
    marginLeft: t.spacing(2),
  },
  // Mirrors BucketCard's chip vocabulary (focus ring on the hashed
  // `Mui-focusVisible` hook; a matching chip washed in the Indicator amber
  // rather than filled) so a tag reads the same in either view.
  tag: {
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  matching: {
    backgroundColor: fade(t.palette.secondary.main, 0.15),
    border: `1px solid ${t.palette.secondary.main}`,
    color: t.palette.text.primary,
  },
  // The right-hand column of a data product row: type chip over member counts,
  // occupying the slot where a bucket row runs its tags and access readout.
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
    color: t.palette.text.secondary,
  },
}))

// Beyond this the chips crowd the description out of the row; the card grid
// is where a heavily tagged bucket shows everything.
const MAX_VISIBLE_TAGS = 3

interface BucketRowProps {
  bucket: Bucket
  divider: boolean
  tagIsMatching: (tag: string) => boolean
  onTagClick: (tag: string) => void
}

function BucketRow({ bucket, divider, tagIsMatching, onTagClick }: BucketRowProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.bucketRoot(bucket.name)

  const hasCollaborators = cfg.mode === 'PRODUCT'

  const visibleTags = (bucket.tags || []).slice(0, MAX_VISIBLE_TAGS)

  const handleTagClick = React.useCallback(
    (tg: string) => (e: React.SyntheticEvent) => {
      // A tag click filters; it never navigates the row.
      e.preventDefault()
      e.stopPropagation()
      onTagClick(tg)
    },
    [onTagClick],
  )

  return (
    <M.ListItem
      className={cx(classes.row, hasCollaborators && classes.rowWithSecondary)}
      divider={divider}
      data-testid="bucket-grid--bucket"
      data-bucket={bucket.name}
    >
      <M.ListItemAvatar className={classes.avatar}>
        <Link aria-hidden="true" tabIndex={-1} to={to}>
          <BucketIcon src={bucket.iconUrl} label={bucket.title} tintKey={bucket.name} />
        </Link>
      </M.ListItemAvatar>
      <M.ListItemText
        className={classes.text}
        disableTypography
        primary={
          <span className={classes.heading}>
            <Link className={classes.title} to={to} title={bucket.title}>
              {bucket.title}
            </Link>
            {/* The title is the row's single tab stop; the address links to
                the same route for mouse users but stays out of the tab order
                so keyboard/AT users get one stop per row, not two. */}
            <Link
              className={classes.name}
              to={to}
              title={`s3://${bucket.name}`}
              tabIndex={-1}
            >
              s3://{bucket.name}
            </Link>
          </span>
        }
        secondary={
          bucket.description ? (
            <M.Typography
              className={classes.description}
              variant="body2"
              color="textSecondary"
              component="span"
            >
              {bucket.description}
            </M.Typography>
          ) : null
        }
      />
      {!!visibleTags.length && (
        <div className={classes.tags}>
          {visibleTags.map((tg) => (
            <M.Chip
              key={tg}
              className={cx(classes.tag, { [classes.matching]: tagIsMatching(tg) })}
              label={tg}
              size="small"
              clickable
              color="default"
              onClick={handleTagClick(tg)}
            />
          ))}
        </div>
      )}
      {hasCollaborators && (
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

interface DataProductRowProps {
  dp: DataProductItem
  divider: boolean
}

// A data product row wearing BucketRow's markup: links go to the DP's
// virtual-bucket browse, never to a physical bucket. With no authored title the
// name carries the title slot rather than repeating itself on both lines.
function DataProductRow({ dp, divider }: DataProductRowProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.dataProduct(dp.id)

  const heading = dp.title || dp.name

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
        className={classes.text}
        disableTypography
        primary={
          <span className={classes.heading}>
            <Link className={classes.title} to={to} title={heading}>
              {heading}
            </Link>
            {!!dp.title && (
              <Link className={classes.name} to={to} title={dp.name} tabIndex={-1}>
                {dp.name}
              </Link>
            )}
          </span>
        }
        secondary={
          dp.description ? (
            <M.Typography
              className={classes.description}
              variant="body2"
              color="textSecondary"
              component="span"
            >
              {dp.description}
            </M.Typography>
          ) : null
        }
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

interface BucketRowsProps {
  buckets: ReadonlyArray<Bucket>
  // Data products lead the list, for the same reason they lead the grid: the
  // sort options key off bucket-only fields. See `Buckets.jsx`.
  dataProducts?: ReadonlyArray<DataProductItem>
  tagIsMatching?: (tag: string) => boolean
  onTagClick?: (tag: string) => void
}

export default function BucketRows({
  buckets,
  dataProducts = [],
  tagIsMatching = () => false,
  onTagClick = () => {},
}: BucketRowsProps) {
  return (
    <M.Paper elevation={0} variant="outlined">
      <M.List disablePadding>
        {dataProducts.map((dp, i) => (
          <DataProductRow
            key={dp.id}
            dp={dp}
            // A divider unless this is the last row overall: DP rows precede
            // bucket rows, so the final DP still needs one when buckets follow.
            divider={!!buckets.length || i < dataProducts.length - 1}
          />
        ))}
        {buckets.map((b, i) => (
          <BucketRow
            key={b.name}
            bucket={b}
            divider={i < buckets.length - 1}
            tagIsMatching={tagIsMatching}
            onTagClick={onTagClick}
          />
        ))}
      </M.List>
    </M.Paper>
  )
}
