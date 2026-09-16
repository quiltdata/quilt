import * as React from 'react'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as W from 'model/DataProducts/writes'

import { StateLine, WriteResult } from './FixtureNotice'

/**
 * The publisher's decisions, and the record of them.
 *
 * Three regions, in the order a publisher needs them: what is published, what is
 * waiting, and who holds what.
 *
 * Two rules this screen exists to keep:
 *
 * - **Unpublish and revoke are two acts in two places** (screen rule R2).
 *   Unpublish removes the listing; it does not touch a holding or a grant. The
 *   confirmation copy says so, because an unpublish that promised subscribers lose
 *   access would be teaching the opposite of DEC-42.
 * - **A revoke is not an ending inside the TTL.** The TTL is the revocation
 *   granularity, so the copy says credentials already minted keep working until they
 *   expire, and never "access removed".
 *
 * Both tables read the **exchange record** joined to the grant read-back, never
 * another workspace's `holdings` rows -- a workspace reads only its own slice
 * (DEC-52). The model layer enforces that: a non-owner's projection has these
 * fields as `null`, so this screen cannot be given data it should not have.
 */

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3),
  },
  section: {
    marginTop: t.spacing(4),
  },
  head: {
    marginBottom: t.spacing(1),
  },
  actions: {
    display: 'flex',
    gap: t.spacing(1),
  },
}))

/**
 * The published region.
 *
 * The one act, with the consequence stated under it rather than in a dialog that
 * appears after the decision to click has been made.
 */
