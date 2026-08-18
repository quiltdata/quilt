import * as React from 'react'
import { Link, Redirect, Route, Switch, useLocation, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as Format from 'utils/format'
import * as NamedRoutes from 'utils/NamedRoutes'

import Requests from './Requests'

// Wears the shell the Quilt-owned DP view established: an overline/title/summary
// header, then addressable section tabs. What differs is what an
// externally-owned product has instead of Quilt packages and objects -- a
// defining catalog, capability-gated fields, and governance that belongs to
// someone else.
//
// Sections are routes rather than local state, matching the in-bucket
// vocabulary: a tab is linkable and survives reload.

const useStyles = M.makeStyles((t) => ({
  headerTop: {
    padding: t.spacing(2, 3),
  },
  overline: {
    display: 'block',
  },
  summary: {
    marginTop: t.spacing(0.5),
  },
  tab: {
    minWidth: 120,
  },
  infoCard: {
    padding: t.spacing(3),
  },
  section: {
    marginTop: t.spacing(3),
  },
  sectionHead: {
    alignItems: 'baseline',
    display: 'flex',
    gap: t.spacing(1),
    marginBottom: t.spacing(1),
  },
  stat: {
    marginTop: t.spacing(2),
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

const pluralize = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

function NavTab(
  props: React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>,
) {
  return <M.Tab component={Link} {...props} />
}

/** Label over a secondary value, the DP overview's readout unit. */
function Stat({ label, children }: React.PropsWithChildren<{ label: string }>) {
  const classes = useStyles()
  return (
    <div className={classes.stat}>
      <M.Typography variant="subtitle2" gutterBottom>
        {label}
      </M.Typography>
      <M.Typography variant="body2" color="textSecondary">
        {children}
      </M.Typography>
    </div>
  )
}

function Header({ product }: { product: DP.DataProduct }) {
  const classes = useStyles()
  const platform = PLATFORM_LABEL[product.binding.kind]
  const summary = [
    platform,
    product.owningEntity?.label,
    pluralize(product.members.length, 'member'),
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className={classes.headerTop}>
      <M.Typography variant="overline" color="textSecondary" className={classes.overline}>
        Data product
      </M.Typography>
      <M.Typography variant="h5">{product.name}</M.Typography>
      <M.Typography variant="body2" color="textSecondary" className={classes.summary}>
        {summary}
      </M.Typography>
    </div>
  )
}

function Tabs({ id, section }: { id: string; section: string }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Tabs value={section} variant="scrollable" scrollButtons="auto">
      <NavTab
        className={classes.tab}
        label="Overview"
        value="overview"
        to={urls.dataProduct(id)}
      />
      <NavTab
        className={classes.tab}
        label="Contents"
        value="contents"
        to={urls.dataProductContents(id)}
      />
      <NavTab
        className={classes.tab}
        label="Access"
        value="access"
        to={urls.dataProductAccess(id)}
      />
    </M.Tabs>
  )
}

/**
 * Overview: what the catalog says about the product, plus stats.
 *
 * Every stat here is capability-gated rather than universal. Curation is the
 * clearest case: only Unity has a curation primitive, so on the other two the
 * field is absent rather than empty -- rendering "—" would read as "not
 * certified" when the truth is "this catalog has no such concept".
 */
function OverviewTab({ product }: { product: DP.DataProduct }) {
  const classes = useStyles()
  const caps = DP.CAPABILITIES[product.binding.kind]
  const platform = PLATFORM_LABEL[product.binding.kind]
  const readable = product.members.filter((m) => m.readable).length

  return (
    <M.Paper className={classes.infoCard}>
      {product.description ? (
        <M.Typography variant="body1">{product.description}</M.Typography>
      ) : (
        <M.Typography color="textSecondary">
          No description for this data product
        </M.Typography>
      )}

      <Stat label="Defined in">{platform}</Stat>

      {/* DataZone has no per-product owner API (ListEntityOwners takes
          DOMAIN_UNIT only), so a human name would be a derivation from project
          memberships. Say which it is rather than presenting one as the other. */}
      {product.owningEntity && (
        <Stat
          label={product.owningEntity.kind === 'PROJECT' ? 'Owning project' : 'Owner'}
        >
          {product.owningEntity.label}
          {product.owningEntity.derived && ' (derived)'}
        </Stat>
      )}

      <Stat label="Members">
        {product.members.length
          ? `${pluralize(product.members.length, 'member')} · ${readable} readable by you`
          : 'Contents not visible to you'}
      </Stat>

      {caps.curationStatus && (
        <Stat label="Curation">
          {product.curationStatus ? (
            <M.Chip
              label={product.curationStatus}
              size="small"
              color={product.curationStatus === 'certified' ? 'primary' : 'default'}
            />
          ) : (
            'Not set'
          )}
        </Stat>
      )}

      {/* No platform emits product-level change events -- DataZone's 36
          EventBridge detail-types include none for data products, and Unity has
          no webhooks at all. So this is "last checked", never live sync. */}
      <Stat label="Last checked">
        <M.Tooltip arrow title={product.fetchedAt.toLocaleString()}>
          <span>
            <Format.Relative value={product.fetchedAt} />
          </span>
        </M.Tooltip>
        {' · composition can change without notice'}
      </Stat>
    </M.Paper>
  )
}

/**
 * Contents, grouped by where they come from.
 *
 * The grouping is the point, not styling. A product's contents arrive from two
 * sources with *different governance guarantees*: catalog-enumerated members are
 * subject to the catalog's row and column rules, while files identified only by
 * a bucket ARN are listed by Quilt directly -- outside those rules entirely.
 * One undifferentiated list would imply a uniform guarantee that does not exist.
 */
function ContentsTab({ product }: { product: DP.DataProduct }) {
  const classes = useStyles()
  const caps = DP.CAPABILITIES[product.binding.kind]
  const platform = PLATFORM_LABEL[product.binding.kind]

  if (!product.members.length) {
    return (
      <M.Paper className={classes.infoCard}>
        <M.Typography variant="body2" color="textSecondary">
          You can see this product but not its contents. That is a permission boundary,
          not an empty product — request access to list what it holds.
        </M.Typography>
      </M.Paper>
    )
  }

  const governed = product.members.filter((m) => m.contentsSource === 'CATALOG')
  const direct = product.members.filter((m) => m.contentsSource === 'DIRECT_S3')
  const unavailable = product.members.filter((m) => m.contentsSource === 'UNAVAILABLE')

  const renderTable = (members: DP.Member[]) => (
    <M.Table size="small">
      <M.TableHead>
        <M.TableRow>
          <M.TableCell>Name</M.TableCell>
          <M.TableCell>Kind</M.TableCell>
          <M.TableCell>Schema</M.TableCell>
          <M.TableCell>Access</M.TableCell>
        </M.TableRow>
      </M.TableHead>
      <M.TableBody>
        {members.map((m) => (
          <M.TableRow key={m.logicalName}>
            <M.TableCell>{m.logicalName}</M.TableCell>
            <M.TableCell>{m.kind}</M.TableCell>
            <M.TableCell>
              {/* A null schema is three different facts depending on platform,
                  so it is never rendered as "no columns". Filesets have none by
                  nature; DataZone hides tabular columns in an opaque forms
                  string. */}
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
        ))}
      </M.TableBody>
    </M.Table>
  )

  return (
    <M.Paper className={classes.infoCard}>
      {!!governed.length && (
        <>
          <M.Typography variant="body2" color="textSecondary">
            Enumerated and governed by {platform}. Row and column rules may apply to what
            you see.
          </M.Typography>
          {renderTable(governed)}
        </>
      )}

      {!!direct.length && (
        <div className={classes.section}>
          <M.Typography variant="subtitle2">Files listed from S3</M.Typography>
          {/* The honest disclosure. The catalog gave us only a bucket ARN for
              these, so Quilt enumerates S3 itself and the catalog's governance
              does not cover what is shown. A reader deserves to know the
              difference between "the catalog vetted this" and "we listed the
              bucket". */}
          <M.Typography variant="body2" color="textSecondary">
            {platform} identifies these by location only, so Quilt lists them from S3
            directly. The catalog's row and column rules do not apply to this listing.
          </M.Typography>
          {renderTable(direct)}
        </div>
      )}

      {!!unavailable.length && (
        <M.Typography className={classes.note} variant="body2" color="textSecondary">
          {unavailable.length} member{unavailable.length === 1 ? '' : 's'} could not be
          listed from this catalog.
        </M.Typography>
      )}
    </M.Paper>
  )
}

/**
 * Access: grants, and deliberately not a verdict.
 *
 * `listGrants` is honest on all three platforms; "can Alice read this" is not --
 * unknowable in principle, because row-policy bodies can call external
 * functions. See `Capabilities.effectiveAccessForNamedUser`, typed as literal
 * `false` so adding a verdict here is a compile error.
 */
function AccessTab({ product }: { product: DP.DataProduct }) {
  const classes = useStyles()
  const caps = DP.CAPABILITIES[product.binding.kind]
  const showOrigin = caps.effectivePermissions

  return (
    <>
      <M.Paper className={classes.infoCard}>
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
            privilege-filtered -- APPLY/OWNERSHIP on the policy AND OWNERSHIP on
            the table, with SELECT explicitly not enough -- so a negative means
            "not visible to us", never "no policy exists". Rendering absence as a
            guarantee would be a false assurance about data protection. */}
        {product.policyFlags.rowLevel === 'PRESENT' && (
          <M.Typography className={classes.note} variant="body2" color="textSecondary">
            Row-level rules are in force on this product, so the rows any given person
            sees may be narrower than the grants above suggest.
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
      </M.Paper>

      {/* Separate card from the grants table on purpose: that one is who holds
          access now, this is who asked and what happened. Merging them would put
          a revoked-but-still-granted request in a grants table, where it would
          read as a live grant. */}
      <M.Paper className={classes.infoCard} style={{ marginTop: 24 }}>
        <div className={classes.sectionHead}>
          <M.Typography variant="h6">Access requests</M.Typography>
        </div>
        <Requests product={product} />
      </M.Paper>
    </>
  )
}

/** Which section the URL names. Overview is the bare product route. */
function useSection(): string {
  const { pathname } = useLocation()
  if (pathname.endsWith('/contents')) return 'contents'
  if (pathname.endsWith('/access')) return 'access'
  return 'overview'
}

export default function Detail() {
  const { paths, urls } = NamedRoutes.use()
  const { dataProductId } = useParams<{ dataProductId: string }>()
  const section = useSection()
  // Exact inverse of the `encodeURIComponent` in the route's url builder — see
  // the note on `dataProduct` in constants/routes.ts for why it is not `encode`
  // from utils/s3paths.
  const id = decodeURIComponent(dataProductId)

  const product = DP.useProduct(id)

  // A synthesized id is not stable across renames — on Unity a schema rename
  // silently changes it and emits no event — so a miss is expected drift, not
  // necessarily a bad URL. Back to the list rather than a 404 dead end.
  if (!product) return <Redirect to={urls.dataProducts()} />

  return (
    <>
      <Header product={product} />
      <Tabs id={id} section={section} />
      <Switch>
        <Route path={paths.dataProductContents} exact>
          <ContentsTab product={product} />
        </Route>
        <Route path={paths.dataProductAccess} exact>
          <AccessTab product={product} />
        </Route>
        <Route>
          <OverviewTab product={product} />
        </Route>
      </Switch>
    </>
  )
}
