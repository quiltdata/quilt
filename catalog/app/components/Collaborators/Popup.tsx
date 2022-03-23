import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

import Table from './Table'

interface PopupProps {
  open: boolean
  onClose: () => void
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
}

export default function Popup({ open, onClose, collaborators }: PopupProps) {
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <M.DialogContent>
        <Table collaborators={collaborators} />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
