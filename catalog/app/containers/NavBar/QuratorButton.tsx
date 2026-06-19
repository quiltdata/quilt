import * as React from 'react'
import * as M from '@material-ui/core'

import { Model as AssistantModel } from 'components/Assistant'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: 'rgba(255,255,255,.1)',
    border: '1px solid rgba(255,255,255,.18)',
    borderRadius: 18,
    color: 'rgba(255,255,255,.85)',
    cursor: 'pointer',
    display: 'flex',
    fontSize: 13,
    fontWeight: 500,
    gap: t.spacing(0.75),
    height: 32,
    marginLeft: t.spacing(1),
    padding: t.spacing(0, 1.5),
    transition: 'background .2s, border-color .2s',
    userSelect: 'none',
    '&:hover': {
      background: 'rgba(255,255,255,.18)',
      borderColor: 'rgba(255,255,255,.3)',
    },
  },
  icon: {
    fontSize: 18,
  },
}))

// Navbar trigger for Qurator. Replaces the floating bottom-right FAB when
// FrontDoor v2 is enabled, while preserving the existing assistant drawer and
// state model (it only calls the same `show` action the FAB used).
export default function QuratorButton() {
  const classes = useStyles()
  const api = AssistantModel.useAssistantAPI()

  // Respect Qurator availability/permissions exactly as the FAB did: render
  // nothing when the assistant is disabled for this user/stack.
  if (!api) return null

  return (
    <M.Tooltip title="Ask Qurator">
      <button
        aria-label="Open Qurator"
        className={classes.root}
        onClick={api.show}
        type="button"
      >
        <M.Icon className={classes.icon}>help_outline</M.Icon>
        <span>Qurator</span>
      </button>
    </M.Tooltip>
  )
}
