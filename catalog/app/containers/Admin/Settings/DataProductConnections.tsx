import * as React from 'react'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'

// Where an admin points Quilt at an external catalog. Deliberately a mock: no
// mutation is wired, because the resolvers behind
// `Mutation.admin.dataProducts.connectionAdd` do not exist yet. Every control
// that would write is disabled with the reason stated, which is the honest
// version of a screen that cannot yet save -- a live-looking Save button that
// silently dropped a connection would be worse than none.
//
// What it *does* do is the part that has to be designed regardless of backend:
// show that the three platforms authenticate differently, and that one of them
// has no OAuth path at all. That asymmetry is the edge worth understanding now.

const useStyles = M.makeStyles((t) => ({
  row: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: t.spacing(2),
    padding: t.spacing(2, 0),
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  endpoint: {
    fontFamily: (t.typography as $TSFixMe).monospace.fontFamily,
    fontSize: '0.75rem',
  },
  note: {
    marginTop: t.spacing(0.5),
  },
  // The failing state is loud on purpose: an admin scanning this list needs the
  // broken connection to be the thing they notice.
  errorNote: {
    borderLeft: `3px solid ${t.palette.error.main}`,
    marginTop: t.spacing(1),
    padding: t.spacing(0.5, 1.5),
  },
  unverifiedNote: {
    borderLeft: `3px solid ${t.palette.warning.main}`,
    marginTop: t.spacing(1),
    padding: t.spacing(0.5, 1.5),
  },
  actions: {
    display: 'flex',
    gap: t.spacing(1),
    marginTop: t.spacing(2),
  },
  form: {
    display: 'grid',
    gap: t.spacing(2),
    marginTop: t.spacing(1),
  },
  methodNote: {
    marginTop: t.spacing(1),
  },
}))

// The picker offers both Unity bindings as separate choices, and the reader-facing
// name is the same vendor for both -- so it alone distinguishes them. Derived from
// the shared table rather than restated, so a new platform cannot reach this
// dropdown unlabelled.
const PICKER_LABEL: Record<DP.PlatformKind, string> = {
  ...DP.PLATFORM_LABEL,
  'unity-share': 'Databricks Unity (Delta Sharing)',
}

const STATE_LABEL: Record<DP.ConnectionState, string> = {
  READY: 'Connected',
  UNVERIFIED: 'Not verified',
  ERROR: 'Failing',
}

function ConnectionRow({ connection }: { connection: DP.Connection }) {
  const classes = useStyles()
  const methods = DP.AUTH_METHODS[connection.platform]
  const method = methods.find((m) => m.method === connection.authMethod)

  return (
    <div className={classes.row}>
      <div className={classes.rowBody}>
        <M.Typography variant="subtitle2">
          {connection.title} · {PICKER_LABEL[connection.platform]}
        </M.Typography>
        <M.Typography className={classes.endpoint} color="textSecondary">
          {connection.endpoint}
        </M.Typography>
        <M.Typography className={classes.note} variant="body2" color="textSecondary">
          {method?.label ?? connection.authMethod}
          {/* A pointer, never a value. Shown so an admin can confirm *which*
              secret is wired without the catalog ever reading it. */}
          {connection.secretRef && ' · credential stored outside Quilt'}
        </M.Typography>

        {connection.state === 'ERROR' && (
          <div className={classes.errorNote}>
            <M.Typography variant="body2">{DP.stateSummary(connection)}</M.Typography>
          </div>
        )}
        {/* Never-checked is not a quiet state: products will not load, and an
            empty product list would read as "this catalog has none". */}
        {connection.state === 'UNVERIFIED' && (
          <div className={classes.unverifiedNote}>
            <M.Typography variant="body2">{DP.stateSummary(connection)}</M.Typography>
          </div>
        )}
        {connection.state === 'READY' && (
          <M.Typography className={classes.note} variant="caption" color="textSecondary">
            {DP.stateSummary(connection)}
          </M.Typography>
        )}
      </div>

      <M.Tooltip title="Checking a connection needs the resolver, which is not wired up yet.">
        <span>
          <M.Button size="small" variant="outlined" disabled>
            Check
          </M.Button>
        </span>
      </M.Tooltip>
    </div>
  )
}

/**
 * The add form, showing what each platform can actually be authenticated with.
 *
 * The auth-method list is per-platform because the platforms genuinely differ:
 * pick DataZone and there is exactly one option and no OAuth at all. A single
 * uniform "Connect with OAuth" button would be inventing a capability for two of
 * the three.
 */
