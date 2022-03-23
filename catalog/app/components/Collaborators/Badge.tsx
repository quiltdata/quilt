import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

interface BadgeProps {
  onClick: () => void
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
}

export default function Badge({ collaborators, onClick }: BadgeProps) {
  return (
    <M.Tooltip title="Click to view list of collaborators">
      <M.Badge
        onClick={onClick}
        badgeContent={collaborators.length}
        color="secondary"
        max={99}
      >
        <M.Icon>group</M.Icon>
      </M.Badge>
    </M.Tooltip>
  )
}
