import * as React from 'react'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'

const useStyles = M.makeStyles((t) => ({
  note: {
    marginTop: t.spacing(1),
  },
  // The revoke-trap callout. Loud on purpose: it contradicts the status word
  // sitting next to it, and a reader skimming statuses would otherwise take
  // "revoked" at face value.
  warning: {
    borderLeft: `3px solid ${t.palette.warning.main}`,
    marginTop: t.spacing(1),
    padding: t.spacing(1, 1.5),
  },
  actions: {
    marginTop: t.spacing(2),
  },
  reason: {
    marginTop: t.spacing(0.5),
  },
}))

const STATUS_LABEL: Record<DP.RequestStatus, string> = {
  SUBMITTED: 'Submitted',
  PENDING: 'Awaiting decision',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  REVOKED: 'Revoked',
  UNKNOWN: 'Status unknown',
}

/**
 * What an approval actually widens to, in words.
 *
 * Every collective `PrincipalType` gets its own noun rather than collapsing to
 * "group": a Snowflake beneficiary is a role, a DataZone one is a project, and
 * calling either a group would misdescribe who receives the grant. A delegated
 * `USER` is a widening too, but a single-seat one — so it gets no collective
 * noun at all, since "the whole group" would be plainly false for one person.
 *
 * Returns null when the request grants only the requester, which is the case
 * `grantsBeyondRequester` already screens out.
 */
function widening(beneficiary: DP.Beneficiary): string | null {
  switch (beneficiary.type) {
    case 'PROJECT':
      return 'the whole project'
    case 'GROUP':
      return 'the whole group'
    case 'ROLE':
      return 'everyone holding that role'
    case 'RECIPIENT':
      return 'everyone using that share'
    case 'USER':
    case 'SERVICE_PRINCIPAL':
      return null
    default:
      // UNKNOWN: the platform did not say what kind of principal this is, and
      // guessing a noun here would invent a blast radius.
      return 'everyone it covers'
  }
}

/**
 * One request, with whatever the catalog could and could not confirm.
 *
 * The status word alone is never the whole story here, which is why each row
 * carries its own qualifier rather than relying on a colour or a chip.
 */
function RequestRow({
  request,
  product,
}: {
  request: DP.AccessRequest
  product: DP.DataProduct
}) {
  const classes = useStyles()
  const caps = DP.capabilitiesFor(product.binding.kind)
  const platform = DP.PLATFORM_LABEL[product.binding.kind]
  const collective = widening(request.beneficiary)

  return (
    <M.Box paddingY={1.5}>
      <M.Typography variant="subtitle2">
        {STATUS_LABEL[request.status]} · requested by {request.requestedBy}
      </M.Typography>

      <M.Typography className={classes.reason} variant="body2" color="textSecondary">
        {request.reason}
      </M.Typography>

      {/* Blast radius. A DataZone subscription is held by a project, so
          approving one person's request grants everyone in it. Invisible unless
          stated. */}
      {DP.grantsBeyondRequester(request) && (
        <M.Typography className={classes.note} variant="body2" color="textSecondary">
          Approving this grants {request.beneficiary.label}
          {collective ? ` — ${collective}` : ''}, not only {request.requestedBy}.
        </M.Typography>
      )}

      {/* The §5.4 trap. `retainPermissions` on revoke leaves live Lake
          Formation grants behind that the catalog no longer manages, so the
          revocation did not take effect. Never render revoked as terminal. */}
      {DP.accessMayPersistAfterRevoke(request) && (
        <div className={classes.warning}>
          <M.Typography variant="body2">
            {request.retainedPermissions === true
              ? `${platform} stopped managing this subscription but retained the underlying permissions, so access may still be in force.`
              : `Whether this revocation removed the underlying permissions could not be confirmed, so access may still be in force.`}{' '}
            Verify in {platform} before treating it as ended.
          </M.Typography>
        </div>
      )}

      {/* Reconciliation state. Absence of a platform record is the *steady*
          state on Unity, not a sync in progress -- saying "pending sync" would
          promise an update that never arrives. */}
      <M.Typography className={classes.note} variant="caption" color="textSecondary">
        {request.platformRecord
          ? `Last checked against ${platform} ${request.platformRecord.reconciledAt.toLocaleString()}.`
          : caps.enumerableRequests
            ? `Not yet visible in ${platform}.`
            : `${platform} does not expose request status, so Quilt cannot confirm this reached an approver.`}
      </M.Typography>
    </M.Box>
  )
}

