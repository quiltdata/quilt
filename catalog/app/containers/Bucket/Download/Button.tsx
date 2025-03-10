import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  popup: {
    minWidth: t.spacing(60),
    position: 'absolute',
    right: 0,
    top: 0,
    transform: `translate(${t.spacing(5)}px, ${t.spacing(5)}px)`,
    zIndex: t.zIndex.modal,
    [t.breakpoints.down('sm')]: {
      width: 'calc(100vw - 16px)',
    },
  },
}))

interface ButtonProps {
  label?: string
  className?: string
  children: NonNullable<React.ReactNode>
}

export default function Button({ className, children, label }: ButtonProps) {
  const classes = useStyles()
  const [popupOpen, setPopupOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)

  const handleButtonClick = () => {
    setPopupOpen((prevOpen) => !prevOpen)
  }

  const handleClose = () => {
    setPopupOpen(false)
  }

  return (
    <div ref={rootRef} className={classes.root}>
      <Buttons.Iconized
        className={className}
        endIcon={<M.Icon>arrow_drop_down</M.Icon>}
        onClick={handleButtonClick}
        size="small"
        icon="download"
        variant="outlined"
        label={label || 'Download'}
      />
      {popupOpen && (
        <M.ClickAwayListener onClickAway={handleClose}>
          <M.Paper className={classes.popup} elevation={8}>
            {children}
          </M.Paper>
        </M.ClickAwayListener>
      )}
    </div>
  )
}
