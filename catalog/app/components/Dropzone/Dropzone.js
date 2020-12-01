import cx from 'classnames'
import * as React from 'react'
import { useDropzone } from 'react-dropzone'
import * as M from '@material-ui/core'

import DropMessage from './DropMessage'
import FileEntry from './FileEntry'
import Header from './Header'

const useStyles = M.makeStyles((t) => ({
  dropzone: {
    marginTop: t.spacing(2),
    position: 'relative',
  },
  dropArea: {
    background: t.palette.action.hover,
    border: `1px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 140,
    outline: 'none',
    overflow: 'hidden',
  },
  dragOver: {
    background: t.palette.action.selected,
  },
  warning: {
    borderColor: t.palette.warning.dark,
  },
  error: {
    borderColor: t.palette.error.main,
  },
  files: {
    borderBottom: `1px solid ${t.palette.action.disabled}`,
    maxHeight: 200,
    overflowX: 'hidden',
    overflowY: 'auto',
  },
}))

export default function Dropzone({
  className,
  disabled,
  error,
  files,
  onDrop,
  overlayElement,
  statsElement,
  warning,
}) {
  const classes = useStyles()

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop })

  return (
    <div className={className}>
      <Header disabled error={error} warning={warning}>
        {statsElement}
      </Header>

      <div className={classes.dropzone}>
        <div
          {...getRootProps({
            className: cx(classes.dropArea, {
              [classes.dragOver]: isDragActive && !disabled,
              [classes.error]: !!error,
              [classes.warning]: !!warning,
            }),
          })}
        >
          <input {...getInputProps()} />

          {!!files.length && (
            <div
              className={cx(classes.files, {
                [classes.error]: !!error,
                [classes.warning]: !!warning,
              })}
            >
              {files.map((file) => (
                <FileEntry
                  iconName={file.iconName}
                  key={file.key}
                  path={file.path}
                  size={file.size}
                />
              ))}
            </div>
          )}

          <DropMessage disabled={disabled} error={error} warning={warning} />
        </div>

        {overlayElement}
      </div>
    </div>
  )
}
