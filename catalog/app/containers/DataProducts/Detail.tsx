import * as React from 'react'
import { Redirect, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as NamedRoutes from 'utils/NamedRoutes'

const useStyles = M.makeStyles((t) => ({
  section: {
    marginTop: t.spacing(3),
  },
  sectionHead: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(1),
    marginBottom: t.spacing(1),
  },
  note: {
    marginTop: t.spacing(1),
  },
  // Native privilege strings are the evidence behind a normalized label, so they
  // sit with it rather than in a tooltip that hides on touch.
  native: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '0.75rem',
  },
}))

const PLATFORM_LABEL: Record<DP.PlatformKind, string> = {
  datazone: 'AWS DataZone',
  'unity-schema': 'Databricks Unity',
  'unity-share': 'Databricks Unity',
  'snowflake-listing': 'Snowflake',
}

/**
 * Members, grouped by where their contents come from.
 *
 * This grouping is the point, not styling. Under browse-into (contract §7.1) a
 * product's contents arrive from two sources with *different governance
 * guarantees*: catalog-enumerated members are subject to the catalog's row and
 * column rules, while file contents that only a bucket ARN identifies are listed
 * by Quilt directly — outside those rules entirely. Presenting both in one
 * undifferentiated list would imply a uniform guarantee that does not exist.
 */
function Members({ product }: { product: DP.DataProduct }) {
  const classes = useStyles()
  const caps = DP.CAPABILITIES[product.binding.kind]

  if (!product.members.length) {
    return (
      <M.Typography variant="body2" color="textSecondary">
        You can see this product but not its contents. That is a permission boundary, not
        an empty product — request access to list what it holds.
      </M.Typography>
    )
  }

  const governed = product.members.filter((m) => m.contentsSource === 'CATALOG')
  const direct = product.members.filter((m) => m.contentsSource === 'DIRECT_S3')
  const unavailable = product.members.filter((m) => m.contentsSource === 'UNAVAILABLE')

  const renderRows = (members: DP.Member[]) =>
    members.map((m) => (
      <M.TableRow key={m.logicalName}>
        <M.TableCell>{m.logicalName}</M.TableCell>
        <M.TableCell>{m.kind}</M.TableCell>
        <M.TableCell>
          {/* A null schema is three different facts depending on platform, so it
              is never rendered as "no columns". Filesets have none by nature;
              DataZone hides tabular columns inside an opaque forms string. */}
          {m.schema
            ? `${m.schema.length} ${m.schema.length === 1 ? 'column' : 'columns'}`
            : caps.memberSchema
              ? '—'
              : 'Not exposed by this catalog'}
        </M.TableCell>
        <M.TableCell>
          {m.readable ? (
            'Readable by you'
          ) : (
            <M.Typography variant="body2" color="textSecondary">
              Not readable by you
            </M.Typography>
          )}
        </M.TableCell>
      </M.TableRow>
    ))

  return (
    <>
      {!!governed.length && (
        <>
          <M.Typography variant="body2" color="textSecondary">
            Enumerated and governed by {PLATFORM_LABEL[product.binding.kind]}. Row and
            column rules may apply to what you see.
          </M.Typography>
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell>Name</M.TableCell>
                <M.TableCell>Kind</M.TableCell>
                <M.TableCell>Schema</M.TableCell>
                <M.TableCell>Access</M.TableCell>
              </M.TableRow>
            </M.TableHead>
            <M.TableBody>{renderRows(governed)}</M.TableBody>
          </M.Table>
        </>
      )}

      {!!direct.length && (
        <div className={classes.section}>
          <M.Typography variant="subtitle2">Files listed from S3</M.Typography>
          {/* The honest disclosure. The catalog gave us only a bucket ARN for
              these, so Quilt enumerates S3 itself and the catalog's row/column
              governance does not cover what is shown. A reader deserves to know
              the difference between "the catalog vetted this" and "we listed the
              bucket". */}
          <M.Typography variant="body2" color="textSecondary">
            {PLATFORM_LABEL[product.binding.kind]} identifies these by location only, so
            Quilt lists them from S3 directly. The catalog's row and column rules do not
            apply to this listing.
          </M.Typography>
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell>Name</M.TableCell>
                <M.TableCell>Kind</M.TableCell>
                <M.TableCell>Schema</M.TableCell>
                <M.TableCell>Access</M.TableCell>
              </M.TableRow>
            </M.TableHead>
            <M.TableBody>{renderRows(direct)}</M.TableBody>
          </M.Table>
        </div>
      )}

      {!!unavailable.length && (
        <M.Typography className={classes.note} variant="body2" color="textSecondary">
          {unavailable.length} member{unavailable.length === 1 ? '' : 's'} could not be
          listed from this catalog.
        </M.Typography>
      )}
    </>
  )
}

