import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as W from 'model/DataProducts/writes'
import * as NamedRoutes from 'utils/NamedRoutes'

import { StateLine } from './FixtureNotice'

/**
 * A product's overview: the one screen that is always renderable.
 *
 * Held or merely listed, this reads only the registry -- no mint, no S3, no
 * bucket-existence probe. That is what makes it the safe landing for every
 * product route, including one the workspace has no holding on.
 *
 * The one statement about reading on this screen is the last mint's, and there is
 * no mint on this stack, so there is none. Nothing else here is a readability
 * claim: a listing is visibility, a holding is a relation, a decision is a
 * decision, a grant is entitlement, and a mint is a capture -- four facts, four
 * renderings (model.md invariant 1).
 */

const useStyles = M.makeStyles((t) => ({
  stat: {
    marginTop: t.spacing(2),
  },
  sql: {
    fontFamily: t.typography.monospace.fontFamily,
    fontSize: '0.75rem',
    marginTop: t.spacing(1),
    whiteSpace: 'pre-wrap',
  },
}))

function Stat({ label, children }: React.PropsWithChildren<{ label: string }>) {
  const classes = useStyles()
  return (
    <div className={classes.stat}>
      <M.Typography variant="subtitle2" gutterBottom>
        {label}
      </M.Typography>
      <M.Typography variant="body2" color="textSecondary" component="div">
        {children}
      </M.Typography>
    </div>
  )
}

/**
 * The published line.
 *
 * For a subscriber of an unpublished product it says the listing went and the
 * subscription and grant did not. That sentence is the whole of consequence 7:
 * unpublish removes the listing, not a holding or a grant, and a screen that
 * hid an unpublished product from its subscribers would teach the opposite.
 */
function PublishedLine({ product }: { product: DP.ProductVolume }) {
  const isSubscriber = product.holding?.role === 'SUBSCRIBER'
  if (!product.published) {
    return (
      <Stat label="Publication">
        Unpublished
        {isSubscriber && (
          <>
            {' — '}the listing was withdrawn; your subscription and grant are unchanged.
          </>
        )}
      </Stat>
    )
  }
  return (
    <Stat label="Publication">
      Published to the stack since {product.published.publishedAt.toLocaleDateString()}
    </Stat>
  )
}

export default function Overview({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const workspace = DP.useActiveWorkspace()

  const adapter = W.useAdapter()
  const canMint = DP.supportsMinting(adapter)

  const holdingCopy = DP.holdingSummary(product.holding)
  const state = product.holding?.subscription
    ? DP.deriveState(product.holding.subscription, 'subscriber')
    : null

  return (
    <M.Box p={3}>
      <M.Typography variant="overline" color="textSecondary" display="block">
        Data product · published by {product.owner.name}
      </M.Typography>
      <M.Typography variant="h5">{product.title}</M.Typography>
      {product.description && (
        <M.Typography variant="body2" color="textSecondary">
          {product.description}
        </M.Typography>
      )}

      <PublishedLine product={product} />

      <Stat label="Definition">
        {product.definition.view} · version {product.definition.versionId}
        <br />
        {product.definition.referencedBuckets.length > 0 && (
          <>
            selects from{' '}
            {product.definition.referencedBuckets.map((b) => `s3://${b}`).join(', ')}
          </>
        )}
        {/* Owner-only by default (UNK-C6). Shown where it is available rather than
            hidden behind a tab, because the rule that defines the product is the
            most useful thing on the page for whoever owns it. */}
        {product.definition.sql && (
          <div className={classes.sql}>{product.definition.sql}</div>
        )}
      </Stat>

      <Stat label="Designated">
        by {product.designatedBy} on {product.designatedAt.toLocaleDateString()}
      </Stat>

      <Stat label={`Your workspace (${workspace})`}>
        {holdingCopy ? (
          <StateLine copy={holdingCopy} />
        ) : (
          <>Not subscribed. This product is listed to your workspace; nothing more.</>
        )}
      </Stat>

      {/* The only place a read is spoken of, and there is nothing to say: minting
          is not wired, so no capture exists and none is invented. */}
      <Stat label="Last mint">
        No capture in this session.
        {!canMint && ' Minting is not available on this stack.'}
      </Stat>

      <M.Box mt={3} display="flex" style={{ gap: 8 }}>
        {/* One act follows from the state. Files is offered only where a grant is
            confirmed present -- never from a listing, a holding or a decision
            (screen rule R4), because the tab would mint and fail. */}
        {state && DP.grantIsPresent(state) && (
          <M.Button component={Link} to={urls.bucketDir(product.id)} variant="outlined">
            Open files
          </M.Button>
        )}
        {product.holding?.role === 'OWNER' ? (
          <M.Button
            component={Link}
            to={urls.bucketSharing(product.id)}
            variant="outlined"
          >
            Sharing
          </M.Button>
        ) : (
          <M.Button
            component={Link}
            to={urls.bucketAccess(product.id)}
            variant="outlined"
          >
            {state ? 'My access' : 'Request access'}
          </M.Button>
        )}
        <M.Button component={Link} to={urls.bucketConnect(product.id)}>
          Connect
        </M.Button>
      </M.Box>
    </M.Box>
  )
}
