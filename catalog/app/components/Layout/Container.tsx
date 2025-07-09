import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useContainerStyles = M.makeStyles((t) => ({
  fullWidth: {
    animation: t.transitions.create('$expand'),
  },
  contained: {
    animation: t.transitions.create('$collapse'),
  },
  '@keyframes expand': {
    '0%': {
      transform: 'scaleX(0.94)',
    },
    '100%': {
      transform: 'scaleX(1)',
    },
  },
  '@keyframes collapse': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: 1,
    },
  },
}))

interface ContainerProps extends M.ContainerProps {
  fullWidth: boolean
}

export default function Container({ children, className, fullWidth }: ContainerProps) {
  const classes = useContainerStyles()
  return (
    <M.Container
      className={cx(fullWidth ? classes.fullWidth : classes.contained, className)}
      maxWidth={!fullWidth && 'lg'}
    >
      {children}
    </M.Container>
  )
}
