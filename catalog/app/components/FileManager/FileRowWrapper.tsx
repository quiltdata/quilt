import * as React from 'react'
import * as M from '@material-ui/core'

import { L } from 'components/Form/Package/types'

import FileRow, { FileRowProps, HEIGHT } from './FileRow'

const useStyles = M.makeStyles((t) => ({
  root: {},
  children: {
    display: 'flex',
  },
  outline: {
    cursor: 'pointer',
    flexShrink: 0,
    position: 'relative',
    width: `${HEIGHT}px`,
    '&::before': {
      background: t.palette.divider,
      bottom: 0,
      content: '""',
      display: 'block',
      left: `${HEIGHT / 2}px`,
      position: 'absolute',
      top: 0,
      width: '2px',
    },
  },
  list: {
    flexGrow: 1,
  },
  spinner: {
    margin: '6px 0 0 7px',
  },
}))

interface FileRowWrapperProps extends Omit<FileRowProps, 'expanded'> {
  children?: React.ReactNode
  expanded: boolean | typeof L
}

export default function FileRowWrapper({
  children,
  expanded,
  ...props
}: FileRowWrapperProps) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <FileRow {...props} expanded={!!expanded} />
      {expanded && !!children && (
        <div className={classes.children}>
          <div className={classes.outline} onClick={props.onToggle} />
          <div className={classes.list}>
            {expanded === L ? (
              <M.CircularProgress className={classes.spinner} size={20} />
            ) : (
              children
            )}
          </div>
        </div>
      )}
    </div>
  )
}
