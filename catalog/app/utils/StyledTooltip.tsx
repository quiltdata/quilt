import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  tooltip: {
    ...t.typography.body1,
    backgroundColor: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    boxShadow: t.shadows[8],
    color: t.palette.text.primary,
    maxWidth: t.spacing(30),
    padding: t.spacing(1),
  },
  arrow: {
    color: t.palette.common.white,
  },
}))

export default function StyledTooltip({
  classes: externalCls = {},
  ...props
}: M.TooltipProps) {
  const internalCls = useStyles()
  const classes = React.useMemo(
    () => R.mergeWith(cx, internalCls, externalCls),
    [internalCls, externalCls],
  )
  return <M.Tooltip classes={classes} {...props} />
}
