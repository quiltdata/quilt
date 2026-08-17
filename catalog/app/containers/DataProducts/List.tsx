import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles((t) => ({
  row: {
    display: 'block',
    padding: t.spacing(2, 3),
    textDecoration: 'none',
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
  },
  head: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(1),
  },
  // Pushes the platform origin to the trailing edge: it is orienting context,
  // not the thing being scanned for.
  origin: {
    marginLeft: 'auto',
  },
  description: {
    marginTop: t.spacing(0.5),
  },
  meta: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    marginTop: t.spacing(1),
  },
}))

// The catalog a product came from, in the vendor's own words. Products are
// externally owned, so which catalog defines one is a fact about it, not an
// implementation detail to hide.
const PLATFORM_LABEL: Record<DP.PlatformKind, string> = {
  datazone: 'AWS DataZone',
  'unity-schema': 'Databricks Unity',
  'unity-share': 'Databricks Unity',
  'snowflake-listing': 'Snowflake',
}

interface RowProps {
  product: DP.DataProduct
}

function Row({ product }: RowProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const caps = DP.CAPABILITIES[product.binding.kind]

  // Zero members is a real state, not an empty product: discovery-only access
  // (Unity BROWSE) shows the product with no contents. Saying "no members" would
  // misreport a permission boundary as an empty dataset.
  const memberCount = product.members.length
  const contents =
    memberCount > 0
      ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}`
      : 'Contents not visible to you'

  return (
    <M.Link className={classes.row} component={Link} to={urls.dataProduct(product.id)}>
      <div className={classes.head}>
        <M.Typography variant="subtitle1">{product.name}</M.Typography>
        {/* Unity's system.certification_status is the only curation primitive on
            any of the three platforms, so it is shown where it exists and simply
            absent elsewhere — never rendered as "uncertified", which would imply
            a judgement the other catalogs never made. */}
        {caps.curationStatus && product.curationStatus && (
          <M.Chip
            label={product.curationStatus}
            size="small"
            color={product.curationStatus === 'certified' ? 'primary' : 'default'}
          />
        )}
        <M.Typography className={classes.origin} variant="caption" color="textSecondary">
          {PLATFORM_LABEL[product.binding.kind]}
        </M.Typography>
      </div>

      {product.description && (
        <M.Typography
          className={classes.description}
          variant="body2"
          color="textSecondary"
        >
          {product.description}
        </M.Typography>
      )}

      <div className={classes.meta}>
        <M.Typography variant="caption" color="textSecondary">
          {contents}
        </M.Typography>
        {product.labels.map((label) => (
          <M.Chip key={label} label={label} size="small" variant="outlined" />
        ))}
      </div>
    </M.Link>
  )
}

export default function List() {
  const products = DP.fixtures.ALL_PRODUCTS

  if (!products.length) {
    return (
      <M.Box padding={3}>
        <M.Typography variant="body2" color="textSecondary">
          No data products found. Products are defined in your enterprise catalog; ask a
          catalog administrator to publish one.
        </M.Typography>
      </M.Box>
    )
  }

  return (
    <>
      {products.map((product, i) => (
        <React.Fragment key={product.id}>
          {i > 0 && <M.Divider />}
          <Row product={product} />
        </React.Fragment>
      ))}
    </>
  )
}
