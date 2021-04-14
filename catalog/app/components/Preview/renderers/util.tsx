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

const useAlertStyles = M.makeStyles((t) => ({
  action: {
    marginLeft: 'auto',
  },
  icon: {
    marginRight: '12px',
  },
  message: {
    padding: t.spacing(1, 0),
  },
  root: {
    alignItems: 'center',
    border: `1px solid ${t.palette.warning.light}`,
    color: t.palette.warning.dark,
    display: 'flex',
    padding: '6px 16px',
  },
}))

interface AlertProps {
  action: React.ReactNode
  children: React.ReactNode
  className: string
  onClick: () => void
}

function Alert({ action, children, className, onClick }: AlertProps) {
  const classes = useAlertStyles()
  return (
    <M.Paper elevation={0} className={cx(classes.root, className)} onClick={onClick}>
      <M.Icon className={classes.icon}>report_problem_outlined</M.Icon>
      <div className={classes.message}>{children}</div>
      <div className={classes.action}>{action}</div>
    </M.Paper>
  )
}

const useMsgAccordionStyles = M.makeStyles((t) => ({
  root: {
    marginBottom: t.spacing(2),
  },
  alert: {
    borderColor: t.palette.warning.main,
    cursor: 'pointer',
  },
  alertExpanded: {
    borderRadius: `${t.shape.borderRadius}px ${t.shape.borderRadius}px 0 0`,
  },
  icon: {
    transition: 'transform 0.15s ease',
  },
  iconExpanded: {
    transform: 'rotate(180deg)',
  },
  msg: {
    borderRadius: `0 0 ${t.shape.borderRadius}px ${t.shape.borderRadius}px`,
  },
}))

interface MsgAccordionProps {
  title: string
  type: 'info' | 'warning'
  warnings: string
}

function MsgAccordion({ title, type, warnings }: MsgAccordionProps) {
  const classes = useMsgAccordionStyles()
  const [expanded, setExpanded] = React.useState(false)
  return (
    <div className={classes.root}>
      <Alert
        className={cx(classes.alert, { [classes.alertExpanded]: expanded })}
        onClick={() => setExpanded(!expanded)}
        action={
          <M.IconButton size="small">
            <M.Icon className={cx(classes.icon, { [classes.iconExpanded]: expanded })}>
              expand_more
            </M.Icon>
          </M.IconButton>
        }
      >
        {title}
      </Alert>
      <M.Collapse in={expanded}>
        <Msg className={classes.msg} type={type}>
          {warnings}
        </Msg>
      </M.Collapse>
    </div>
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
