import * as React from 'react'
import * as redux from 'react-redux'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import { authenticated } from 'containers/Auth/selectors'
import { useFeature } from 'utils/features'
import * as NamedRoutes from 'utils/NamedRoutes'

import { isEarned, type Badge } from './badges'
import Medallion from './Medallion'
import { ShareButton } from './ShareMenu'
import useMilestones from './useMilestones'

const DISMISSED_KEY = 'quilt.milestones.dismissed'

// Per browser, not per account: dismissal is a viewer convenience, and losing it
// (private window, cleared storage) only brings the ribbon back.
function readDismissed(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function writeDismissed(ids: string[]) {
  try {
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids))
  } catch {
    // Storage blocked: the ribbon hides for this page view only.
  }
}

/** Newest first; count tiers carry no date and sort after dated badges. */
const byRecency = (a: Badge, b: Badge) => {
  const at = (x: Badge) => (x.state.kind === 'earned' && x.state.at?.getTime()) || 0
  return at(b) - at(a)
}

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: t.palette.background.paper,
    borderTop: `1px solid ${t.palette.divider}`,
    bottom: 0,
    display: 'flex',
    gap: t.spacing(1.5),
    padding: t.spacing(1, 2),
    paddingBottom: `max(${t.spacing(1)}px, env(safe-area-inset-bottom))`,
    position: 'sticky',
    zIndex: t.zIndex.appBar - 1,
  },
  text: {
    flexGrow: 1,
    minWidth: 0,
  },
  more: {
    color: t.palette.text.secondary,
  },
}))

function RibbonBar({ badges }: { badges: Badge[] }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const [dismissed, setDismissed] = React.useState(readDismissed)
  const fresh = badges
    .filter((b) => isEarned(b) && !dismissed.includes(b.id))
    .sort(byRecency)
  const dismiss = React.useCallback(() => {
    const ids = [...dismissed, ...fresh.map((b) => b.id)]
    writeDismissed(ids)
    setDismissed(ids)
  }, [dismissed, fresh])

  const newest = fresh[0]
  if (!newest) return null

  return (
    <aside aria-label="Milestones reached" className={classes.root}>
      <Medallion icon={newest.icon} state="earned" size={32} />
      <M.Typography variant="body2" className={classes.text} noWrap>
        <b>Milestone reached:</b> {newest.title}
        {fresh.length > 1 && (
          <span className={classes.more}> and {fresh.length - 1} more</span>
        )}
      </M.Typography>
      <ShareButton badge={newest} />
      <M.Button component={Link} to={urls.milestones(newest.id)} size="small">
        View
      </M.Button>
      <M.IconButton aria-label="Dismiss milestones" onClick={dismiss} size="small">
        <M.Icon fontSize="small">close</M.Icon>
      </M.IconButton>
    </aside>
  )
}

function SignedInRibbon() {
  const badges = useMilestones()
  return badges ? <RibbonBar badges={badges} /> : null
}

function FlaggedRibbon() {
  return useFeature('product-badges') ? <SignedInRibbon /> : null
}

/** Earned milestones the viewer hasn't dismissed, along the bottom of every page. */
export default function Ribbon() {
  const signedIn = redux.useSelector(authenticated)
  if (!signedIn) return null
  // `useFeature` suspends on a cold settings read; nothing to show meanwhile.
  return (
    <React.Suspense fallback={null}>
      <FlaggedRibbon />
    </React.Suspense>
  )
}
