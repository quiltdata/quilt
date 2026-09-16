import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as NamedRoutes from 'utils/NamedRoutes'

// A data product wearing BucketCard's markup: same three bands (header, body,
// bottom row), same truncation and hover treatment, so a mixed volume grid reads
// as one wall of cards rather than two card vocabularies. What differs is what a
// product has instead of tags and collaborators -- the workspace that publishes
// it, and this workspace's relation to it.
//
// Deliberately not a `variant` prop on BucketCard: the two share layout but almost
// no fields (no iconUrl, no s3:// address, no tags, no collaborators), and
// threading a discriminated union through that component would cost more than the
// duplicated shell.
//
// What this card must never show: anything that reads as a claim about
// readability. No entry counts, no "n of m readable", no size. A row says what the
// workspace's *relation* to the product is; whether its bytes can be read is a
// mint's answer, and four separate facts stand between a listing and a read
// (model.md invariant 1).

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
    display: 'flex',
    gap: t.spacing(1.5),
    padding: t.spacing(2),
  },
  icon: {
    alignItems: 'center',
    background: t.palette.action.selected,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexShrink: 0,
    height: ICON_SIZE,
    justifyContent: 'center',
    width: ICON_SIZE,
  },
  heading: {
    minWidth: 0,
  },
  title: {
    color: t.palette.text.primary,
    display: 'block',
    overflow: 'hidden',
    textDecoration: 'none',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  owner: {
    color: t.palette.text.secondary,
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  body: {
    flexGrow: 1,
    padding: t.spacing(0, 2, 2),
  },
  description: {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 3,
  },
  bottom: {
    alignItems: 'center',
    borderTop: `1px solid ${t.palette.divider}`,
    display: 'flex',
    gap: t.spacing(1),
    minHeight: t.spacing(5),
    padding: t.spacing(1, 2),
  },
}))

export default function DataProductCard({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  // The bucket route: a product is a bucket the catalog reaches through the proxy.
  const to = urls.bucketRoot(product.id)
  const holding = DP.holdingSummary(product.holding)

  return (
    <div className={classes.root} data-testid="volume-grid--data-product">
      <div className={classes.header}>
        <Link aria-hidden="true" tabIndex={-1} to={to} className={classes.icon}>
          {/* A plain type glyph rather than a hashed identity tint: a product has
              no Quilt-side icon of its own. */}
          <M.Icon color="action">view_module</M.Icon>
        </Link>
        <div className={classes.heading}>
          <M.Typography variant="subtitle1" className={classes.title} component="span">
            <Link className={classes.title} to={to} title={product.title}>
              {product.title}
            </Link>
          </M.Typography>
          <M.Typography variant="caption" className={classes.owner}>
            Data product · {product.owner.name}
          </M.Typography>
        </div>
      </div>
      <div className={classes.body}>
        {product.description && (
          <M.Typography
            variant="body2"
            color="textSecondary"
            className={classes.description}
          >
            {product.description}
          </M.Typography>
        )}
      </div>
      <div className={classes.bottom}>
        <M.Typography variant="caption" color="textSecondary">
          {/* The relation, with an amber mark when the record and the grant
              disagree -- never a resolved state (screen rule R5). */}
          {holding
            ? `${holding.attention ? '⚠ ' : ''}${holding.label}`
            : product.published
              ? 'Listed · not subscribed'
              : 'Unpublished'}
        </M.Typography>
      </div>
    </div>
  )
}
