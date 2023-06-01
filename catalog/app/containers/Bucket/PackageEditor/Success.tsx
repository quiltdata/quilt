import * as React from 'react'
import * as M from '@material-ui/core'

import { L } from 'components/Form/Package/types'

import * as State from './State'

export default function Success() {
  const { main } = State.use()
  if (main.state === L) return null
  return (
    <M.Dialog fullWidth maxWidth="sm" open={!!main.state.success}>
      <M.DialogTitle>Push complete</M.DialogTitle>
      <M.DialogContent>Package successfully created</M.DialogContent>
    </M.Dialog>
  )
}
