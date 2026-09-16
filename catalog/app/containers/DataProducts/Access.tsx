import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as NamedRoutes from 'utils/NamedRoutes'

import { StateLine, WriteResult } from './FixtureNotice'

/**
 * My workspace's standing on this product, and the acts that follow from it.
 *
 * One primary act per state, and the workspace is named on the button, because the
 * grantee is the workspace and a member should not think they are asking for
 * themselves (invariant 2). Every state's copy comes from `stateCopy`, so the
 * disagreements arrive here already rendered as themselves -- this screen does not
 * get to resolve one.
 *
 * What the subscriber is deliberately not shown: a publisher-side approval failure.
 * They see *Pending*, because nothing has happened for them and the cause may name
 * Lake Formation internals. The face split is in `deriveState`, not here.
 */

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3),
  },
  acts: {
    display: 'flex',
    gap: t.spacing(1),
    marginTop: t.spacing(2),
  },
}))

/** What a request does, said before it is made rather than after. */
function RequestNote({ workspace }: { workspace: string }) {
  return (
    <M.Typography variant="body2" color="textSecondary">
      Requests are made as the workspace. If approved, every member of {workspace} can
      read this product.
    </M.Typography>
  )
}

export default function Access({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const workspace = DP.useActiveWorkspace()
  const subscribing = DP.useSubscribing()

  const sub = product.holding?.subscription
  const state = sub ? DP.deriveState(sub, 'subscriber') : null

  const subscribe = React.useCallback(
    () => (subscribing ? subscribing.subscribe(product.id) : Promise.resolve(null)),
    [subscribing, product.id],
  )
  const unsubscribe = React.useCallback(
    () => (subscribing && sub ? subscribing.unsubscribe(sub.id) : Promise.resolve(null)),
    [subscribing, sub],
  )

  const request = DP.useWrite(subscribing ? subscribe : null)
  const leave = DP.useWrite(subscribing && sub ? unsubscribe : null)

  if (product.holding?.role === 'OWNER') {
    return (
      <div className={classes.root}>
        <M.Typography variant="subtitle2">
          Your workspace publishes this product
        </M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          Requests and subscribers are on Sharing.
        </M.Typography>
        <div className={classes.acts}>
          <M.Button
            component={Link}
            to={urls.bucketSharing(product.id)}
            variant="outlined"
          >
            Sharing
          </M.Button>
        </div>
      </div>
    )
  }

  return (
    <div className={classes.root} data-testid="dp-access">
      {!sub || !state ? (
        <>
          <M.Typography variant="subtitle2">
            Workspace {workspace} is not subscribed
          </M.Typography>
          <RequestNote workspace={workspace} />
          <div className={classes.acts}>
            <M.Button
              variant="contained"
              color="primary"
              disabled={request.pending}
              onClick={() => request.call()}
            >
              Request access as {workspace}
            </M.Button>
          </div>
          <WriteResult result={request.result} />
        </>
      ) : (
        <>
          <StateLine copy={DP.stateCopy(sub, 'subscriber')} />

          <div className={classes.acts}>
            {/* Files only where the grant is confirmed present. Not from the
                decision: *approved* means a grant read back, and an approval whose
                grant is missing gets no Files tab (screen rule R4). */}
            {DP.grantIsPresent(state) && (
              <M.Button
                component={Link}
                to={urls.bucketDir(product.id)}
                variant="outlined"
              >
                Open files
              </M.Button>
            )}

            {state === 'PENDING' && (
              <M.Button
                variant="outlined"
                disabled={leave.pending}
                onClick={() => leave.call()}
              >
                Withdraw request
              </M.Button>
            )}

            {(state === 'APPROVED' ||
              state === 'REVOKE_FAILED' ||
              state === 'APPROVED_GRANT_MISSING') && (
              <M.Button
                variant="outlined"
                disabled={leave.pending}
                onClick={() => leave.call()}
              >
                Unsubscribe
              </M.Button>
            )}

            {(state === 'REJECTED' ||
              state === 'REJECTED_GRANT_PRESENT' ||
              state === 'REVOKED') && (
              <M.Button
                variant="outlined"
                disabled={request.pending}
                onClick={() => request.call()}
              >
                Request again as {workspace}
              </M.Button>
            )}

            <M.Button component={Link} to={urls.bucketConnect(product.id)}>
              Connect
            </M.Button>
          </div>

          {state === 'REVOKED' && (
            <M.Box mt={2}>
              {/* The honest remainder. The TTL is the revocation grain, so a
                  revoked subscription is not "cut off" until credentials expire. */}
              <M.Typography variant="body2" color="textSecondary">
                Credentials minted before the revocation keep working until they expire.
              </M.Typography>
            </M.Box>
          )}

          {(state === 'REJECTED' || state === 'REVOKED') && (
            <M.Box mt={1}>
              <M.Typography variant="caption" color="textSecondary">
                Whether a rejected or revoked workspace may request again without the
                publisher clearing the earlier decision is still open (UNK-56).
              </M.Typography>
            </M.Box>
          )}

          {state === 'UNKNOWN' && (
            <M.Box mt={1}>
              <M.Typography variant="caption" color="textSecondary">
                The acts above act on the last confirmed state.
              </M.Typography>
            </M.Box>
          )}

          <WriteResult result={request.result} />
          <WriteResult result={leave.result} />
        </>
      )}
    </div>
  )
}
