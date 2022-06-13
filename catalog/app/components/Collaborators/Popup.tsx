import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

import Table from './Table'

const useStyles = M.makeStyles(() => ({
  close: {
    marginLeft: 'auto',
  },

  title: {
    display: 'flex',
    alignItems: 'center',
  },
}))

interface PopupProps {
  open: boolean
  bucket: string
  onClose: () => void
  collaborators: Model.Collaborators
}

export default function Popup({ bucket, open, onClose, collaborators }: PopupProps) {
  const classes = useStyles()
  return (
    <M.Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <M.DialogTitle>
        <div className={classes.title}>
          Collaborators on {bucket}{' '}
          <M.IconButton className={classes.close} onClick={onClose}>
            <M.Icon>close</M.Icon>
          </M.IconButton>
        </div>
      </M.DialogTitle>
      <M.DialogContent>
        <Table collaborators={collaborators} />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Close</M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}
