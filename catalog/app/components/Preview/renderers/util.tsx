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
    background: t.palette.info.main,
    color: t.palette.info.contrastText,
  },
  warning: {
    background: t.palette.warning.light,
    color: t.palette.warning.contrastText,
  },
}))

interface MsgProps extends M.BoxProps {
  type: 'info' | 'warning'
  className: string
}

export function Msg({ type = 'info', className, children, ...props }: MsgProps) {
  const classes = useMsgStyles()
  return (
    <M.Box className={cx(classes.root, classes[type], className)} {...props}>
      <div className={classes.inner}>{children}</div>
    </M.Box>
  )
}

const useMsgAccordionStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
  },
  icon: {
    marginRight: '12px',
  },
  msg: {
    width: '100%',
  },
  header: {
    width: '100%',
    alignItems: 'center',
    display: 'flex',
  },
}))

interface MsgAccordionProps {
  title: string
  type: 'info' | 'warning'
  warnings: string
}

function MsgAccordion({ title, type, warnings }: MsgAccordionProps) {
  const classes = useMsgAccordionStyles()
  return (
    <M.Accordion className={classes.root} variant="outlined">
      <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <div className={classes.header}>
          <M.Chip className={classes.icon} label="17" />
          {title}
        </div>
      </M.AccordionSummary>
      <M.AccordionDetails>
        <Msg className={classes.msg} type={type}>
          {warnings}
        </Msg>
      </M.AccordionDetails>
    </M.Accordion>
  )
}

export const renderWarnings = (warnings?: string) => {
  if (!warnings) return null

  return (
    <MsgAccordion
      title="Preview encountered parsing errors"
      type="warning"
      warnings={warnings}
    />
  )
}
