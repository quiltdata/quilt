import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'

const useStyles = M.makeStyles((t) => ({
  root: {
    color: t.palette.text.hint,
  },
  clickable: {
    cursor: 'pointer',
  },
}))

interface ComponentProps {
  badgeContent?: string
  onClick?: () => void
  title: string
  icon: string
}

function Component({ badgeContent, icon, onClick, title }: ComponentProps) {
  const classes = useStyles()
  return (
    <M.Tooltip
      className={cx(classes.root, { [classes.clickable]: !!onClick })}
      title={title}
    >
      {badgeContent ? (
        <M.Badge badgeContent={badgeContent} color="secondary" onClick={onClick} max={99}>
          <M.Icon>{icon}</M.Icon>
        </M.Badge>
      ) : (
        <M.Icon>{icon}</M.Icon>
      )}
    </M.Tooltip>
  )
}

interface BadgeProps {
  collaborators: Model.Collaborators
  onClick: () => void
}

export default function Badge({ collaborators, onClick }: BadgeProps) {
  const knownNumber = collaborators.length
  const hasUnmanagedRole = React.useMemo(
    () => collaborators.find(({ permissionLevel }) => !permissionLevel),
    [collaborators],
  )
  if (knownNumber) {
    return (
      <Component
        onClick={onClick}
        badgeContent={hasUnmanagedRole ? `${knownNumber}+` : `${knownNumber}`}
        title="Click to view collaborators"
        icon="group"
      />
    )
  }

  return <Component title="Only you can see this bucket" icon="visibility_off" />
}
