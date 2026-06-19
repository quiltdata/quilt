import * as React from 'react'
import * as M from '@material-ui/core'

import { Model as AssistantModel } from 'components/Assistant'

const useStyles = M.makeStyles((t) => ({
  root: {
    marginLeft: t.spacing(1),
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
    <M.Tooltip title="Open Qurator">
      <M.IconButton
        aria-label="Open Qurator"
        className={classes.root}
        color="inherit"
        edge="end"
        onClick={api.show}
      >
        <M.Icon>assistant</M.Icon>
      </M.IconButton>
    </M.Tooltip>
  )
}
