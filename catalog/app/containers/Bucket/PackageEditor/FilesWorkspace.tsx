import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import { L } from 'components/Form/Package/types'

import * as S3FilePicker from '../PackageDialog/S3FilePicker'

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
    // maxHeight: '64vh',
    minHeight: '32vh',
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
  const { bucket, files, src } = State.use()
  const [remoteOpened, setRemoteOpened] = React.useState(false)
  const [selectedBucket, setSelectedBucket] = React.useState(src.bucket)

  const [s3FilePickerOpen, setS3FilePickerOpen] = React.useState(false)

  const buckets: string[] | typeof L = React.useMemo(() => {
    const { successors } = bucket.state
    if (successors === L || successors instanceof Error) return L
    return successors.map(({ name }) => name).concat(src.bucket)
  }, [bucket.state, src])

  const handleClose = React.useCallback(
    (reason: S3FilePicker.CloseReason) => {
      if (!!reason && typeof reason === 'object') {
        files.actions.remote.onChange(reason)
      }
      setS3FilePickerOpen(false)
    },
    [files.actions.remote, setS3FilePickerOpen],
  )
  const handleStagedExpand = React.useCallback(() => setRemoteOpened(false), [])
  const handleRemoteExpand = React.useCallback(() => setRemoteOpened(true), [])

  return (
    <div className={classes.root}>
      {buckets !== L && (
        <S3FilePicker.Dialog
          bucket={selectedBucket}
          buckets={buckets}
          selectBucket={setSelectedBucket}
          open={s3FilePickerOpen}
          onClose={handleClose}
          initialPath={''}
        />
      )}

      <StagedFiles
        className={classes.staged}
        expanded={remoteOpened}
        onExpand={handleStagedExpand}
      />
      {remoteOpened ? (
        <>
          <Divider />
          <RemoteFiles className={classes.remote} />
        </>
      ) : (
        <Actions
          pending={files.state === L || buckets === L}
          className={classes.actions}
          onLocal={files.actions.dropzone.openFilePicker}
          onRemote={handleRemoteExpand}
        />
      )}
    </div>
  )
}
