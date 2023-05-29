import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

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
  onLocal: () => void
  onRemote: () => void
}

function Actions({ className, onLocal, onRemote }: ActionsProps) {
  const classes = useActionStyles()
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
        Add S3 files
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
    marginLeft: t.spacing(2),
    marginTop: '45px',
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
          className={classes.actions}
          onLocal={files.actions.dropzone.openFilePicker}
          onRemote={() => setRemoteOpened(true)}
        />
      )}
    </div>
  )
}
