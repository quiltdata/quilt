import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Skeleton from 'components/Skeleton'

const useStyles = M.makeStyles((t) => ({
  button: {
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
  content: {
    flexDirection: 'column',
    position: 'relative',
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
  defaultExpanded?: boolean
  extenting?: boolean
  onDeactivate?: () => void
  title: string
}

export default function Container({
  className,
  children,
  defaultExpanded,
  title,
  extenting,
  onDeactivate,
}: ContainerProps) {
  const classes = useStyles()
  return (
    <M.Accordion className={className} defaultExpanded={defaultExpanded}>
      <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        {title}
      </M.AccordionSummary>
      <M.AccordionDetails className={classes.content}>
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
      </M.AccordionDetails>
      {onDeactivate && (
        <M.AccordionActions>
          <M.Button className={classes.button} size="small" onClick={onDeactivate}>
            Remove filter
          </M.Button>
        </M.AccordionActions>
      )}
    </M.Accordion>
  )
}