/**
 * What requesting access would actually do — stated before it is done.
 *
 * This deliberately does not submit anything. No adapter exists yet, and a
 * button that appeared to file a request while doing nothing would be worse
 * than no button. What it does do is the part that has to be designed
 * regardless of backend: telling a requester who receives the access and
 * whether the platform can ever report back.
 */
function RequestDialog({
  product,
  open,
  onClose,
}: {
  product: DP.DataProduct
  open: boolean
  onClose: () => void
}) {
  const caps = DP.capabilitiesFor(product.binding.kind)
  const platform = DP.PLATFORM_LABEL[product.binding.kind]
  const toProject = product.binding.kind === 'datazone'

  return (
    <M.Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <M.DialogTitle>Request access to {product.name}</M.DialogTitle>
      <M.DialogContent>
        <M.Typography variant="body2" paragraph>
          {platform} owns this product and decides the request. Quilt records it and shows
          you whatever {platform} reports back.
        </M.Typography>

        {/* DataZone grants to a project, so the requester needs to know the
            grant does not land on them individually. */}
        {toProject && (
          <M.Typography variant="body2" color="textSecondary" paragraph>
            {platform} grants access to a project rather than to a person, so an approval
            here covers every member of the project it is granted to.
          </M.Typography>
        )}

        {/* Set the expectation up front where the platform can never answer. */}
        {!caps.enumerableRequests && (
          <M.Typography variant="body2" color="textSecondary" paragraph>
            {platform} does not expose request status to Quilt. Once submitted, this
            request will show as submitted and will not update — follow it up in{' '}
            {platform}.
          </M.Typography>
        )}

        {/* No expiry control, and the reason is said out loud rather than left
            as a missing field: nothing downstream could enforce one. */}
        <M.Typography variant="body2" color="textSecondary">
          Access granted this way has no expiry. No target catalog supports time-bounded
          access, so it stays until somebody revokes it.
        </M.Typography>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
        <M.Tooltip title="Submitting needs the catalog adapter, which is not wired up yet.">
          <span>
            <M.Button color="primary" variant="contained" disabled>
              Submit request
            </M.Button>
          </span>
        </M.Tooltip>
      </M.DialogActions>
    </M.Dialog>
  )
}

/**
 * The delegation surface for one product.
 *
 * The request list is unconditional because the record is Quilt's, not the
 * catalog's — only DataZone can enumerate requests, so a queue that branched on
 * the platform would exist on one installation in three (see
 * `model/DataProducts/requests`). The *initiate* affordance does branch, which
 * is legitimate: two platforms support it.
 */
export default function Requests({ product }: { product: DP.DataProduct }) {
  const classes = useStyles()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const caps = DP.capabilitiesFor(product.binding.kind)
  const requests = DP.useRequests(product.id)

  // Partial access counts. Gating on *nothing* readable would hide the
  // affordance in the commonest real case -- the DataZone product whose manifest
  // table is readable while its assay-outputs fileset is not -- which is
  // precisely when someone wants to ask for more.
  //
  // The two clauses are not redundant: `[].some` is false, so discovery-only
  // access (zero members, Unity BROWSE) needs its own clause or it would show no
  // way to ask for anything.
  const wantsMoreAccess =
    !product.members.length || product.members.some((m) => !m.readable)

  return (
    <>
      {requests.length ? (
        requests.map((r, i) => (
          <React.Fragment key={r.id}>
            {i > 0 && <M.Divider />}
            <RequestRow request={r} product={product} />
          </React.Fragment>
        ))
      ) : (
        <M.Typography variant="body2" color="textSecondary">
          No access requests recorded for this product.
        </M.Typography>
      )}

      {wantsMoreAccess && caps.initiableRequests && (
        <div className={classes.actions}>
          <M.Button variant="outlined" onClick={() => setDialogOpen(true)}>
            Request access
          </M.Button>
        </div>
      )}

      {/* Snowflake has no request flow outside organizational listings, so
          there is nothing to offer and saying why beats an absent control. */}
      {wantsMoreAccess && !caps.initiableRequests && (
        <M.Typography className={classes.note} variant="body2" color="textSecondary">
          {DP.PLATFORM_LABEL[product.binding.kind]} has no request flow Quilt can start
          for this product. Ask a catalog administrator directly.
        </M.Typography>
      )}

      <RequestDialog
        product={product}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  )
}
