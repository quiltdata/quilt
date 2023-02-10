import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  tooltip: {
    ...t.typography.body1,
    backgroundColor: t.palette.common.white,
    border: `1px solid ${t.palette.divider}`,
    boxShadow: t.shadows[8],
    color: t.palette.text.primary,
    maxWidth: t.spacing(30),
    padding: t.spacing(1),
  },
}))

export default function StyledTooltip({
  classes: externalClasses,
  ...props
}: M.TooltipProps) {
  const internalClasses = useStyles()
  const classes = React.useMemo(
    () => R.mergeWith((left, right) => cx(left, right), internalClasses, externalClasses),
    [internalClasses, externalClasses],
  )
  return <M.Tooltip classes={classes} {...props} />
}
