import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useMsgStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: t.shape.borderRadius,
    padding: t.spacing(1.5),
    whiteSpace: 'pre-wrap',
    ...t.typography.body2,
  },
  inner: {
    maxHeight: 100,
    overflow: 'auto',
  },
  info: {
    background: t.palette.info.light,
    color: t.palette.info.contrastText,
  },
  warning: {
    background: t.palette.warning.light,
    color: t.palette.warning.contrastText,
  },
}))

export function Msg({ type = 'info', className, children, ...props }) {
  const classes = useMsgStyles()
  return (
    <M.Box className={cx(classes.root, classes[type], className)} {...props}>
      <div className={classes.inner}>{children}</div>
    </M.Box>
  )
}

export const renderPreviewStatus = ({ note, warnings }) => (
  <Msg type="warning" mb={2}>
    {!!note && note}
    {!!note && !!warnings && '\n\n'}
    {!!warnings && warnings}
  </Msg>
)
