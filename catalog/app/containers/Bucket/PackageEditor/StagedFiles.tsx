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
  className?: string
}

export function StagedFilesSkeleton({ className }: StagedFilesSkeletonProps) {
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
    position: 'relative',
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
    ...t.typography.body2,
    alignItems: 'center',
    background: t.palette.action.selected,
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'center',
    padding: t.spacing(6, 0),
  },
  expand: {
    marginLeft: 'auto',
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
  dragging: {
    ...t.typography.h3,
    background: t.palette.grey[300],
    bottom: '1px',
    left: '1px',
    borderStyle: 'dashed',
    borderWidth: '2px',
    position: 'absolute',
    right: '1px',
    top: '1px',
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
  const [dragging, setDragging] = React.useState(false)
  const handleDragStart = React.useCallback(() => setDragging(true), [])
  const handleDragEnd = React.useCallback(() => setDragging(false), [])
  React.useEffect(() => {
    document.addEventListener('dragover', handleDragStart)
    document.addEventListener('drop', handleDragEnd)
    document.addEventListener('dragleave', handleDragEnd)
    return () => {
      document.removeEventListener('dragstart', handleDragStart)
      document.removeEventListener('drop', handleDragEnd)
      document.removeEventListener('dragleave', handleDragEnd)
    }
  }, [handleDragStart, handleDragEnd])

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
      <div
        className={cx(classes.dropzone, { [classes.dragging]: dragging })}
        {...files.state.dropzone.root}
      >
        <input {...files.state.dropzone.input} />
        Drop files here or click to browse
      </div>
    </div>
  )
}
