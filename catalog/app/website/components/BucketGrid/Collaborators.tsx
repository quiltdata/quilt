import * as React from 'react'

import { Popup, Badge } from 'components/Collaborators'
import * as Model from 'model'

import useHasUnmanagedRole from 'utils/useHasUnmanagedRole'

interface CollaboratorsProps {
  bucket: string
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
}

export default function Collaborators({ bucket, collaborators }: CollaboratorsProps) {
  const hasUnmanagedRole = useHasUnmanagedRole()

  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])

  return (
    <>
      <Popup
        bucket={bucket}
        open={open}
        onClose={handleClose}
        collaborators={collaborators}
      />
      <Badge
        onClick={handleOpen}
        collaborators={collaborators}
        hasUnmanagedRole={hasUnmanagedRole}
      />
    </>
  )
}
