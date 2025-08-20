import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  popup: {
    position: 'absolute',
    right: 0,
    top: 0,
    transform: `translate(${t.spacing(5)}px, ${t.spacing(5)}px)`,
    zIndex: t.zIndex.modal,
    [t.breakpoints.down('xs')]: {
      width: 'calc(100vw - 16px)',
    },
  },
  backdrop: {
    zIndex: t.zIndex.modal - 1,
  },
}))

interface ButtonProps {
  label?: string
  className?: string
  children: NonNullable<React.ReactNode>
}

export default function Button({
  className,
  children,
  label = 'Get files',
}: ButtonProps) {
  const classes = useStyles()
  const [opened, setOpened] = React.useState(false)
  const handleClick = React.useCallback(() => setOpened((o) => !o), [])
  const handleClose = React.useCallback(() => setOpened(false), [])
  return (
    <div className={classes.root}>
      <Buttons.Iconized
        className={className}
        endIcon={<M.Icon>arrow_drop_down</M.Icon>}
        icon="download"
        label={label}
        onClick={handleClick}
        size="small"
        variant="outlined"
      />

      <M.Backdrop open={opened} className={classes.backdrop} onClick={handleClose} />
      {opened && (
        <M.Paper className={classes.popup} elevation={8}>
          {children}
        </M.Paper>
      )}
    </div>
  )
}
