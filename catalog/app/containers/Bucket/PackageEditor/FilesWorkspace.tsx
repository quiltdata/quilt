import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import { L } from 'components/Form/Package/types'

import RemoteFiles from './RemoteFiles'
import StagedFiles from './StagedFiles'
import * as State from './State'

const useActionStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  button: {
    '& + &': {
      marginTop: t.spacing(1),
    },
  },
}))

interface ActionsProps {
  className: string
  pending: boolean
  onLocal: () => void
  onRemote: () => void
}

function Actions({ pending, className, onLocal, onRemote }: ActionsProps) {
  const classes = useActionStyles()
  if (pending) {
    return (
      <div className={cx(classes.root, className)}>
        <Buttons.Skeleton size="small" className={classes.button} />
        <Buttons.Skeleton size="small" className={classes.button} />
      </div>
    )
  }
  return (
    <div className={cx(classes.root, className)}>
      <M.Button
        className={classes.button}
        variant="outlined"
        size="small"
        onClick={onLocal}
      >
        Add local files
      </M.Button>
      <M.Button
        className={classes.button}
        variant="outlined"
        size="small"
        onClick={onRemote}
      >
        Add files from bucket
      </M.Button>
    </div>
  )
}

const useDividerStyles = M.makeStyles((t) => ({
  root: {
    width: t.spacing(8),
    height: '100%',
  },
}))

function Divider() {
  const classes = useDividerStyles()
  return <div className={classes.root}></div>
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    minHeight: t.spacing(70),
  },
  staged: {
    flexGrow: 1,
    width: `calc(50% - ${t.spacing(8)}px)`,
  },
  remote: {
    width: `calc(50% - ${t.spacing(8)}px)`,
    flexGrow: 1,
  },
  actions: {
    marginLeft: t.spacing(8),
  },
}))

export default function FilesWorkspace() {
  const classes = useStyles()
  const [remoteOpened, setRemoteOpened] = React.useState(false)
  const { files } = State.use()
  return (
    <div className={classes.root}>
      <StagedFiles
        className={classes.staged}
        expanded={remoteOpened}
        onExpand={() => setRemoteOpened(false)}
      />
      {remoteOpened ? (
        <>
          <Divider />
          <RemoteFiles className={classes.remote} />
        </>
      ) : (
        <Actions
          pending={files.state === L}
          className={classes.actions}
          onLocal={files.actions.dropzone.openFilePicker}
          onRemote={() => setRemoteOpened(true)}
        />
      )}
    </div>
  )
}
