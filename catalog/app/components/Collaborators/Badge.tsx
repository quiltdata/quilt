import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

interface BadgeProps {
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
  hasUnmanagedRole: boolean
  onClick: () => void
}

export default function Badge({ collaborators, hasUnmanagedRole, onClick }: BadgeProps) {
  const collaboratorsNum = hasUnmanagedRole
    ? `${collaborators.length}+`
    : collaborators.length
  return (
    <M.Tooltip title="Click to view list of collaborators">
      <M.Badge
        onClick={onClick}
        badgeContent={collaboratorsNum}
        color="secondary"
        max={99}
      >
        <M.Icon>group</M.Icon>
      </M.Badge>
    </M.Tooltip>
  )
}
