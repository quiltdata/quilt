import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import { Breakpoint } from '@material-ui/core/styles/createBreakpoints'

const useStyles = M.makeStyles((t) => ({
  tooltip: {
    ...t.typography.body1,
    backgroundColor: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    boxShadow: t.shadows[8],
    color: t.palette.text.primary,
    maxWidth: ({ maxWidth }: { maxWidth?: Breakpoint }) =>
      maxWidth != null ? t.breakpoints.width(maxWidth) / 4 : '',
    padding: t.spacing(1),
  },
  arrow: {
    color: t.palette.background.paper,
  },
}))

interface StyledTooltipProps extends M.TooltipProps {
  maxWidth?: Breakpoint
}

export default function StyledTooltip({
  classes: externalCls = {},
  maxWidth,
  ...props
}: StyledTooltipProps) {
  const internalCls = useStyles({ maxWidth })
  const classes = React.useMemo(
    () => R.mergeWith(cx, internalCls, externalCls),
    [internalCls, externalCls],
  )
  return <M.Tooltip classes={classes} {...props} />
}
