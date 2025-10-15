import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import Iconized from './Iconized'
import type { StrIcon, SvgIcon } from './Iconized'

const useStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
  },
  popup: {
    animation: t.transitions.create('$slideDown'),
    transform: `translateY(${t.spacing(0.5)}px)`,
    zIndex: t.zIndex.modal,
    [t.breakpoints.down('xs')]: {
      position: 'fixed',
      left: t.spacing(2),
      right: t.spacing(2),
    },
    [t.breakpoints.up('sm')]: {
      position: 'absolute',
      right: 0,
      top: '100%',
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

interface WithPopoverPropsOwn {
  children: NonNullable<React.ReactNode>
  icon?: StrIcon | SvgIcon
  label: string
}

export type WithPopoverProps = WithPopoverPropsOwn &
  Omit<Parameters<typeof Iconized>[0], 'icon'>

export default function WithPopover({
  children,
  icon,
  label,
  ...props
}: WithPopoverProps) {
  // TODO: close on location change
  const classes = useStyles()
  const [opened, setOpened] = React.useState(false)
  const handleClick = React.useCallback(() => setOpened((o) => !o), [])
  const handleClose = React.useCallback(() => setOpened(false), [])
  return (
    <div className={classes.root}>
      {icon ? (
        <Iconized
          endIcon={<Icons.ArrowDropDown />}
          icon={icon}
          label={label}
          onClick={handleClick}
          size="small"
          variant="outlined"
          {...props}
        />
      ) : (
        <M.Button
          endIcon={<Icons.ArrowDropDown />}
          onClick={handleClick}
          size="small"
          variant="outlined"
          {...props}
        >
          {label}
        </M.Button>
      )}

      <M.Backdrop open={opened} className={classes.backdrop} onClick={handleClose} />
      {opened && (
        <M.Paper className={classes.popup} elevation={4} onClick={handleClose}>
          {children}
        </M.Paper>
      )}
    </div>
  )
}
