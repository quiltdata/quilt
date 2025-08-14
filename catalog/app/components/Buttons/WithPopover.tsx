import * as React from 'react'
import * as M from '@material-ui/core'

import Iconized from './Iconized'
import type { StrIcon, SvgIcon } from './Iconized'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  popup: {
    animation: t.transitions.create('$slideDown'),
    position: 'absolute',
    right: 0,
    top: '100%',
    transform: `translateY(${t.spacing(0.5)}px)`,
    zIndex: t.zIndex.modal,
    [t.breakpoints.down('xs')]: {
      width: 'calc(100vw - 16px)',
    },
  },
  backdrop: {
    backgroundColor: t.palette.action.disabledBackground,
    zIndex: t.zIndex.modal - 1,
  },
  '@keyframes slideDown': {
    '0%': {
      opacity: 0.7,
      transform: `matrix(0.9, 0, 0, 0.9, 10, ${t.spacing(-0.5)})`,
    },
    '100%': {
      opacity: 1,
      transform: `matrix(1, 0, 0, 1, 0, ${t.spacing(0.5)})`,
    },
  },
}))

interface WithPopoverProps {
  children: NonNullable<React.ReactNode>
  className?: string
  icon: StrIcon | SvgIcon
  label: string
}

export default function WithPopover({
  children,
  className,
  icon,
  label,
  ...props
}: WithPopoverProps & Parameters<typeof Iconized>[0]) {
  const classes = useStyles()
  const [opened, setOpened] = React.useState(false)
  const handleClick = React.useCallback(() => setOpened((o) => !o), [])
  const handleClose = React.useCallback(() => setOpened(false), [])
  return (
    <div className={classes.root}>
      <Iconized
        className={className}
        endIcon={<M.Icon>arrow_drop_down</M.Icon>}
        icon={icon}
        label={label}
        onClick={handleClick}
        size="small"
        variant="outlined"
        {...props}
      />

      <M.Backdrop open={opened} className={classes.backdrop} onClick={handleClose} />
      {opened && (
        <M.Paper className={classes.popup} elevation={4}>
          {children}
        </M.Paper>
      )}
    </div>
  )
}
