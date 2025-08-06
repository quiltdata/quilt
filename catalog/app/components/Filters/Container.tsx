import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Skeleton from 'components/Skeleton'

const useStyles = M.makeStyles((t) => ({
  root: {},
  close: {},
  content: {
    display: 'flex',
    flexDirection: 'column',
    padding: t.spacing(0, 0, 2),
    position: 'relative',
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    margin: t.spacing(0, 0, 0.5),
  },
  closable: {
    marginBottom: t.spacing(1.5),
  },
  title: {
    ...t.typography.body2,
    fontWeight: 500,
  },
  lock: {
    alignItems: 'center',
    animation: '$showLock .3s ease-out',
    background: fade(t.palette.background.paper, 0.7),
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  spinner: {},
  '@keyframes showLock': {
    '0%': {
      transform: 'scale(1.2x)',
    },
    '100%': {
      transform: 'scale(1)',
    },
  },
}))

interface ContainerProps {
  children?: React.ReactNode
  className?: string
  extenting?: boolean
  onDeactivate?: () => void
  title: React.ReactNode
  defaultExpanded?: boolean
}

export default function Container({
  className,
  children,
  title,
  extenting,
  onDeactivate,
}: ContainerProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <div className={cx(classes.header, onDeactivate && classes.closable)}>
        <div className={classes.title}>{title}</div>
        {onDeactivate && (
          <M.IconButton size="small" className={classes.close} onClick={onDeactivate}>
            <M.Icon fontSize="inherit">clear</M.Icon>
          </M.IconButton>
        )}
      </div>
      <div className={classes.content}>
        {children ? (
          <>
            {children}
            {extenting && (
              <div className={classes.lock}>
                <M.CircularProgress className={classes.spinner} size={28} />
              </div>
            )}
          </>
        ) : (
          <Skeleton height={32} />
        )}
      </div>
    </div>
  )
}
