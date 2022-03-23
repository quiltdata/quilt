import * as React from 'react'
import * as M from '@material-ui/core'

import { Popup } from 'components/Collaborators'
import * as Model from 'model'

interface CollaboratorsProps {
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
}

export default function Collaborators({ collaborators }: CollaboratorsProps) {
  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])

  return (
    <>
      <Popup open={open} onClose={handleClose} collaborators={collaborators} />

      <M.Tooltip title="Click to view list of collaborators">
        <M.Badge
          onClick={handleOpen}
          badgeContent={collaborators.length}
          color="secondary"
          max={99}
        >
          <M.Icon>group</M.Icon>
        </M.Badge>
      </M.Tooltip>
    </>
  )
}
