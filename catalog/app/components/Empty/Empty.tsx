import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
  },
  actions: {
    alignItems: 'center',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    justifyContent: 'center',
    margin: 'auto',
    marginTop: t.spacing(2),
    maxWidth: '30rem',
    minWidth: '15rem',
    paddingBottom: t.spacing(2),
  },
  primary: {
    flexShrink: 0,
  },
  secondary: {
    marginLeft: t.spacing(2),
    flexBasis: '40%',
  },
  main: {
    ...t.typography.body1,
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    marginTop: t.spacing(3),
    maxWidth: '30rem',
  },
}))

interface EmptyProps {
  children?: React.ReactNode
  className?: string
  primary?: React.ReactNode
  secondary?: React.ReactNode
  title?: string
}

export default function Empty({
  children,
  className,
  primary,
  secondary,
  title,
}: EmptyProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      {title && <M.Typography variant="h4">{title}</M.Typography>}

      {(primary || secondary) && (
        <div className={classes.actions}>
          {primary && <div className={classes.primary}>{primary}</div>}
          {secondary && (
            <M.Typography className={classes.secondary}>{secondary}</M.Typography>
          )}
        </div>
      )}

      {children && <div className={classes.main}>{children}</div>}
    </div>
  )
}
