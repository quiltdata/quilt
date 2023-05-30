import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import FileTree from 'components/FileManager/FileTree'
import FilesTreeSkeleton from 'components/FileManager/Skeleton'
import { L } from 'components/Form/Package/types'
import Skeleton from 'components/Skeleton'

import * as State from './State'

const useStagedFilesSkeletonStyles = M.makeStyles((t) => ({
  dropzone: {
    flexGrow: 1,
    marginTop: t.spacing(1),
  },
}))

interface StagedFilesSkeletonProps {
  className: string
}

function StagedFilesSkeleton({ className }: StagedFilesSkeletonProps) {
  const classes = useStagedFilesSkeletonStyles()
  return (
    <div className={className}>
      <FilesTreeSkeleton />
      <Skeleton className={classes.dropzone} animate />
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    ...t.typography.subtitle1,
    display: 'flex',
    marginBottom: t.spacing(2),
  },
  fileTree: {
    marginBottom: t.spacing(2),
  },
  dropzone: {
    alignItems: 'center',
    background: t.palette.action.selected,
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: t.spacing(16),
  },
  expand: {
    marginLeft: 'auto',
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
}))

interface StagedFilesProps {
  className: string
  onExpand: () => void
  expanded: boolean
}

export default function StagedFiles({ className, expanded, onExpand }: StagedFilesProps) {
  const classes = useStyles()
  const { files } = State.use()

  if (files.state === L || files.state.staged.value === L) {
    return <StagedFilesSkeleton className={cx(classes.root, className)} />
  }

  return (
    <div className={cx(classes.root, className)}>
      {expanded && (
        <div className={classes.header}>
          Package contents
          <M.Fade in={expanded}>
            <M.IconButton onClick={onExpand} className={classes.expand} size="small">
              <M.Icon fontSize="small">zoom_out_map</M.Icon>
            </M.IconButton>
          </M.Fade>
        </div>
      )}
      <div className={classes.fileTree}>
        {files.state.staged.value.length && (
          <FileTree entries={files.state.staged.value} />
        )}
      </div>
      <div className={classes.dropzone} {...files.state.dropzone.root}>
        <input {...files.state.dropzone.input} />
        Drop files or click to browse
      </div>
    </div>
  )
}
