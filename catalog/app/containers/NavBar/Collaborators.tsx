import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { Avatars, Popup } from 'components/Collaborators'
import * as style from 'constants/style'
import * as Model from 'model'
import useHasUnmanagedRole from 'utils/useHasUnmanagedRole'

const useStyles = M.makeStyles((t) => ({
  avatars: {
    marginLeft: t.spacing(2),
    transition: 'opacity 0.3s ease',
  },
  hidden: {
    opacity: 0,
  },
}))

interface CollaboratorsProps {
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
  hidden: boolean
}

export default function Collaborators({ collaborators, hidden }: CollaboratorsProps) {
  const classes = useStyles()

  const hasUnmanagedRole = useHasUnmanagedRole()

  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <Popup open={open} onClose={handleClose} collaborators={collaborators} />
      <Avatars
        className={cx(classes.avatars, { [classes.hidden]: hidden })}
        collaborators={collaborators}
        hasUnmanagedRole={hasUnmanagedRole}
        onClick={handleOpen}
      />
    </M.MuiThemeProvider>
  )
}
