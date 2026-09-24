import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

// An inline text action inside a message footer. A real button, so it is
// reachable from the keyboard and takes the focus ring; it inherits the
// footer's font and color and only underlines to signal the affordance.
const useStyles = M.makeStyles((t) => ({
  action: {
    color: 'inherit',
    font: 'inherit',
    textDecoration: 'underline',
    textDecorationColor: t.palette.text.disabled,
    textUnderlineOffset: 2,
    '&:hover': {
      color: t.palette.text.primary,
      textDecorationColor: 'currentColor',
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
}))

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
    <M.ButtonBase className={cx(classes.action, className)} onClick={onClick}>
      {children}
    </M.ButtonBase>
  )
}