function Published({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()
  const publishing = W.usePublishing()

  const pub = W.useAct(publishing, (p) => p.publish(product.id))
  const unpub = W.useAct(publishing, (p) => p.unpublish(product.id))

  return (
    <section>
      <M.Typography variant="h6" className={classes.head}>
        Published
      </M.Typography>
      <M.Typography variant="body2" color="textSecondary">
        {product.published
          ? `Published to the stack since ${product.published.publishedAt.toLocaleDateString()}.`
          : 'Unpublished. Nothing is listed, so no workspace can request this product.'}
      </M.Typography>
      <M.Box mt={2} className={classes.actions}>
        {product.published ? (
          <M.Button
            variant="outlined"
            disabled={unpub.pending}
            onClick={() => unpub.call()}
          >
            Unpublish
          </M.Button>
        ) : (
          <M.Button
            variant="contained"
            color="primary"
            disabled={pub.pending}
            onClick={() => pub.call()}
          >
            Publish to the stack
          </M.Button>
        )}
      </M.Box>
      {product.published && (
        <M.Box mt={1}>
          <M.Typography variant="caption" color="textSecondary">
            Unpublishing removes the listing. Workspaces already approved keep their
            access; to remove access, revoke below.
          </M.Typography>
        </M.Box>
      )}
      <WriteResult result={pub.result} />
      <WriteResult result={unpub.result} />
    </section>
  )
}

/**
 * One row of the queue.
 *
 * An approval recorded as failed stays here with its failure line and a retry --
 * the same mutation, not a separate verb (P9a). It must never look like success and
 * must never vanish: that is Fig. 5's `else` branch as a row state rather than a
 * toast.
 */
function RequestRow({ sub }: { sub: DP.Subscription }) {
  const classes = useStyles()
  const publishing = W.usePublishing()
  const [reason, setReason] = React.useState('')
  const [rejecting, setRejecting] = React.useState(false)

  const app = W.useAct(publishing, (p) => p.approve(sub.id))
  const rej = W.useAct(publishing, (p) => p.reject(sub.id, reason))

  const state = DP.deriveState(sub, 'publisher')
  const copy = DP.stateCopy(sub, 'publisher')

  return (
    <M.TableRow data-testid="dp-request-row" data-state={state}>
      <M.TableCell>{sub.subscriber.name}</M.TableCell>
      <M.TableCell>{sub.requestedBy}</M.TableCell>
      <M.TableCell>{sub.requestedAt.toLocaleDateString()}</M.TableCell>
      <M.TableCell>
        <StateLine copy={copy} />
        <M.Box mt={1} className={classes.actions}>
          <M.Button
            size="small"
            variant="outlined"
            disabled={app.pending}
            onClick={() => app.call()}
          >
            {/* The retry is the same mutation on the same id -- there is no separate
                retry verb, so the label changes and the act does not. */}
            {state === 'APPROVAL_FAILED' ? 'Retry approval' : 'Approve'}
          </M.Button>
          {rejecting ? (
            <>
              <M.TextField
                size="small"
                placeholder="Reason (shown to the requester)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <M.Button size="small" disabled={rej.pending} onClick={() => rej.call()}>
                Confirm reject
              </M.Button>
            </>
          ) : (
            <M.Button size="small" onClick={() => setRejecting(true)}>
              Reject
            </M.Button>
          )}
        </M.Box>
        <M.Box mt={1}>
          <M.Typography variant="caption" color="textSecondary">
            Approving grants workspace {sub.subscriber.name} read access. Every member of{' '}
            {sub.subscriber.name} will be able to read it.
          </M.Typography>
        </M.Box>
        <WriteResult result={app.result} />
        <WriteResult result={rej.result} />
      </M.TableCell>
    </M.TableRow>
  )
}

/** One row of the subscriber list, with its derived state and the grant evidence. */
function SubscriberRow({ sub }: { sub: DP.Subscription }) {
  const classes = useStyles()
  const publishing = W.usePublishing()

  const rev = W.useAct(publishing, (p) => p.revoke(sub.id))

  const state = DP.deriveState(sub, 'publisher')
  const copy = DP.stateCopy(sub, 'publisher')
  // Revoke is offered wherever the grant may still be live -- which is every state
  // whose read-back is not a confirmed ABSENT, not only the two agreeing ones. An
  // earlier version covered APPROVED and REVOKE_FAILED alone, so
  // REJECTED_GRANT_PRESENT and UNKNOWN showed an amber warning with no remedy on
  // the one screen that carries revoke: the publisher was told a grant might be
  // live and given nothing to do about it.
  const revocable = state === 'APPROVED' || DP.isDisagreement(state)

  return (
    <M.TableRow data-testid="dp-subscriber-row" data-state={state}>
      <M.TableCell>{sub.subscriber.name}</M.TableCell>
      <M.TableCell>
        <StateLine copy={copy} />
      </M.TableCell>
      <M.TableCell>
        {/* The read-back as evidence, not as a verdict: PRESENT / ABSENT / UNREAD,
            with the time it was read. */}
        {sub.grant.status.toLowerCase()} at {sub.grant.at.toLocaleString()}
      </M.TableCell>
      <M.TableCell>
        {revocable && (
          <>
            <M.Box className={classes.actions}>
              <M.Button
                size="small"
                variant="outlined"
                disabled={rev.pending}
                onClick={() => rev.call()}
              >
                {state === 'REVOKE_FAILED' ? 'Retry revoke' : 'Revoke'}
              </M.Button>
            </M.Box>
            <M.Box mt={1}>
              <M.Typography variant="caption" color="textSecondary">
                Revoking removes {sub.subscriber.name}&apos;s grant. Credentials{' '}
                {sub.subscriber.name} minted before now keep working until they expire.
              </M.Typography>
            </M.Box>
          </>
        )}
        <WriteResult result={rev.result} />
      </M.TableCell>
    </M.TableRow>
  )
}

export default function Sharing({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()

  // `null` means this workspace does not own the product, so the registry never
  // handed over the queue. Rendered as an absence of standing rather than as an
  // empty queue, which would read as "no requests".
  if (product.requests === null || product.subscribers === null) {
    return (
      <div className={classes.root}>
        <M.Typography variant="body2" color="textSecondary">
          Only the publishing workspace can see this product&apos;s requests and
          subscribers.
        </M.Typography>
      </div>
    )
  }

  return (
    <div className={classes.root} data-testid="dp-sharing">
      <Published product={product} />

      <section className={classes.section}>
        <M.Typography variant="h6" className={classes.head}>
          Requests
        </M.Typography>
        {product.requests.length === 0 ? (
          <M.Typography variant="body2" color="textSecondary">
            No workspace has requested this product.
            {!product.published &&
              ' This product is unpublished, so it cannot receive requests.'}
          </M.Typography>
        ) : (
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell>Workspace</M.TableCell>
                <M.TableCell>Requested by</M.TableCell>
                <M.TableCell>At</M.TableCell>
                <M.TableCell>State and acts</M.TableCell>
              </M.TableRow>
            </M.TableHead>
            <M.TableBody>
              {product.requests.map((s) => (
                <RequestRow key={s.id} sub={s} />
              ))}
            </M.TableBody>
          </M.Table>
        )}
      </section>

      <section className={classes.section}>
        <M.Typography variant="h6" className={classes.head}>
          Subscribers
        </M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          Read from the exchange record and the grant read-back. Grants land on
          workspaces, never on people.
        </M.Typography>
        {product.subscribers.length === 0 ? (
          <M.Box mt={1}>
            <M.Typography variant="body2" color="textSecondary">
              No workspace holds this product.
            </M.Typography>
          </M.Box>
        ) : (
          <M.Table size="small">
            <M.TableHead>
              <M.TableRow>
                <M.TableCell>Workspace</M.TableCell>
                <M.TableCell>State</M.TableCell>
                <M.TableCell>Grant read-back</M.TableCell>
                <M.TableCell>Acts</M.TableCell>
              </M.TableRow>
            </M.TableHead>
            <M.TableBody>
              {product.subscribers.map((s) => (
                <SubscriberRow key={s.id} sub={s} />
              ))}
            </M.TableBody>
          </M.Table>
        )}
      </section>
    </div>
  )
}
