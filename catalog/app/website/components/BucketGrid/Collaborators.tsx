import * as React from 'react'

import { Popup, Badge } from 'components/Collaborators'
import * as Model from 'model'

import usePotentialCollaborators from 'utils/usePotentialCollaborators'

interface CollaboratorsProps {
  bucket: string
  collaborators: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection>
}

export default function Collaborators({ bucket, collaborators }: CollaboratorsProps) {
  const potentialCollaborators = usePotentialCollaborators()
  const allCollaborators: Model.Collaborators = React.useMemo(
    () => [
      ...collaborators,
      ...potentialCollaborators.map((collaborator) => ({
        collaborator,
        permissionLevel: undefined,
      })),
    ],
    [collaborators, potentialCollaborators],
  )

  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])

  return (
    <>
      <Popup
        bucket={bucket}
        collaborators={allCollaborators}
        onClose={handleClose}
        open={open}
      />
      <Badge onClick={handleOpen} collaborators={allCollaborators} />
    </>
  )
}
