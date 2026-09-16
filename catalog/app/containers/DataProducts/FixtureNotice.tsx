import * as React from 'react'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'

/**
 * The label every product-bearing surface carries.
 *
 * **Persistent and not dismissable, on purpose.** Several fixture rows are states
 * that would be alarming read as real -- an approval whose grant did not read
 * back, a revoke that did not take. Presented as an operator's own stack they
 * would send someone to debug Lake Formation. A dismissable notice is dismissed
 * once and then absent for every later visit, which is exactly when the reader has
 * forgotten and the rows look like their own data.
 *
 * It says three things because each is separately load-bearing: the data is
 * sample data (so no row is a fact about this stack), nothing is written to a
 * registry (so no control that looks like a write performed one), and no access is
 * granted (so no approval on screen is a grant anywhere).
 *
 * Rendered as `info` rather than a warning: nothing is wrong. There is no
 * error-red token in the palette and reaching for one would misreport a working
 * prototype as a broken deployment.
 */
const useStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
  },
}))

export default function FixtureNotice() {
  const classes = useStyles()
  // Derived from the adapter rather than hardcoded, so the label cannot outlive
  // the fixtures or, worse, be lost when they are still in use.
  if (!DP.IS_FIXTURE_DATA) return null
  return (
    <M.Paper className={classes.root} variant="outlined" data-testid="dp-fixture-notice">
      <M.Box p={2}>
        <M.Typography variant="subtitle2" gutterBottom>
          Example data
        </M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          Every product, request and decision on this screen is sample data for designing
          the surface. Nothing here is written to a registry, and no access is granted to
          any workspace.
        </M.Typography>
      </M.Box>
    </M.Paper>
  )
}

/**
 * The active-workspace switcher.
 *
 * A workspace is a role and exactly one is active (model.md invariant 9); this
 * exists so that rule can be *seen* rather than asserted. Switching changes the
 * holdings slice, the publisher's queue and the listing's relation column
 * together, and no list ever merges the two.
 *
 * In the real catalog this is `switchRole`, which already exists -- so the switcher
 * is prototype scaffolding, and it says so.
 */
export function WorkspaceSwitcher() {
  const active = DP.useActiveWorkspace()
  const [, force] = React.useReducer((n: number) => n + 1, 0)

  const onChange = React.useCallback(
    (e: React.ChangeEvent<{ value: unknown }>) => {
      DP.setActiveWorkspace(e.target.value as string)
      force()
    },
    [force],
  )

  if (!DP.IS_FIXTURE_DATA) return null

  return (
    <M.Box display="flex" alignItems="center" style={{ gap: 8 }}>
      <M.Typography variant="body2" color="textSecondary">
        Acting as
      </M.Typography>
      <M.Select value={active} onChange={onChange} data-testid="dp-workspace-switcher">
        {DP.WORKSPACES.map((w) => (
          <M.MenuItem key={w} value={w}>
            {w}
          </M.MenuItem>
        ))}
      </M.Select>
    </M.Box>
  )
}

/**
 * The notice a control shows instead of reporting a write that did not happen.
 *
 * Takes an act rather than free text so the copy comes from `UNAVAILABLE_ACTS` and
 * names the unit that will land it. A per-call-site string would drift, and the
 * drift would be toward "something went wrong" -- which is the one reading that is
 * false: nothing was attempted.
 */
export function ActUnavailableNotice({ act }: { act: DP.UnavailableActId }) {
  const copy = DP.UNAVAILABLE_ACTS[act]
  return (
    <M.Box mt={2} data-testid="dp-act-unavailable">
      <M.Typography variant="subtitle2">{copy.title}</M.Typography>
      <M.Typography variant="body2" color="textSecondary">
        {copy.body}
      </M.Typography>
      <M.Typography variant="caption" color="textSecondary">
        Lands with {copy.unit}.
      </M.Typography>
    </M.Box>
  )
}

/**
 * The result of a write the reader triggered.
 *
 * Renders only the failure arms, because on this deployment there are only failure
 * arms -- and the type says so: a success arm would have to be invented. Kept as
 * one component so no screen grows its own interpretation of a write result.
 */
export function WriteResult({ result }: { result: DP.WriteState<object> | null }) {
  if (!result) return null
  if (result.ok) {
    // Unreachable with the fixture adapter, and rendered rather than assumed away
    // so the branch exists the day a registry answers.
    return (
      <M.Box mt={2}>
        <M.Typography variant="body2">Done.</M.Typography>
      </M.Box>
    )
  }
  if (result.reason === 'UNAVAILABLE') return <ActUnavailableNotice act={result.act} />
  return (
    <M.Box mt={2}>
      <M.Typography variant="subtitle2">The registry refused this</M.Typography>
      <M.Typography variant="body2" color="textSecondary">
        {result.arm}: {result.detail}
      </M.Typography>
    </M.Box>
  )
}

/** A state label with its evidence, and an amber mark when the two disagree. */
export function StateLine({ copy }: { copy: DP.StateCopy }) {
  return (
    <div>
      <M.Typography variant="body2" component="span">
        {copy.attention ? `⚠ ${copy.label}` : copy.label}
      </M.Typography>
      <M.Typography variant="caption" color="textSecondary" display="block">
        {copy.detail}
      </M.Typography>
    </div>
  )
}