function AddConnection({ onClose }: { onClose: () => void }) {
  const classes = useStyles()
  const [platform, setPlatform] = React.useState<DP.PlatformKind>('unity-schema')
  const methods = DP.AUTH_METHODS[platform]
  const [method, setMethod] = React.useState<DP.AuthMethod>(methods[0].method)

  // Changing platform can strand a method the new platform does not offer (pick
  // Databricks + OAUTH_U2M, switch to DataZone). Reset rather than submit
  // something the platform cannot honor.
  const handlePlatform = (kind: DP.PlatformKind) => {
    setPlatform(kind)
    setMethod(DP.AUTH_METHODS[kind][0].method)
  }

  const selected = methods.find((m) => m.method === method) ?? methods[0]
  const browserSignIn = selected.method === 'OAUTH_U2M'

  return (
    <div className={classes.form}>
      <M.TextField
        select
        label="Catalog"
        value={platform}
        onChange={(e) => handlePlatform(e.target.value as DP.PlatformKind)}
        size="small"
        // MUI v4's `select` renders a hidden input the label is not associated
        // with, so a testid on the visible trigger is the stable handle.
        SelectProps={{ 'data-testid': 'dpc-platform' } as $TSFixMe}
      >
        {(Object.keys(PICKER_LABEL) as DP.PlatformKind[]).map((k) => (
          <M.MenuItem key={k} value={k}>
            {PICKER_LABEL[k]}
          </M.MenuItem>
        ))}
      </M.TextField>

      <M.TextField
        label="Endpoint"
        placeholder={
          platform === 'datazone'
            ? 'dzd_xxxxxxxx'
            : platform === 'snowflake-listing'
              ? 'account.region.snowflakecomputing.com'
              : 'https://workspace.cloud.databricks.com'
        }
        size="small"
        helperText="Domain id, workspace host, or account locator, depending on the catalog."
      />

      <M.TextField
        select
        label="Authentication"
        value={method}
        onChange={(e) => setMethod(e.target.value as DP.AuthMethod)}
        size="small"
      >
        {methods.map((m) => (
          <M.MenuItem key={m.method} value={m.method}>
            {m.label}
          </M.MenuItem>
        ))}
      </M.TextField>

      {/* The note says why a method is or is not on offer. An admin who cannot
          find an OAuth button for DataZone deserves to know that is the
          platform, not a missing Quilt feature. */}
      <div>
        <M.Typography variant="body2" color="textSecondary">
          {selected.note}
        </M.Typography>
        <M.Typography
          className={classes.methodNote}
          variant="caption"
          color="textSecondary"
        >
          Needs: {selected.requires}
        </M.Typography>
      </div>

      {/* Only rendered where the platform documents a browser flow, so the
          screen never offers a sign-in that cannot exist. */}
      {browserSignIn ? (
        <div>
          <M.Tooltip title="The OAuth redirect needs a server-side token exchange, which is not built yet.">
            <span>
              <M.Button variant="contained" color="primary" disabled>
                Sign in with Databricks
              </M.Button>
            </span>
          </M.Tooltip>
          <M.Typography
            className={classes.methodNote}
            variant="caption"
            color="textSecondary"
            component="p"
          >
            Would redirect to Databricks and come back with an authorization code. Quilt
            never stores the resulting token in the browser — the exchange happens
            server-side, which is the part that does not exist yet.
          </M.Typography>
        </div>
      ) : (
        <M.TextField
          label="Credential reference"
          placeholder="arn:aws:secretsmanager:…"
          size="small"
          helperText="A pointer to where the secret lives. Quilt stores the reference, never the secret."
        />
      )}

      <div className={classes.actions}>
        <M.Button onClick={onClose} size="small">
          Cancel
        </M.Button>
        <M.Tooltip title="Saving needs the connectionAdd resolver, which is not wired up yet.">
          <span>
            <M.Button size="small" variant="contained" color="primary" disabled>
              Add connection
            </M.Button>
          </span>
        </M.Tooltip>
      </div>
    </div>
  )
}

export default function DataProductConnections() {
  const classes = useStyles()
  const [adding, setAdding] = React.useState(false)
  // Through the port, not `DP.fixtures`: this list reports live integration
  // status, so reading fixtures directly would keep showing three invented
  // connections -- one of them a fabricated auth failure -- as the operator's own
  // once a real adapter lands. Fixture-backed today only because that is what the
  // adapter resolves to; `Query.dataProductConnections` has no resolver yet.
  const connections = DP.useConnections()

  return (
    <>
      <M.Typography variant="body2" color="textSecondary">
        Data products are defined in these catalogs. Quilt reads them; each catalog keeps
        every access decision.
      </M.Typography>

      {connections.map((c, i) => (
        <React.Fragment key={c.id}>
          {i > 0 && <M.Divider />}
          <ConnectionRow connection={c} />
        </React.Fragment>
      ))}

      {adding ? (
        <AddConnection onClose={() => setAdding(false)} />
      ) : (
        <div className={classes.actions}>
          <M.Button size="small" variant="outlined" onClick={() => setAdding(true)}>
            Add a catalog
          </M.Button>
        </div>
      )}
    </>
  )
}

/** So `Settings` can hide the card where the capability is off, as it does for features. */
export { STATE_LABEL }
