import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as NamedRoutes from 'utils/NamedRoutes'

import { StateLine } from './FixtureNotice'

/**
 * A product's Files tab.
 *
 * **This renders a state, not a tree.** Reading a product means asking the
 * registry to mint short-lived credentials against a capture and then reading
 * through the proxy as any S3 client does. This stack serves no mint, and which
 * session the catalog may present to one is itself unanswered (UNK-C2) -- so there
 * is nothing to list.
 *
 * The two tempting alternatives are both worse than a state:
 *
 * - A **fixture tree** would put invented bytes behind a real-looking file
 *   browser, with sizes and hashes that attest nothing. It is the one lie on this
 *   surface whose cost is measured in somebody's afternoon.
 * - An **S3 fallback** -- reading the objects with the workspace's own S3 session
 *   where it happens to reach them -- is forbidden outright: the direct-access path
 *   is outside the data-product boundary, and the catalog never reads a product's
 *   objects any other way (model.md §Reading a product, step 6; screen rule R3).
 *
 * So the tab explains what a mint would do, what it would and would not prove, and
 * re-reads the subscription state beside it. The refusal renderings below are
 * written even though nothing can produce them yet, because they are the states
 * this screen exists to get right, and a branch nothing renders is a branch that
 * rots.
 */

const useStyles = M.makeStyles((t) => ({
  panel: {
    padding: t.spacing(3),
  },
  section: {
    marginTop: t.spacing(2),
  },
}))

/**
 * What a refused mint says.
 *
 * The cause is rendered in the mint's words and **not translated into a lifecycle
 * claim**: *no grant* is not "you are not subscribed", because a grant can be
 * missing after an approval. The derived state is re-read and shown beside it, so
 * the reader sees both facts rather than one dressed as the other.
 */
export function MintRefusal({
  cause,
  product,
}: {
  cause: DP.MintRefusalCause
  product: DP.ProductVolume
}) {
  const classes = useStyles()
  const copy = DP.MINT_REFUSALS[cause]
  const sub = product.holding?.subscription
  return (
    <div data-testid="dp-mint-refused">
      <M.Typography variant="subtitle2">Minting was refused: {copy.label}</M.Typography>
      <M.Typography variant="body2" color="textSecondary">
        {copy.body}
      </M.Typography>
      {sub && (
        <div className={classes.section}>
          <M.Typography variant="caption" color="textSecondary" display="block">
            Your subscription, re-read just now:
          </M.Typography>
          <StateLine copy={DP.stateCopy(sub, 'subscriber')} />
        </div>
      )}
    </div>
  )
}

export default function Files({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const workspace = DP.useActiveWorkspace()
  const adapter = DP.useAdapter()

  const sub = product.holding?.subscription
  const state = sub ? DP.deriveState(sub, 'subscriber') : null
  const isOwner = product.holding?.role === 'OWNER'

  // Offered only where a grant is confirmed present, or to the owner. Not from a
  // listing, a holding or a decision -- those are three different facts and none
  // of them is entitlement (screen rule R4).
  const mayAttempt = isOwner || (state !== null && DP.grantIsPresent(state))

  if (!mayAttempt) {
    return (
      <div className={classes.panel} data-testid="dp-files-no-grant">
        <M.Typography variant="subtitle2">
          Files are not available to this workspace
        </M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          {state
            ? 'Your subscription does not carry a confirmed grant, so a mint would be refused. The state and its evidence are on Access.'
            : `Workspace ${workspace} has no subscription to this product. A listing is visibility, not access.`}
        </M.Typography>
        <M.Box mt={2}>
          <M.Button
            component={Link}
            to={urls.bucketAccess(product.id)}
            variant="outlined"
          >
            {state ? 'See my access' : 'Request access'}
          </M.Button>
        </M.Box>
      </div>
    )
  }

  if (!DP.supportsMinting(adapter)) {
    const copy = DP.UNAVAILABLE_ACTS.MINT
    return (
      <div className={classes.panel} data-testid="dp-files-mint-unavailable">
        <M.Typography variant="subtitle2">{copy.title}</M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          {copy.body}
        </M.Typography>
        <div className={classes.section}>
          <M.Typography variant="body2" color="textSecondary">
            Once it lands, this tab lists the capture the mint returned — with its{' '}
            <code>minted_at</code>, its entry count and the bounds the drain applied,
            because the listing is a capture rather than live storage. A successful mint
            proves a capture exists; each entry&apos;s bytes are read, or refused, when it
            is opened.
          </M.Typography>
        </div>
        <div className={classes.section}>
          <M.Typography variant="caption" color="textSecondary">
            Which session the catalog may present to the mint is still open (UNK-C2), and
            the catalog does not read a product&apos;s objects any other way.
          </M.Typography>
        </div>
        <M.Box mt={2}>
          <M.Button
            component={Link}
            to={urls.bucketConnect(product.id)}
            variant="outlined"
          >
            How to read it from a client
          </M.Button>
        </M.Box>
      </div>
    )
  }

  // Unreachable on this stack, and written so the branch exists when a mint lands.
  return (
    <div className={classes.panel}>
      <M.Typography variant="body2" color="textSecondary">
        Minting access as workspace {workspace}…
      </M.Typography>
    </div>
  )
}
