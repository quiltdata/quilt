import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { BadgeState } from './badges'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderRadius: '50%',
    boxSizing: 'border-box',
    display: 'inline-flex',
    flexShrink: 0,
    justifyContent: 'center',
  },
  earned: {
    background: t.palette.primary.main,
    color: t.palette.primary.contrastText,
  },
  pending: {
    border: `1px dashed ${t.palette.divider}`,
    color: t.palette.text.disabled,
  },
}))

interface MedallionProps {
  icon: string
  state: BadgeState['kind']
  size?: number
  className?: string
}

/** The badge mark: filled midnight when earned, a dashed outline otherwise. */
export default function Medallion({ icon, state, size = 56, className }: MedallionProps) {
  const classes = useStyles()
  return (
    <span
      aria-hidden
      className={cx(
        classes.root,
        state === 'earned' ? classes.earned : classes.pending,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <M.Icon style={{ fontSize: Math.round(size * 0.5) }}>
        {state === 'unknown' ? 'help_outline' : icon}
      </M.Icon>
    </span>
  )
}
