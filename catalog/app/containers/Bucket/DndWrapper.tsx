import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { FileWithPath, useDropzone } from 'react-dropzone'
import { Publish as IconPublish } from '@material-ui/icons'

import useDragging from 'utils/dragging'

import * as FI from './PackageDialog/Inputs/Files/State'
import type * as Toolbar from './Toolbar'

const useStyles = M.makeStyles((t) => ({
  wrapper: {
    position: 'relative',
  },
  overlay: {
    alignItems: 'center',
    animation: t.transitions.create('$fade'),
    background: t.palette.background.paper,
    borderRadius: t.shape.borderRadius,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    opacity: 0.8,
    border: `2px dashed ${t.palette.primary.main}`,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: t.zIndex.modal,
  },
  hover: {
    opacity: 1,
    '& $dropMessage': {
      position: 'absolute',
      top: '2px',
      left: '2px',
      right: '2px',
      bottom: '2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: t.shape.borderRadius,
    },
  },
  dropMessage: {
    textAlign: 'center',
    padding: t.spacing(2),
  },
  dropMessageContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: t.spacing(2),
  },
  dropIcon: {
    fontSize: 48,
    color: t.palette.primary.main,
  },
  '@keyframes fade': {
    '0%': {
      opacity: 0,
    },
    '100%': {
      opacity: 0.8,
    },
  },
}))

interface DndWrapperProps {
  children: React.ReactNode
  disabled?: boolean
  handle: Toolbar.DirHandle
  onDrop: (files: FI.LocalFile[]) => void
}

export default function DndWrapper({
  children,
  disabled = false,
  handle,
  onDrop,
}: DndWrapperProps) {
  const classes = useStyles()

  const handleDrop = React.useCallback(
    (files: FileWithPath[]) => {
      if (files.length) {
        onDrop(files.map((f) => FI.computeHash(f)))
      }
    },
    [onDrop],
  )

  const { getRootProps, isDragActive } = useDropzone({
    onDrop: handleDrop,
    disabled,
    noClick: true,
    noDragEventsBubbling: true, // Prevent interference with children's own drag events
  })
  const isDragging = useDragging()

  return (
    <div className={classes.wrapper} {...getRootProps()}>
      {children}

      {(isDragging || isDragActive) && !disabled && (
        <div className={cx(classes.overlay, isDragActive && classes.hover)}>
          <M.Paper elevation={isDragActive ? 0 : 2} className={classes.dropMessage}>
            <div className={classes.dropMessageContent}>
              <IconPublish className={classes.dropIcon} />
              <M.Typography variant="h6" color="primary">
                Drop files here to upload
              </M.Typography>
              <M.Typography variant="body2" color="textSecondary">
                Release to start uploading to s3://{handle.bucket}/{handle.path}
              </M.Typography>
            </div>
          </M.Paper>
        </div>
      )}
    </div>
  )
}
