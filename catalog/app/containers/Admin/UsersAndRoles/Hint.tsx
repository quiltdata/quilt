// A tooltip carrying the whole explanation of a value has to be reachable without a
// mouse, so its trigger takes focus. The a11y rule reads a focusable span as a mistake;
// here the span *is* the trigger, and giving it an interactive role would misdescribe it.
/* eslint-disable jsx-a11y/no-noninteractive-tabindex */
import * as React from 'react'
import * as M from '@material-ui/core'

interface HintProps {
  title: NonNullable<React.ReactNode>
  className?: string
  children: React.ReactNode
}

export default function Hint({ title, className, children }: HintProps) {
  return (
    <M.Tooltip title={title}>
      <span className={className} tabIndex={0}>
        {children}
      </span>
    </M.Tooltip>
  )
}
