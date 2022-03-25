import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { Avatars, Popup } from 'components/Collaborators'
import * as style from 'constants/style'
import * as Model from 'model'
import usePotentialCollaborators from 'utils/usePotentialCollaborators'

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
  bucket: string
  collaborators: Model.GQLTypes.CollaboratorBucketConnection[]
  hidden: boolean
}

export default function Collaborators({
  bucket,
  collaborators,
  hidden,
}: CollaboratorsProps) {
  const classes = useStyles()

  const potentialCollaborators = usePotentialCollaborators()

  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])

  if (!collaborators?.length) return null

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <Popup
        bucket={bucket}
        collaborators={collaborators}
        potentialCollaborators={potentialCollaborators}
        onClose={handleClose}
        open={open}
      />
      <Avatars
        className={cx(classes.avatars, { [classes.hidden]: hidden })}
        collaborators={collaborators}
        potentialCollaborators={potentialCollaborators}
        onClick={handleOpen}
      />
    </M.MuiThemeProvider>
  )
}
