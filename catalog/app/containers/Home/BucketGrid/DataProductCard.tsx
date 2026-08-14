import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as NamedRoutes from 'utils/NamedRoutes'

// A data product wearing BucketCard's markup: same three bands (header wash,
// body, bottom row), same truncation and hover treatment, so a mixed grid reads
// as one wall of cards rather than two card vocabularies. What differs is what a
// DP has instead of tags and collaborators -- a type chip and member counts --
// and where its links go: the DP's virtual-bucket browse, never a physical
// bucket.
//
// Deliberately not a `variant` prop on BucketCard: the two share layout but
// almost no fields (no iconUrl, no s3:// address, no tags, no collaborators),
// and threading a discriminated union through that component would cost more
// than the duplicated shell.

export interface DataProductItem {
  id: string
  name: string
  title: string | null
  description: string | null
  objectCount: number
  packageCount: number
}

const ICON_SIZE = 44

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    transition: t.transitions.create(['background-color', 'border-color'], {
      duration: 150,
    }),
    '&:hover': {
      backgroundColor: t.palette.action.hover,
      borderColor: t.palette.text.secondary,
    },
  },
  header: {
    alignItems: 'center',
    backgroundColor: fade(t.palette.primary.main, 0.04),
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    gap: t.spacing(1.5),
    minWidth: 0,
    padding: t.spacing(2),
    textDecoration: 'none',
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    padding: t.spacing(2),
  },
  bodySpacer: {
    flexGrow: 1,
  },
  bottomRow: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    justifyContent: 'space-between',
  },
  // Matches BucketIcon's footprint so a DP card's identity block aligns with a
  // bucket card's in the same grid row.
  avatar: {
    flexShrink: 0,
    height: ICON_SIZE,
    width: ICON_SIZE,
  },
  identity: {
    minWidth: 0,
  },
  title: {
    color: t.palette.text.primary,
    display: 'block',
    fontWeight: t.typography.fontWeightMedium,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  name: {
    color: t.palette.text.secondary,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  description: {
    ...(t.mixins as $TSFixMe).lineClamp(2),
    color: t.palette.text.secondary,
  },
  counts: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    flexShrink: 0,
  },
}))

interface DataProductCardProps {
  dp: DataProductItem
}

export default function DataProductCard({ dp }: DataProductCardProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.dataProduct(dp.id)

  // The title is authored and optional; the name is the addressable identity.
  // With no title the name carries the title slot and the second line is
  // dropped rather than repeating itself.
  const heading = dp.title || dp.name
  const showName = !!dp.title

  return (
    <div
      className={classes.root}
      data-testid="bucket-grid--data-product"
      data-data-product={dp.name}
    >
      <Link className={classes.header} to={to} title={heading}>
        <M.Avatar className={classes.avatar}>
          <M.Icon>view_module</M.Icon>
        </M.Avatar>
        <div className={classes.identity}>
          <M.Typography className={classes.title} component="span" variant="body1">
            {heading}
          </M.Typography>
          {showName && (
            <M.Typography className={classes.name} component="span" variant="body2">
              {dp.name}
            </M.Typography>
          )}
        </div>
      </Link>
      <div className={classes.body}>
        {!!dp.description && (
          <M.Typography className={classes.description} component="p" variant="caption">
            {dp.description}
          </M.Typography>
        )}
        <div className={classes.bodySpacer} />
        <div className={classes.bottomRow}>
          <M.Chip label="Data product" size="small" />
          <span className={classes.counts}>
            {dp.packageCount} packages &middot; {dp.objectCount} objects
          </span>
        </div>
      </div>
    </div>
  )
}
