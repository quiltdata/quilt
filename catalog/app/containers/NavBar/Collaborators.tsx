import cx from 'classnames'
import * as React from 'react'
import * as urql from 'urql'
import * as M from '@material-ui/core'

import { Avatars, Popup } from 'components/Collaborators'
import * as style from 'constants/style'
import usePotentialCollaborators from 'utils/usePotentialCollaborators'

import BUCKET_COLLABORATORS from './BucketCollaborators.generated'

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
  hidden: boolean
}

export default function Collaborators({ bucket, hidden }: CollaboratorsProps) {
  const classes = useStyles()

  const [{ data }] = urql.useQuery({
    query: BUCKET_COLLABORATORS,
    variables: { bucket },
  })
  const collaborators = data?.bucketConfig?.collaborators
  const potentialCollaborators = usePotentialCollaborators()

  const [open, setOpen] = React.useState(false)
  const handleOpen = React.useCallback(() => setOpen(true), [setOpen])
  const handleClose = React.useCallback(() => setOpen(false), [setOpen])

  if (!collaborators?.length) return null

  // TODO: collaborators={[...collaborators, potentialCollaborators]}

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
