import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useMsgStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: t.shape.borderRadius,
    padding: t.spacing(1.5),
    ...t.typography.body2,
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

export function Msg({ type = 'info', className, ...props }) {
  const classes = useMsgStyles()
  return <M.Box className={cx(classes.root, classes[type], className)} {...props} />
}

export const renderPreviewStatus = ({ note, warnings }) => (
  <>
    {!!note && (
      <Msg type="info" mb={2}>
        {note}
      </Msg>
    )}
    {!!warnings && (
      <Msg type="warning" mb={2}>
        {warnings}
      </Msg>
    )}
  </>
)
