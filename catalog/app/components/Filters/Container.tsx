import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Skeleton from 'components/Skeleton'

const useStyles = M.makeStyles((t) => ({
  close: {
    margin: t.spacing(1),
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    padding: t.spacing(0, 2, 2),
    position: 'relative',
    '&:last-child': {
      paddingBottom: t.spacing(2),
    },
  },
  header: {
    padding: t.spacing(1, 2),
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
  title: string
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
    <M.Card className={className}>
      <M.CardHeader
        className={classes.header}
        action={
          onDeactivate && (
            <M.IconButton size="small" className={classes.close}>
              <M.Icon fontSize="inherit">clear</M.Icon>
            </M.IconButton>
          )
        }
        title={title}
        titleTypographyProps={{ variant: 'body1' }}
      />
      <M.CardContent className={classes.content}>
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
      </M.CardContent>
    </M.Card>
  )
}