/**
 * Grants, and deliberately not a verdict.
 *
 * `listGrants` is honest on all three platforms; "can Alice read this" is not —
 * unknowable in principle, because row-policy bodies can call external
 * functions. See `Capabilities.effectiveAccessForNamedUser`, typed as literal
 * `false` so adding a verdict here is a compile error.
 */
function Access({ product }: { product: DP.DataProduct }) {
  const classes = useStyles()
  const caps = DP.CAPABILITIES[product.binding.kind]
  const showOrigin = caps.effectivePermissions

  return (
    <>
      <M.Table size="small">
        <M.TableHead>
          <M.TableRow>
            <M.TableCell>Principal</M.TableCell>
            <M.TableCell>Type</M.TableCell>
            <M.TableCell>Privilege</M.TableCell>
            {showOrigin && <M.TableCell>Origin</M.TableCell>}
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {product.grants.map((g, i) => (
            <M.TableRow key={`${g.principal}:${g.nativePrivilege}:${i}`}>
              <M.TableCell>{g.principal}</M.TableCell>
              <M.TableCell>{g.principalType}</M.TableCell>
              <M.TableCell>
                {g.privilege}{' '}
                <span className={classes.native}>({g.nativePrivilege})</span>
              </M.TableCell>
              {showOrigin && <M.TableCell>{g.origin.toLowerCase()}</M.TableCell>}
            </M.TableRow>
          ))}
        </M.TableBody>
      </M.Table>

      {/* Three-state on purpose. Snowflake's POLICY_REFERENCES is
          privilege-filtered — APPLY/OWNERSHIP on the policy AND OWNERSHIP on the
          table, with SELECT explicitly not enough — so a negative means "not
          visible to us", never "no policy exists". Rendering absence as a
          guarantee would be a false assurance about data protection. */}
      {product.policyFlags.rowLevel === 'PRESENT' && (
        <M.Typography className={classes.note} variant="body2" color="textSecondary">
          Row-level rules are in force on this product, so the rows any given person sees
          may be narrower than the grants above suggest.
        </M.Typography>
      )}
      {product.policyFlags.rowLevel === 'NOT_VISIBLE' && (
        <M.Typography className={classes.note} variant="body2" color="textSecondary">
          Whether row-level rules apply cannot be determined with your privileges. Treat
          this as unknown rather than as none.
        </M.Typography>
      )}

      <M.Typography className={classes.note} variant="body2" color="textSecondary">
        This lists who has been granted access. It is not a statement of what any
        particular person can see — no target catalog can answer that.
      </M.Typography>
    </>
  )
}

export default function Detail() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { dataProductId } = useParams<{ dataProductId: string }>()
  // Exact inverse of the `encodeURIComponent` in the route's url builder — see
  // the note on `dataProduct` in constants/routes.ts for why it is not `decode`
  // from utils/s3paths.
  const id = decodeURIComponent(dataProductId)

  const product = DP.fixtures.ALL_PRODUCTS.find((p) => p.id === id)

  // A synthesized id is not stable across renames — on Unity a schema rename
  // silently changes it and emits no event — so a miss is expected drift, not
  // necessarily a bad URL. Back to the list rather than a 404 dead end.
  if (!product) return <Redirect to={urls.dataProducts()} />

  const caps = DP.CAPABILITIES[product.binding.kind]

  return (
    <>
      <div className={classes.sectionHead}>
        <M.Typography variant="h5">{product.name}</M.Typography>
        {caps.curationStatus && product.curationStatus && (
          <M.Chip
            label={product.curationStatus}
            size="small"
            color={product.curationStatus === 'certified' ? 'primary' : 'default'}
          />
        )}
      </div>

      <M.Typography variant="body2" color="textSecondary">
        Defined in {PLATFORM_LABEL[product.binding.kind]}
        {/* DataZone has no per-product owner API at all (ListEntityOwners takes
            DOMAIN_UNIT only), so a human name here would be derived from project
            memberships. Say so rather than presenting a derivation as a fact. */}
        {product.owningEntity &&
          ` · ${product.owningEntity.kind === 'PROJECT' ? 'owning project' : 'owner'} ${
            product.owningEntity.label
          }${product.owningEntity.derived ? ' (derived)' : ''}`}
      </M.Typography>

      {product.description && (
        <M.Typography className={classes.note} variant="body1">
          {product.description}
        </M.Typography>
      )}

      <div className={classes.section}>
        <M.Typography variant="h6">Contents</M.Typography>
        <Members product={product} />
      </div>

      <div className={classes.section}>
        <M.Typography variant="h6">Access</M.Typography>
        <Access product={product} />
      </div>

      {/* No platform emits product-level change events — not DataZone, whose 36
          EventBridge detail-types include none for data products, and Unity has
          no webhooks at all. So this is "last checked", never live sync. */}
      <M.Typography className={classes.section} variant="caption" color="textSecondary">
        Last checked {product.fetchedAt.toLocaleString()}. Composition can change without
        notice; this catalog does not announce product-level changes.
      </M.Typography>
    </>
  )
}
