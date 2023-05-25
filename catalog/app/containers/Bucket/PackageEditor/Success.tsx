import * as React from 'react'
import * as M from '@material-ui/core'

import * as State from './State'

export default function Success() {
  const { main } = State.use()
  return (
    <M.Dialog fullWidth maxWidth="sm" open={main.state === true}>
      <M.DialogTitle>Push complete</M.DialogTitle>
      <M.DialogContent>Package successfully created</M.DialogContent>
    </M.Dialog>
  )
}
