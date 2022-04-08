import cx from 'classnames'
import * as React from 'react'
import * as urql from 'urql'
import * as M from '@material-ui/core'

import { Avatars, Popup } from 'components/Collaborators'
import * as style from 'constants/style'
import * as Model from 'model'
import usePotentialCollaborators from 'utils/usePotentialCollaborators'

import BUCKET_COLLABORATORS from './BucketCollaborators.generated'

const NO_COLLABORATORS: ReadonlyArray<Model.GQLTypes.CollaboratorBucketConnection> = []

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
  const collaborators = data?.bucketConfig?.collaborators || NO_COLLABORATORS
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

  if (!allCollaborators?.length) return null

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <Popup
        bucket={bucket}
        collaborators={allCollaborators}
        onClose={handleClose}
        open={open}
      />
      <Avatars
        className={cx(classes.avatars, { [classes.hidden]: hidden })}
        collaborators={allCollaborators}
        onClick={handleOpen}
      />
    </M.MuiThemeProvider>
  )
}
