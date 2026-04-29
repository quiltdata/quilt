import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  action: {
    cursor: 'pointer',
    opacity: 0.7,
    '&:hover': {
      opacity: 1,
    },
  },
})

interface MessageActionProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export default function MessageAction({
  children,
  className,
  onClick,
}: MessageActionProps) {
  const classes = useStyles()
  return (
    <span className={cx(classes.action, className)} onClick={onClick}>
      {children}
    </span>
  )
}
