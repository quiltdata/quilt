import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as DP from 'model/DataProducts'
import * as NamedRoutes from 'utils/NamedRoutes'

// An externally-owned data product wearing BucketCard's markup: same three bands
// (header wash, body, bottom row), same truncation and hover treatment, so a
// mixed volume grid reads as one wall of cards rather than two card
// vocabularies. What differs is what a DP has instead of tags and collaborators
// -- the catalog that defines it and how much of it you can actually read.
//
// Deliberately not a `variant` prop on BucketCard: the two share layout but
// almost no fields (no iconUrl, no s3:// address, no tags, no collaborators),
// and threading a discriminated union through that component would cost more
// than the duplicated shell.

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
  platform: {
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
  access: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    flexShrink: 0,
    textAlign: 'right',
  },
}))

interface DataProductCardProps {
  product: DP.DataProduct
}

export default function DataProductCard({ product }: DataProductCardProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.dataProduct(product.id)
  const caps = DP.capabilitiesFor(product.binding.kind)
  const platform = DP.PLATFORM_LABEL[product.binding.kind]

  return (
    <div
      className={classes.root}
      data-testid="bucket-grid--data-product"
      data-data-product={product.id}
    >
      <Link className={classes.header} to={to} title={product.name}>
        {/* No iconUrl to honor: an external product has no Quilt-side icon, so
            the avatar is a plain type glyph rather than a hashed identity tint.
            Identity tints encode *which object* and are reserved for objects
            that own one. */}
        <M.Avatar className={classes.avatar}>
          <M.Icon>view_module</M.Icon>
        </M.Avatar>
        <div className={classes.identity}>
          <M.Typography className={classes.title} component="span" variant="body1">
            {product.name}
          </M.Typography>
          <M.Typography className={classes.platform} component="span" variant="body2">
            {platform}
          </M.Typography>
        </div>
      </Link>
      <div className={classes.body}>
        {!!product.description && (
          <M.Typography className={classes.description} component="p" variant="caption">
            {product.description}
          </M.Typography>
        )}
        <div className={classes.bodySpacer} />
        <div className={classes.bottomRow}>
          {/* Curation is capability-gated: only Unity has the primitive, so
              elsewhere the chip is absent rather than empty. An unconditional
              "—" would read as "not certified" when the truth is that the
              catalog has no such concept. */}
          {caps.curationStatus && product.curationStatus ? (
            <M.Chip
              label={product.curationStatus}
              size="small"
              color={product.curationStatus === 'certified' ? 'primary' : 'default'}
            />
          ) : (
            <M.Chip label="Data product" size="small" />
          )}
          <span className={classes.access}>{DP.accessSummary(product)}</span>
        </div>
      </div>
    </div>
  )
}
